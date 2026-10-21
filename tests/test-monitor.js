// tests/test-monitor.js — collection orchestration against injected IO.
//
// The Monitor only depends on GLib (available in GJS) plus pure lib/ modules,
// so its collect() pipeline can be exercised headless with a fake filesystem.

import { Monitor } from '../vram-ram-status@local/lib/monitor.js';
import { MemoryClass, Status } from '../vram-ram-status@local/lib/model.js';

function fakeIo() {
    const meminfo =
        'MemTotal:       32476244 kB\n' +
        'MemFree:         2154292 kB\n' +
        'MemAvailable:   19840216 kB\n';
    const files = {
        '/proc/meminfo': meminfo,
        '/sys/class/drm/card1/device/mem_info_vram_used': '3000705024',
        '/sys/class/drm/card1/device/mem_info_vram_total': '34359738368',
    };
    return {
        readText: path => (path in files ? files[path] : null),
        listDir: () => ['card1', 'card1-DP-1', 'renderD128', 'version'],
    };
}

export function run(t) {
    const { eq } = t;

    const monitor = new Monitor({ io: fakeIo() });
    const snap = monitor.collect();

    eq(snap.ram.status, Status.OK, 'RAM status ok');
    eq(snap.ram.usedBytes, 12939292672, 'RAM used = total - available');
    eq(snap.ram.totalBytes, 33255673856, 'RAM total bytes');
    eq(snap.ram.memoryClass, MemoryClass.SYSTEM, 'RAM memory class');

    eq(snap.vram.status, Status.OK, 'VRAM status ok');
    eq(snap.vram.usedBytes, 3000705024, 'VRAM used bytes');
    eq(snap.vram.totalBytes, 34359738368, 'VRAM total bytes');
    eq(snap.vram.provider, 'amd', 'VRAM provider');
    eq(snap.vram.deviceId, 'card1', 'VRAM device id');
    eq(snap.vram.memoryClass, MemoryClass.DEDICATED, 'VRAM memory class');

    // Missing GPU counters degrade to unavailable, not a throw.
    const empty = new Monitor({
        io: { readText: () => null, listDir: () => [] },
    });
    const noGpu = empty.collect();
    eq(noGpu.vram.status, Status.UNAVAILABLE, 'no GPU -> VRAM unavailable');
    eq(noGpu.ram.status, Status.ERROR, 'no meminfo -> RAM error');
}
