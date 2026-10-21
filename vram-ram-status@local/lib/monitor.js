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

export class Monitor {
    constructor({
        refreshSeconds = 2,
        onSnapshot = null,
        io = IO,
        getSelectedGpu = () => 'auto',
    } = {}) {
        this._refreshSeconds = refreshSeconds;
        this._onSnapshot = onSnapshot;
        this._io = io;
        this._getSelectedGpu = getSelectedGpu;
        this._timeout = 0;
        this._inFlight = false;
        this._last = null;
        this._devices = [];
        this._lastDiscovery = 0;
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

    /** The most recent snapshot, or null before the first collection. */
    get last() {
        return this._last;
    }

    stop() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = 0;
        }
    }

    _schedule() {
        this.stop();
        this._timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, this._refreshSeconds, () => {
                this._timeout = 0;
                this._collect();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _collect() {
        if (this._inFlight)
            return;
        this._inFlight = true;
        try {
            this._last = this.collect();
            if (this._onSnapshot)
                this._onSnapshot(this._last);
        } finally {
            this._inFlight = false;
        }
    }

    /** Collect a full snapshot without the callback (used by tests/tooling). */
    collect() {
        const now = Date.now();
        this._revalidateDiscovery(now);
        const ram = this._collectRam(now);
        const gpus = this._collectGpus(now);
        const selection = resolveSelection(this._devices, this._getSelectedGpu());
        return {
            ram,
            vram: this._primaryReading(gpus, selection.primary, now),
            gpus,
            selection,
            at: now,
        };
    }

    _revalidateDiscovery(now) {
        const selected = this._getSelectedGpu();
        const stale = now - this._lastDiscovery >= DISCOVERY_REVALIDATE_MS;
        const selectedMissing =
            selected !== 'auto' && selected !== 'all' &&
            !this._devices.some(device => device.stableId === selected);
        if (stale || selectedMissing || this._devices.length === 0) {
            this._devices = Discovery.discover(this._io);
            this._lastDiscovery = now;
        }
    }

    // REST_INSERT
    _collectRam(now) {
        const parsed = Ram.parseMeminfo(this._io.readText(PROC_MEMINFO));
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
    }

    _collectGpus(now) {
        const results = [];
        for (const device of this._devices) {
            const provider = PROVIDERS.find(p => p.canHandle(device));
            const partial = provider
                ? provider.read(device, this._io)
                : {
                    usedBytes: null,
                    totalBytes: null,
                    memoryClass: MemoryClass.UNKNOWN,
                    status: Status.UNAVAILABLE,
                    errorCode: 'unknown-vendor',
                };
            results.push({
                device,
                reading: new Reading({
                    kind: Kind.VRAM,
                    usedBytes: partial.usedBytes,
                    totalBytes: partial.totalBytes,
                    memoryClass: partial.memoryClass,
                    provider: device.vendor,
                    deviceId: device.stableId,
                    timestamp: now,
                    status: partial.status,
                    errorCode: partial.errorCode,
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
