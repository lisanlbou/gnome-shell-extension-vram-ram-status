// memory/ram.js — parse /proc/meminfo into normalized byte counters.
//
// Pure JavaScript: no Shell/St/GTK/Adwaita imports, so this parser can be
// exercised headless against fixture text.

import { isValidByteCount } from '../model.js';

const MEM_TOTAL_RE = /^MemTotal:\s+(\d+)\s*kB/;
const MEM_AVAILABLE_RE = /^MemAvailable:\s+(\d+)\s*kB/;

/**
 * Parse /proc/meminfo text.
 *
 * Returns { total, available, used } in bytes, or null when the counters are
 * missing, malformed, or anomalous (non-positive total, negative available, or
 * available > total). "used" is defined as total - available.
 */
export function parseMeminfo(text) {
    if (typeof text !== 'string')
        return null;

    let total = null;
    let available = null;

    for (const line of text.split('\n')) {
        const totalMatch = line.match(MEM_TOTAL_RE);
        if (totalMatch !== null)
            total = Number.parseInt(totalMatch[1], 10) * 1024;
        const availMatch = line.match(MEM_AVAILABLE_RE);
        if (availMatch !== null)
            available = Number.parseInt(availMatch[1], 10) * 1024;
        if (total !== null && available !== null)
            break;
    }

    if (total === null || available === null)
        return null;
    if (!isValidByteCount(total) || !isValidByteCount(available))
        return null;
    if (total <= 0 || available < 0 || available > total)
        return null;

    return { total, available, used: total - available };
}
