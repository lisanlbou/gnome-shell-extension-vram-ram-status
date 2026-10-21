// gpu/counters.js — shared parser for used/total byte counters.
//
// Pure JavaScript. Several vendors expose their memory counters through the
// same "used/total" file pair, so the parsing is shared.

import { isValidByteCount } from '../model.js';

/**
 * Parse used/total counter text into { used, total } bytes, or null when the
 * counters are missing, malformed, or anomalous (negative used, non-positive
 * total, used > total, or values that are not valid byte counts).
 */
export function parseByteCounters(usedText, totalText) {
    if (usedText === null || totalText === null)
        return null;
    const used = Number.parseInt(String(usedText).trim(), 10);
    const total = Number.parseInt(String(totalText).trim(), 10);
    if (!isValidByteCount(used) || !isValidByteCount(total))
        return null;
    if (total <= 0 || used > total)
        return null;
    return { used, total };
}
