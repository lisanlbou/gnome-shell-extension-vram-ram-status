// tests/test-selection.js — per-GPU selection resolution.

import { resolveSelection } from '../memory-monitor@local/lib/gpu/selection.js';

const DEVICES = [
    { stableId: 'pci-0000:00:02.0', vendor: 'intel' },
    { stableId: 'pci-0000:01:00.0', vendor: 'nvidia' },
];

export function run(t) {
    const { eq } = t;

    eq(resolveSelection([], 'auto'), { mode: 'auto', primary: null, devices: [] }, 'empty device list');

    eq(resolveSelection(DEVICES, 'auto').mode, 'auto', 'auto mode');
    eq(resolveSelection(DEVICES, 'auto').primary.stableId, 'pci-0000:00:02.0', 'auto picks first device');
    eq(resolveSelection(DEVICES, null).mode, 'auto', 'null key -> auto');

    const all = resolveSelection(DEVICES, 'all');
    eq(all.mode, 'all', 'all mode');
    eq(all.devices.length, 2, 'all returns every device');
    eq(all.primary.stableId, 'pci-0000:00:02.0', 'all primary is first device');

    const specific = resolveSelection(DEVICES, 'pci-0000:01:00.0');
    eq(specific.mode, 'specific', 'specific mode');
    eq(specific.primary.stableId, 'pci-0000:01:00.0', 'specific selects the requested device');

    const fallback = resolveSelection(DEVICES, 'pci-9999:99:99.9');
    eq(fallback.mode, 'auto', 'missing device -> auto');
    eq(fallback.fallback, true, 'missing device flagged as fallback');
    eq(fallback.primary.stableId, 'pci-0000:00:02.0', 'fallback primary is first device');
}
