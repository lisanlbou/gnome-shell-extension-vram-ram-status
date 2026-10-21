// tests/test-color.js — alert-level → style class and marker mapping.

import { Level } from '../vram-ram-status@local/lib/alerts.js';
import { STYLE_CLASS, markerForLevel, resolveColorClass } from '../vram-ram-status@local/lib/color.js';

export function run(t) {
    const { eq } = t;

    // Style classes
    eq(STYLE_CLASS[Level.NONE], 'vram-ram-normal', 'normal style class');
    eq(STYLE_CLASS[Level.WARNING], 'vram-ram-warning', 'warning style class');
    eq(STYLE_CLASS[Level.CRITICAL], 'vram-ram-critical', 'critical style class');

    // Markers (textual, so color is never the only signal).
    eq(markerForLevel(Level.NONE), '', 'no marker for normal');
    eq(markerForLevel(Level.WARNING), '\u26A0', 'warning marker');
    eq(markerForLevel(Level.CRITICAL), '\u26D4', 'critical marker');
    eq(markerForLevel('bogus'), '', 'unknown level has no marker');

    // Color resolution.
    eq(resolveColorClass(Level.WARNING, { enableColors: true }), 'vram-ram-warning', 'warning color when enabled');
    eq(resolveColorClass(Level.CRITICAL, { enableColors: true }), 'vram-ram-critical', 'critical color when enabled');
    eq(resolveColorClass(Level.WARNING, { enableColors: false }), null, 'no color when disabled');
    eq(resolveColorClass(Level.NONE, { enableColors: true, showNormalColor: false }), null, 'no normal color by default');
    eq(resolveColorClass(Level.NONE, { enableColors: true, showNormalColor: true }), 'vram-ram-normal', 'normal color when toggled');
    eq(resolveColorClass(Level.NONE, { enableColors: false, showNormalColor: true }), null, 'normal color requires master switch');
    eq(resolveColorClass('bogus', { enableColors: true }), null, 'unknown level has no color');
}