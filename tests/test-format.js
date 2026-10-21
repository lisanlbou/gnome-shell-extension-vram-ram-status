// tests/test-format.js — display formatting and units.

import { formatGiB, formatMetric, formatMetricParts, formatLabel, metricUnit } from '../vram-ram-status@local/lib/format.js';
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
    eq(metricUnit('suffix'), 'G', 'unit suffix is compact G');
    eq(metricUnit('none'), '', 'unit placement none');
    eq(metricUnit('bogus'), 'G', 'invalid unit placement -> suffix');

    const ram = new Reading({ kind: Kind.RAM, usedBytes: 16 * GIB, totalBytes: 32 * GIB, status: Status.OK });
    const vram = new Reading({ kind: Kind.VRAM, usedBytes: 3000705024, totalBytes: 34359738368, status: Status.OK });

    // Default used/total (compact units, no prefix).
    eq(formatMetric('ram', ram), '16/32G', 'RAM used/total default');
    eq(formatMetric('vram', vram), '2.8/32G', 'VRAM used/total default');

    // percentage
    eq(formatMetric('ram', ram, { format: 'percentage' }), '50%', 'RAM percentage');
    eq(formatMetric('vram', vram, { format: 'percentage' }), '9%', 'VRAM percentage rounded');

    // used-only / used-percent / used-total-percent
    eq(formatMetric('ram', ram, { format: 'used-only' }), '16G', 'RAM used-only');
    eq(formatMetric('vram', vram, { format: 'used-only' }), '2.8G', 'VRAM used-only');
    eq(formatMetric('ram', ram, { format: 'used-percent' }), '16G 50%', 'RAM used+percent');
    eq(formatMetric('vram', vram, { format: 'used-percent' }), '2.8G 9%', 'VRAM used+percent');
    eq(formatMetric('ram', ram, { format: 'used-total-percent' }), '16/32G 50%', 'RAM used/total+percent');
    eq(formatMetric('vram', vram, { format: 'used-total-percent' }), '2.8/32G 9%', 'VRAM used/total+percent');

    // decimals
    eq(formatMetric('vram', vram, { format: 'used-total', decimals: 2 }), '2.79/32G', 'decimals=2');

    // Unavailable
    eq(formatMetric('ram', null), 'N/A', 'null reading -> N/A');
    eq(formatMetric('vram', new Reading({ kind: Kind.VRAM, status: Status.ERROR })), 'N/A', 'error reading -> N/A');

    // Structured parts (for per-part coloring).
    eq(formatMetricParts('ram', ram), { icon: 'ram', value: '16/32G', percent: null }, 'parts used/total');
    eq(formatMetricParts('vram', vram, { format: 'used-total-percent' }), { icon: 'vram', value: '2.8/32G', percent: '9%' }, 'parts used/total+percent');
    eq(formatMetricParts('ram', ram, { format: 'percentage' }), { icon: 'ram', value: null, percent: '50%' }, 'parts percentage');
    eq(formatMetricParts('ram', null), { icon: 'ram', value: 'N/A', percent: null }, 'parts unavailable');
    eq(formatMetricParts('bogus', ram), { icon: 'vram', value: '16/32G', percent: null }, 'unknown kind falls back to vram icon');

    // formatLabel
    const snapshot = { ram, vram };
    eq(formatLabel(snapshot), '2.8/32G | 16/32G', 'label default vram-first');
    eq(formatLabel(snapshot, { metricOrder: 'ram-first' }), '16/32G | 2.8/32G', 'label ram-first');
    eq(formatLabel(snapshot, { separator: ' :: ' }), '2.8/32G :: 16/32G', 'custom separator');
    eq(formatLabel(snapshot, { showVram: false }), '16/32G', 'hide VRAM');
    eq(formatLabel(snapshot, { showRam: false }), '2.8/32G', 'hide RAM');
}
