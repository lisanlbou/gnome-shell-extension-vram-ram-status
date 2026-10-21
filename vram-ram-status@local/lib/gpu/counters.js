// gpu/counters.js — shared parser for used/total byte counters.
//
// Pure JavaScript. Several vendors expose their memory counters through the
// same "used/total" file pair, so the parsing is shared.

import { isValidByteCount } from '../model.js';

/**
 * Parse used/total counter text into { used, total } bytes, or null when the
 * counters are missing, malformed, or anomalous. Only plain non-negative
 * decimal digits are accepted (no signs, fractions, hex, scientific notation,
 * or trailing junk); non-positive total, used > total, and values that are not
 * valid byte counts are rejected.
 */
const COUNTER_RE = /^\d+$/;

export function parseByteCounters(usedText, totalText) {
    if (typeof usedText !== 'string' || typeof totalText !== 'string')
        return null;
    const usedRaw = usedText.trim();
    const totalRaw = totalText.trim();
    if (!COUNTER_RE.test(usedRaw) || !COUNTER_RE.test(totalRaw))
        return null;
    const used = Number(usedRaw);
    const total = Number(totalRaw);
    if (!isValidByteCount(used) || !isValidByteCount(total))
        return null;
    if (total <= 0 || used > total)
        return null;
    return { used, total };
}
