// gpu/providers/amd.js — AMD sysfs dedicated VRAM counters.
//
// Parsing helpers are pure and testable; the Shell process injects readText.
// AMD exposes mem_info_vram_used / mem_info_vram_total under
// /sys/class/drm/cardN/device/.

import { isValidByteCount } from '../../model.js';

export const PROVIDER = 'amd';

/**
 * Parse used/total counter text into { used, total } bytes, or null when the
 * counters are missing, malformed, or anomalous (negative used, non-positive
 * total, or used > total).
 */
export function parseVramCounters(usedText, totalText) {
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

/**
 * Read VRAM counters for a card node. `readText(path)` returns text or null.
 * Returns { used, total } bytes or null.
 */
export function readVram(cardNode, readText) {
    const base = `/sys/class/drm/${cardNode}/device`;
    return parseVramCounters(
        readText(`${base}/mem_info_vram_used`),
        readText(`${base}/mem_info_vram_total`),
    );
}
