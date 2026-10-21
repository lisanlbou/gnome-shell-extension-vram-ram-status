// lib/color.js — pure mapping from alert level to panel style class and marker.
//
// Pure JavaScript: no Shell/St/GTK/Adwaita imports, so the mapping is testable
// headless. The indicator applies these classes to St actors; the actual colors
// live in stylesheet.css.

import { Level } from './alerts.js';

/** Style class per alert level. "normal" is the optional green state. */
export const STYLE_CLASS = Object.freeze({
    [Level.NONE]: 'vram-ram-normal',
    [Level.WARNING]: 'vram-ram-warning',
    [Level.CRITICAL]: 'vram-ram-critical',
});

/**
 * Textual alert marker for a level, so warning/critical state is visible
 * without relying on color (and readable by screen readers). Empty for no
 * alert. No trailing space: the indicator's box spacing handles separation.
 */
export function markerForLevel(level) {
    if (level === Level.CRITICAL)
        return '\u26D4'; // ⛔ no entry
    if (level === Level.WARNING)
        return '\u26A0'; // ⚠ warning sign
    return '';
}

/**
 * The style class to apply for a level, honoring the color master switch and
 * the optional green "normal" state. Returns null when no class applies.
 */
export function resolveColorClass(level, { enableColors, showNormalColor } = {}) {
    if (!enableColors)
        return null;
    if (level === Level.NONE)
        return showNormalColor ? STYLE_CLASS[Level.NONE] : null;
    return STYLE_CLASS[level] ?? null;
}
