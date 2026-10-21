// monitor.js — orchestrate metric collection with reentrancy/timeout guards
// and a timestamped snapshot. Runs inside the GNOME Shell process (imports
// GLib for timers); all parsing is delegated to pure lib/ modules.

import GLib from 'gi://GLib';

import * as IO from './io.js';
import * as Ram from './memory/ram.js';
import * as Discovery from './gpu/discovery.js';
import * as Amd from './gpu/providers/amd.js';
import * as Intel from './gpu/providers/intel.js';
import * as Nvidia from './gpu/providers/nvidia.js';
import { resolveSelection } from './gpu/selection.js';
import { Kind, MemoryClass, Reading, Status } from './model.js';

const PROC_MEMINFO = '/proc/meminfo';

// Providers probed in vendor order. A device is matched by vendor.
const PROVIDERS = [Amd, Intel, Nvidia];

// Revalidate device discovery at most this often, unless the selected GPU is
// missing from the cache (then revalidate immediately).
const DISCOVERY_REVALIDATE_MS = 30000;

// Default timer backend. Tests inject a different scheduler to drive the timer
// lifecycle deterministically without a live GLib main loop.
const DEFAULT_SCHEDULER = Object.freeze({
    add(seconds, callback) {
        return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, callback);
    },
    remove(id) {
        return GLib.source_remove(id);
    },
});

// Default diagnostic sink. Tests inject a capturing logger to assert
// transition-only logging without relying on the Shell's global `log`.
const DEFAULT_LOGGER = message => log(message);

// An unavailable/error GPU reading body (no usable counters).
function failedGpu(status, errorCode) {
    return {
        usedBytes: null,
        totalBytes: null,
        memoryClass: MemoryClass.UNKNOWN,
        status,
        errorCode,
    };
}

export class Monitor {
    constructor({
        refreshSeconds = 2,
        onSnapshot = null,
        io = IO,
        getSelectedGpu = () => 'auto',
        scheduler = DEFAULT_SCHEDULER,
        logger = DEFAULT_LOGGER,
    } = {}) {
        this._refreshSeconds = refreshSeconds;
        this._onSnapshot = onSnapshot;
        this._io = io;
        this._getSelectedGpu = getSelectedGpu;
        this._scheduler = scheduler;
        this._logger = logger;
        this._failures = {};
        this._timeout = 0;
        this._inFlight = false;
        this._last = null;
        this._devices = [];
        this._lastDiscovery = 0;
        this._lastOkAt = null;
    }

    /** Start polling: collect once immediately, then schedule the timer. */
    start() {
        this.stop();
        this._collect();
        this._schedule();
    }

    /** Stop and re-arm with a new interval, collecting once immediately. */
    restart(seconds) {
        this._refreshSeconds = seconds;
        this.stop();
        this._collect();
        this._schedule();
    }

    /** Trigger an immediate collection (no-op if one is already in flight). */
    refreshNow() {
        this._collect();
    }

    /** Force device re-discovery on the next collection (e.g. after resume). */
    revalidate() {
        this._lastDiscovery = 0;
        this._collect();
    }

    /** The most recent snapshot, or null before the first collection. */
    get last() {
        return this._last;
    }

    stop() {
        this._clearTimeout();
    }

    /** Remove and clear any pending timer source (idempotent). */
    _clearTimeout() {
        if (this._timeout) {
            this._scheduler.remove(this._timeout);
            this._timeout = 0;
        }
    }

    /**
     * Install the recurring timer. The source id stays valid for the source's
     * whole lifetime (the callback deliberately does NOT clear `_timeout`), so
     * `stop()` can always cancel it. `_clearTimeout()` first makes re-arming
     * idempotent and prevents timer accumulation across restarts.
     */
    _schedule() {
        this._clearTimeout();
        this._timeout = this._scheduler.add(this._refreshSeconds, () => {
            this._collect();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _collect() {
        if (this._inFlight)
            return;
        this._inFlight = true;
        try {
            let snapshot;
            try {
                snapshot = this.collect();
                this._last = snapshot;
                this._logRecovery('collection');
            } catch (e) {
                snapshot = this._degradedSnapshot(Date.now());
                this._last = snapshot;
                this._logFailure('collection', e);
            }

            if (this._onSnapshot) {
                try {
                    this._onSnapshot(snapshot);
                    this._logRecovery('snapshot');
                } catch (e) {
                    this._logFailure('snapshot', e);
                }
            }
        } finally {
            this._inFlight = false;
        }
    }

    /** Log an unexpected failure once per scope; repeated failures stay silent. */
    _logFailure(scope, error) {
        if (this._failures[scope])
            return;
        this._failures[scope] = true;
        const detail = (error && error.message) ? error.message : String(error);
        this._logger(`vram-ram-status: ${scope} failed: ${detail}`);
    }

    /** Log recovery from a previously-failed scope exactly once. */
    _logRecovery(scope) {
        if (!this._failures[scope])
            return;
        delete this._failures[scope];
        this._logger(`vram-ram-status: ${scope} recovered`);
    }

    /**
     * A last-resort snapshot for when collection throws outright. Both metrics
     * are marked in error so the panel shows N/A rather than freezing on stale
     * data, and the extension's transition logger still observes the failure.
     */
    _degradedSnapshot(now) {
        const failed = kind => new Reading({
            kind,
            status: Status.ERROR,
            errorCode: 'collect-failed',
            timestamp: now,
        });
        return {
            ram: failed(Kind.RAM),
            vram: failed(Kind.VRAM),
            gpus: [],
            selection: resolveSelection([], 'auto'),
            at: now,
            lastOkAt: this._lastOkAt,
        };
    }

    /** Collect a full snapshot without the callback (used by tests/tooling). */
    collect() {
        const now = Date.now();
        this._revalidateDiscovery(now);
        const ram = this._collectRam(now);
        const gpus = this._collectGpus(now);
        const selection = resolveSelection(this._devices, this._getSelectedGpu());

        const anyOk = ram.status === Status.OK ||
            gpus.some(g => g.reading.status === Status.OK);
        if (anyOk)
            this._lastOkAt = now;

        return {
            ram,
            vram: this._primaryReading(gpus, selection.primary, now),
            gpus,
            selection,
            at: now,
            lastOkAt: this._lastOkAt,
        };
    }

    _revalidateDiscovery(now) {
        const selected = this._getSelectedGpu();
        const stale = now - this._lastDiscovery >= DISCOVERY_REVALIDATE_MS;
        const selectedMissing =
            selected !== 'auto' && selected !== 'all' &&
            !this._devices.some(device => device.stableId === selected);
        if (stale || selectedMissing || this._devices.length === 0) {
            try {
                this._devices = Discovery.discover(this._io);
                this._lastDiscovery = now;
                this._logRecovery('discovery');
            } catch (e) {
                // Keep existing devices (stale but usable) and retry next poll.
                this._logFailure('discovery', e);
            }
        }
    }

    // REST_INSERT
    _collectRam(now) {
        try {
            const text = this._io.readText(PROC_MEMINFO);
            const parsed = Ram.parseMeminfo(text);
            if (!parsed) {
                return new Reading({
                    kind: Kind.RAM,
                    status: Status.ERROR,
                    errorCode: 'meminfo-parse-failed',
                    timestamp: now,
                });
            }
            return new Reading({
                kind: Kind.RAM,
                usedBytes: parsed.used,
                totalBytes: parsed.total,
                memoryClass: MemoryClass.SYSTEM,
                provider: 'linux',
                timestamp: now,
                status: Status.OK,
            });
        } catch (e) {
            return new Reading({
                kind: Kind.RAM,
                status: Status.ERROR,
                errorCode: 'ram-read-failed',
                timestamp: now,
            });
        }
    }

    _collectGpus(now) {
        const results = [];
        for (const device of this._devices) {
            const provider = PROVIDERS.find(p => p.canHandle(device));
            let partial;
            if (!provider) {
                partial = failedGpu(Status.UNAVAILABLE, 'unknown-vendor');
            } else {
                try {
                    partial = provider.read(device, this._io);
                } catch (e) {
                    partial = failedGpu(Status.ERROR, 'provider-error');
                }
            }
            results.push({
                device,
                reading: new Reading({
                    kind: Kind.VRAM,
                    ...partial,
                    provider: device.vendor,
                    deviceId: device.stableId,
                    timestamp: now,
                }),
            });
        }
        return results;
    }

    _primaryReading(gpus, primaryDevice, now) {
        if (!primaryDevice) {
            return new Reading({
                kind: Kind.VRAM,
                status: Status.UNAVAILABLE,
                errorCode: 'no-gpu',
                timestamp: now,
            });
        }
        const entry = gpus.find(g => g.device.stableId === primaryDevice.stableId);
        if (entry)
            return entry.reading;
        return new Reading({
            kind: Kind.VRAM,
            status: Status.UNAVAILABLE,
            errorCode: 'selected-gpu-missing',
            timestamp: now,
        });
    }
}
