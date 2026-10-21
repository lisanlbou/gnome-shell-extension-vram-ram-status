// tests/test-amd.js — AMD sysfs VRAM counter provider.

import { parseVramCounters, readVram, PROVIDER } from '../vram-ram-status@local/lib/gpu/providers/amd.js';

export function run(t) {
    const { eq } = t;

    eq(PROVIDER, 'amd', 'provider name is amd');

    eq(parseVramCounters('3000705024', '34359738368'),
       { used: 3000705024, total: 34359738368 }, 'parses valid counters');
    eq(parseVramCounters('  3000705024  \n', '34359738368'),
       { used: 3000705024, total: 34359738368 }, 'trims surrounding whitespace');

    eq(parseVramCounters(null, '34359738368'), null, 'missing used -> null');
    eq(parseVramCounters('3000705024', null), null, 'missing total -> null');
    eq(parseVramCounters('abc', '34359738368'), null, 'non-numeric used -> null');
    eq(parseVramCounters('-5', '34359738368'), null, 'negative used -> null');
    eq(parseVramCounters('34359738368', '0'), null, 'zero total -> null');
    eq(parseVramCounters('34359738368', '3000705024'), null, 'used > total -> null');
    eq(parseVramCounters('99999999999999999999', '34359738368'), null, 'unusually large used -> null');

    // readVram builds the sysfs paths and delegates to the injected reader.
    const reader = path => path.endsWith('mem_info_vram_used') ? '3000705024' : '34359738368';
    eq(readVram('card1', reader), { used: 3000705024, total: 34359738368 }, 'readVram resolves card paths');
}
