// tests/test-counters.js — strict used/total counter parsing.

import { parseByteCounters } from '../memory-monitor@work_in_progress/lib/gpu/counters.js';

export function run(t) {
    const { eq } = t;

    eq(parseByteCounters('100', '200'), { used: 100, total: 200 }, 'parses plain digits');
    eq(parseByteCounters('  100\n', '200'), { used: 100, total: 200 }, 'trims surrounding whitespace');
    eq(parseByteCounters(null, '200'), null, 'null used -> null');
    eq(parseByteCounters('100', undefined), null, 'undefined total -> null');
    eq(parseByteCounters('12abc', '200'), null, 'trailing junk rejected');
    eq(parseByteCounters('abc12', '200'), null, 'leading junk rejected');
    eq(parseByteCounters('1.5', '200'), null, 'fractional used rejected');
    eq(parseByteCounters('0x10', '200'), null, 'hex-looking used rejected');
    eq(parseByteCounters('1e3', '200'), null, 'scientific notation rejected');
    eq(parseByteCounters('', '200'), null, 'empty used rejected');
    eq(parseByteCounters('   ', '200'), null, 'whitespace-only used rejected');
    eq(parseByteCounters('+50', '200'), null, 'signed used rejected');
    eq(parseByteCounters('-5', '200'), null, 'negative used rejected');
    eq(parseByteCounters('200', '0'), null, 'zero total rejected');
    eq(parseByteCounters('300', '200'), null, 'used > total rejected');
    eq(parseByteCounters('99999999999999999999', '200'), null, 'unsafe integer rejected');
}
