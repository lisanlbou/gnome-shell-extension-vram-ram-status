// gpu/counters.js — shared parser for used/total byte counters.
//
// Pure JavaScript. Several vendors expose their memory counters through the
// same "used/total" file pair, so the parsing is shared.

import { sanitizeBytes } from '../model.js';

/**
 * Parse used/total counter text into { used, total } bytes, or null when the
 * counters are missing, malformed, or anomalous. Only plain non-negative
 * decimal digits are accepted (no signs, fractions, hex, scientific notation,
 * or trailing junk); non-positive total, used > total, and values that are not
 * valid byte counts are rejected.
 */
export function parseByteCounters(usedText, totalText) {
    const used = sanitizeBytes(usedText);
    const total = sanitizeBytes(totalText);
    if (used === null || total === null || total <= 0 || used > total)
        return null;
    return { used, total };
}
