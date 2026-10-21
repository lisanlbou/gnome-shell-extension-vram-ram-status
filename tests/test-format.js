// tests/test-format.js — display formatting and units.

import { formatGiB, formatMetric, formatLabel, metricUnit } from '../vram-ram-status@local/lib/format.js';
import { Reading, Status, Kind } from '../vram-ram-status@local/lib/model.js';

const GIB = 1073741824;

export function run(t) {
    const { eq } = t;

    // formatGiB
    eq(formatGiB(34359738368, 1), '32', 'whole GiB strips trailing .0');
    eq(formatGiB(3000705024, 1), '2.8', 'rounds to one decimal');
    eq(formatGiB(0, 1), '0', 'zero formats as 0');
    eq(formatGiB(-1, 1), null, 'negative -> null');
    eq(formatGiB(NaN, 1), null, 'NaN -> null');

    // metricUnit
    eq(metricUnit('ram', 'used-total', 'suffix'), ' GiB', 'RAM unit suffix');
    eq(metricUnit('vram', 'used-total', 'suffix'), '', 'VRAM compact form has no unit (baseline)');
    eq(metricUnit('vram', 'full', 'suffix'), ' GiB', 'VRAM full form shows unit');
    eq(metricUnit('ram', 'used-total', 'none'), '', 'unit placement none');

    const ram = new Reading({ kind: Kind.RAM, usedBytes: 16 * GIB, totalBytes: 32 * GIB, status: Status.OK });
    const vram = new Reading({ kind: Kind.VRAM, usedBytes: 3000705024, totalBytes: 34359738368, status: Status.OK });

    // Default used/total (baseline display).
    eq(formatMetric('ram', ram), 'R 16/32 GiB', 'RAM used/total default');
    eq(formatMetric('vram', vram), 'V 2.8/32', 'VRAM used/total default');

    // percentage
    eq(formatMetric('ram', ram, { format: 'percentage' }), 'R 50%', 'RAM percentage');
    eq(formatMetric('vram', vram, { format: 'percentage' }), 'V 9%', 'VRAM percentage rounded');

    // used-only / used-percent / full
    eq(formatMetric('ram', ram, { format: 'used-only' }), 'R 16 GiB', 'RAM used-only');
    eq(formatMetric('vram', vram, { format: 'used-only' }), 'V 2.8', 'VRAM used-only');
    eq(formatMetric('ram', ram, { format: 'used-percent' }), 'R 16 GiB (50%)', 'RAM used+percent');
    eq(formatMetric('vram', vram, { format: 'used-percent' }), 'V 2.8 (9%)', 'VRAM used+percent');
    eq(formatMetric('ram', ram, { format: 'full' }), 'RAM 16/32 GiB', 'RAM full label');
    eq(formatMetric('vram', vram, { format: 'full' }), 'VRAM 2.8/32 GiB', 'VRAM full label');

    // decimals
    eq(formatMetric('vram', vram, { format: 'used-total', decimals: 2 }), 'V 2.79/32', 'decimals=2');

    // Unavailable
    eq(formatMetric('ram', null), 'R N/A', 'null reading -> N/A');
    eq(formatMetric('vram', new Reading({ kind: Kind.VRAM, status: Status.ERROR })), 'V N/A', 'error reading -> N/A');

    // formatLabel
    const snapshot = { ram, vram };
    eq(formatLabel(snapshot), 'V 2.8/32 | R 16/32 GiB', 'label default vram-first');
    eq(formatLabel(snapshot, { metricOrder: 'ram-first' }), 'R 16/32 GiB | V 2.8/32', 'label ram-first');
    eq(formatLabel(snapshot, { separator: ' :: ' }), 'V 2.8/32 :: R 16/32 GiB', 'custom separator');
    eq(formatLabel(snapshot, { showVram: false }), 'R 16/32 GiB', 'hide VRAM');
    eq(formatLabel(snapshot, { showRam: false }), 'V 2.8/32', 'hide RAM');
}
