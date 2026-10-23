// gpu/providers/amd.js — AMD sysfs dedicated VRAM counters.
//
// Parsing helpers are pure and testable; the Shell process injects the io
// reader. AMD exposes mem_info_vram_used / mem_info_vram_total (dedicated
// VRAM) and mem_info_vis_vram_* (visible VRAM) under
// /sys/class/drm/cardN/device/.

import { parseByteCounters } from '../counters.js';
import { MemoryClass, Status } from '../../model.js';

export const PROVIDER = 'amd';

export function canHandle(device) {
    return !!device && device.vendor === PROVIDER;
}

/**
 * Parse used/total counter text into { used, total } bytes, or null when the
 * counters are missing, malformed, or anomalous.
 */
export function parseVramCounters(usedText, totalText) {
    return parseByteCounters(usedText, totalText);
}

/**
 * Read VRAM counters for a card node. `readText(path)` returns text or null.
 * Returns { used, total } bytes or null.
 */
export function readVram(cardNode, readText) {
    const base = `/sys/class/drm/${cardNode}/device`;
    return parseVramCounters(
        readText(`${base}/mem_info_vram_used`),
        readText(`${base}/mem_info_vram_total`),
    );
}

/**
 * Read an AMD device's memory. Prefers dedicated VRAM; falls back to the
 * visible-VRAM (aperture) counters on configurations that expose only those,
 * reported with the `visible` class. Reports unavailable when no usable
 * counter pair exists.
 */
export function read(device, io) {
    const base = `/sys/class/drm/${device.cardNode}/device`;

    const dedicated = parseByteCounters(
        io.readText(`${base}/mem_info_vram_used`),
        io.readText(`${base}/mem_info_vram_total`),
    );
    if (dedicated) {
        return {
            usedBytes: dedicated.used,
            totalBytes: dedicated.total,
            memoryClass: MemoryClass.DEDICATED,
            status: Status.OK,
            errorCode: null,
        };
    }

    const visible = parseByteCounters(
        io.readText(`${base}/mem_info_vis_vram_used`),
        io.readText(`${base}/mem_info_vis_vram_total`),
    );
    if (visible) {
        return {
            usedBytes: visible.used,
            totalBytes: visible.total,
            memoryClass: MemoryClass.VISIBLE,
            status: Status.OK,
            errorCode: null,
        };
    }

    return {
        usedBytes: null,
        totalBytes: null,
        memoryClass: MemoryClass.DEDICATED,
        status: Status.UNAVAILABLE,
        errorCode: 'amd-counters-missing',
    };
}
