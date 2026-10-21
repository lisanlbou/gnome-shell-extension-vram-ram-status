// monitor.js — orchestrate metric collection with reentrancy/timeout guards
// and a timestamped snapshot. Runs inside the GNOME Shell process (imports
// GLib for timers); all parsing is delegated to pure lib/ modules.
//
// Guarantees:
//   - a poll runs once on start(),
//   - refreshes never overlap (in-flight guard),
//   - the timer source is always removed in stop().

import GLib from 'gi://GLib';

import * as IO from './io.js';
import * as Ram from './memory/ram.js';
import * as Amd from './gpu/providers/amd.js';
import * as Discovery from './gpu/discovery.js';
import { Kind, MemoryClass, Reading, Status } from './model.js';

const PROC_MEMINFO = '/proc/meminfo';

export class Monitor {
    constructor({ refreshSeconds = 2, onSnapshot = null, io = IO } = {}) {
        this._refreshSeconds = refreshSeconds;
        this._onSnapshot = onSnapshot;
        this._io = io;
        this._timeout = 0;
        this._inFlight = false;
        this._last = null;
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
        return {
            ram: this._collectRam(now),
            vram: this._collectVram(now),
            at: now,
        };
    }

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

    _collectVram(now) {
        const names = this._io.listDir(Discovery.DRM_BASE);
        const cards = Discovery.listCardNodes(names);
        for (const card of cards) {
            const vram = Amd.readVram(card, this._io.readText);
            if (vram) {
                return new Reading({
                    kind: Kind.VRAM,
                    usedBytes: vram.used,
                    totalBytes: vram.total,
                    memoryClass: MemoryClass.DEDICATED,
                    provider: Amd.PROVIDER,
                    deviceId: card,
                    timestamp: now,
                    status: Status.OK,
                });
            }
        }
        return new Reading({
            kind: Kind.VRAM,
            status: Status.UNAVAILABLE,
            errorCode: 'no-amd-vram',
            timestamp: now,
        });
    }
}
