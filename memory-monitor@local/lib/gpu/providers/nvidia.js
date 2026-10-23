// gpu/providers/nvidia.js — NVIDIA capability-detected backend.
//
// The proprietary NVIDIA driver does not expose VRAM counters through sysfs.
// Reading NVML requires an opt-in, capability-detected helper; this extension
// never runs nvidia-smi synchronously in the Shell process. Without such a
// helper the device is reported as explicitly unavailable.

import { MemoryClass, Status } from '../../model.js';

export const PROVIDER = 'nvidia';

export function canHandle(device) {
    return !!device && device.vendor === PROVIDER;
}

/**
 * Report an NVIDIA device's memory. Currently always unavailable: a helper is
 * not bundled, and none is configured. The error code makes the requirement
 * explicit so users are not shown fabricated values.
 */
export function read(device, io) {
    return {
        usedBytes: null,
        totalBytes: null,
        memoryClass: MemoryClass.DEDICATED,
        status: Status.UNAVAILABLE,
        errorCode: 'nvidia-nvml-helper-not-available',
    };
}
