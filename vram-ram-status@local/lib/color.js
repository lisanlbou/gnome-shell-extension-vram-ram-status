// lib/color.js — pure mapping from alert level to panel style class, marker,
// and menu progress-bar fill color.
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

/**
 * Progress-bar fill color per alert level, as an [r, g, b, a] array with
 * components in 0..1. Values match the palette in stylesheet.css. The neutral
 * state is not listed here; resolveBarFill returns null for it so the menu can
 * fall back to the theme's foreground color.
 */
export const BAR_FILL = Object.freeze({
    normal: [0x26 / 255, 0xa2 / 255, 0x69 / 255, 1.0],
    warning: [0xcd / 255, 0x93 / 255, 0x09 / 255, 1.0],
    critical: [0xc0 / 255, 0x1c / 255, 0x28 / 255, 1.0],
});

/**
 * Resolve the dropdown progress-bar fill for a level, honoring the color
 * master switch and the optional green "normal" state. Returns an RGBA array
 * for colored states, or null for the neutral theme-foreground state.
 */
export function resolveBarFill(level, { enableColors = true, showNormalColor = false } = {}) {
    if (!enableColors)
        return null;
    if (level === Level.WARNING)
        return BAR_FILL.warning;
    if (level === Level.CRITICAL)
        return BAR_FILL.critical;
    if (level === Level.NONE && showNormalColor)
        return BAR_FILL.normal;
    return null;
}
