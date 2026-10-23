// tests/test-providers.js — AMD/Intel/NVIDIA provider read() contract.

import * as Amd from '../memory-monitor@work_in_progress/lib/gpu/providers/amd.js';
import * as Intel from '../memory-monitor@work_in_progress/lib/gpu/providers/intel.js';
import * as Nvidia from '../memory-monitor@work_in_progress/lib/gpu/providers/nvidia.js';
import { MemoryClass, Status } from '../memory-monitor@work_in_progress/lib/model.js';

function io(files) {
    return { readText: path => (path in files ? files[path] : null), listDir: () => [] };
}

export function run(t) {
    const { eq } = t;

    const amd = { cardNode: 'card1', vendor: 'amd' };
    eq(Amd.canHandle(amd), true, 'amd handles amd');
    eq(Intel.canHandle(amd), false, 'intel rejects amd');
    eq(Nvidia.canHandle(amd), false, 'nvidia rejects amd');

    // AMD dedicated counters.
    const amdRead = Amd.read(amd, io({
        '/sys/class/drm/card1/device/mem_info_vram_used': '100',
        '/sys/class/drm/card1/device/mem_info_vram_total': '200',
    }));
    eq(amdRead.status, Status.OK, 'AMD dedicated ok');
    eq(amdRead.usedBytes, 100, 'AMD used');
    eq(amdRead.memoryClass, MemoryClass.DEDICATED, 'AMD dedicated class');

    // AMD visible-VRAM fallback.
    const amdVis = Amd.read(amd, io({
        '/sys/class/drm/card1/device/mem_info_vis_vram_used': '50',
        '/sys/class/drm/card1/device/mem_info_vis_vram_total': '200',
    }));
    eq(amdVis.status, Status.OK, 'AMD visible fallback ok');
    eq(amdVis.usedBytes, 50, 'AMD visible used');
    eq(amdVis.memoryClass, MemoryClass.VISIBLE, 'AMD visible fallback is visible, not dedicated');

    // AMD missing counters.
    const amdNone = Amd.read(amd, io({}));
    eq(amdNone.status, Status.UNAVAILABLE, 'AMD missing -> unavailable');
    eq(amdNone.errorCode, 'amd-counters-missing', 'AMD error code');

    // Intel integrated (no counters) -> shared, unavailable.
    const intel = { cardNode: 'card0', vendor: 'intel' };
    const intelShared = Intel.read(intel, io({}));
    eq(intelShared.status, Status.UNAVAILABLE, 'Intel integrated -> unavailable');
    eq(intelShared.memoryClass, MemoryClass.SHARED, 'Intel shared class');
    eq(intelShared.errorCode, 'intel-shared-memory', 'Intel error code');

    // Intel discrete local-memory counters.
    const intelLocal = Intel.read(intel, io({
        '/sys/class/drm/card0/device/mem_info_vram_used': '100',
        '/sys/class/drm/card0/device/mem_info_vram_total': '200',
    }));
    eq(intelLocal.status, Status.OK, 'Intel local ok');
    eq(intelLocal.memoryClass, MemoryClass.LOCAL, 'Intel local class');

    // NVIDIA: unavailable without an opt-in helper.
    const nvidia = { cardNode: 'card1', vendor: 'nvidia' };
    const nvRead = Nvidia.read(nvidia, io({}));
    eq(nvRead.status, Status.UNAVAILABLE, 'NVIDIA unavailable');
    eq(nvRead.errorCode, 'nvidia-nvml-helper-not-available', 'NVIDIA error code');
    eq(nvRead.memoryClass, MemoryClass.DEDICATED, 'NVIDIA class dedicated');
}
