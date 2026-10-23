// gpu/providers/intel.js — Intel integrated/shared and local-memory counters.
//
// Pure parsing is shared with the other vendors via gpu/counters.js; the Shell
// process injects the io reader. Integrated Intel GPUs share system memory and
// expose no dedicated/local counters, so they are reported as shared memory
// with an explicit unavailable status rather than a fabricated number.

import { parseByteCounters } from '../counters.js';
import { MemoryClass, Status } from '../../model.js';

export const PROVIDER = 'intel';

export function canHandle(device) {
    return !!device && device.vendor === PROVIDER;
}

/**
 * Read memory counters for an Intel device.
 *
 * Some Intel discrete GPUs expose local-memory counters under the same
 * mem_info_vram_* names; when present they are reported as LOCAL memory.
 * Otherwise the device is treated as integrated/shared and reported as
 * unavailable with an explicit shared-memory class.
 */
export function read(device, io) {
    const base = `/sys/class/drm/${device.cardNode}/device`;
    const parsed = parseByteCounters(
        io.readText(`${base}/mem_info_vram_used`),
        io.readText(`${base}/mem_info_vram_total`),
    );
    if (parsed) {
        return {
            usedBytes: parsed.used,
            totalBytes: parsed.total,
            memoryClass: MemoryClass.LOCAL,
            status: Status.OK,
            errorCode: null,
        };
    }
    return {
        usedBytes: null,
        totalBytes: null,
        memoryClass: MemoryClass.SHARED,
        status: Status.UNAVAILABLE,
        errorCode: 'intel-shared-memory',
    };
}
