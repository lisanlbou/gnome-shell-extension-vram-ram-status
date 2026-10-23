// tests/test-monitor.js — collection orchestration against injected IO.
//
// The Monitor only depends on GLib (available in GJS) plus pure lib/ modules,
// so its collect() pipeline can be exercised headless with a fake filesystem.

import { Monitor } from '../memory-monitor@work_in_progress/lib/monitor.js';
import { MemoryClass, Status } from '../memory-monitor@work_in_progress/lib/model.js';
import { amdIo, MEMINFO } from './fixtures.js';

function dualIo() {
    const files = {
        '/proc/meminfo': MEMINFO,
        '/sys/class/drm/card0/device/vendor': '0x8086',
        '/sys/class/drm/card0/device/uevent': 'DRIVER=i915\nPCI_SLOT_NAME=0000:00:02.0\n',
        '/sys/class/drm/card1/device/vendor': '0x10de',
        '/sys/class/drm/card1/device/uevent': 'DRIVER=nvidia\nPCI_SLOT_NAME=0000:01:00.0\n',
    };
    return {
        readText: path => (path in files ? files[path] : null),
        listDir: () => ['card0', 'card1', 'version'],
    };
}

export function run(t) {
    const { eq } = t;

    // Single AMD device (the live reference environment).
    const snap = new Monitor({ io: amdIo() }).collect();
    eq(snap.ram.status, Status.OK, 'RAM ok');
    eq(snap.ram.usedBytes, 12939292672, 'RAM used = total - available');
    eq(snap.ram.memoryClass, MemoryClass.SYSTEM, 'RAM memory class');

    eq(snap.vram.status, Status.OK, 'VRAM ok');
    eq(snap.vram.usedBytes, 3000705024, 'VRAM used bytes');
    eq(snap.vram.totalBytes, 34359738368, 'VRAM total bytes');
    eq(snap.vram.provider, 'amd', 'VRAM provider');
    eq(snap.vram.deviceId, 'pci-0000:c4:00.0', 'VRAM stable id');
    eq(snap.vram.memoryClass, MemoryClass.DEDICATED, 'VRAM memory class');

    eq(snap.gpus.length, 1, 'one GPU discovered');
    eq(snap.selection.mode, 'auto', 'auto selection');
    eq(snap.selection.primary.stableId, 'pci-0000:c4:00.0', 'primary device');

    // Dual Intel + NVIDIA: specific selection by stable id.
    const dual = new Monitor({ io: dualIo(), getSelectedGpu: () => 'pci-0000:01:00.0' }).collect();
    eq(dual.gpus.length, 2, 'two GPUs discovered');
    eq(dual.vram.deviceId, 'pci-0000:01:00.0', 'specific selection honored');
    eq(dual.vram.status, Status.UNAVAILABLE, 'NVIDIA unavailable without helper');
    eq(dual.vram.errorCode, 'nvidia-nvml-helper-not-available', 'NVIDIA error code');

    // Missing selected device -> fallback to first device.
    const missing = new Monitor({ io: dualIo(), getSelectedGpu: () => 'pci-9999:99:99.9' }).collect();
    eq(missing.selection.mode, 'auto', 'fallback to auto when selected missing');
    eq(missing.selection.fallback, true, 'fallback flagged');
    eq(missing.vram.deviceId, 'pci-0000:00:02.0', 'falls back to first device');
    eq(missing.vram.status, Status.UNAVAILABLE, 'Intel shared -> unavailable');

    // No GPU / no meminfo degrade gracefully.
    const empty = new Monitor({ io: { readText: () => null, listDir: () => [] } }).collect();
    eq(empty.vram.status, Status.UNAVAILABLE, 'no GPU -> VRAM unavailable');
    eq(empty.vram.errorCode, 'no-gpu', 'no GPU error code');
    eq(empty.ram.status, Status.ERROR, 'no meminfo -> RAM error');
}
