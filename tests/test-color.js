// tests/test-color.js — alert-level → style class and marker mapping.

import { Level } from '../memory-monitor@work_in_progress/lib/alerts.js';
import { STYLE_CLASS, markerForLevel, resolveColorClass, BAR_FILL, resolveBarFill } from '../memory-monitor@work_in_progress/lib/color.js';

export function run(t) {
    const { eq, ok } = t;

    // Style classes
    eq(STYLE_CLASS[Level.NONE], 'memory-monitor-normal', 'normal style class');
    eq(STYLE_CLASS[Level.WARNING], 'memory-monitor-warning', 'warning style class');
    eq(STYLE_CLASS[Level.CRITICAL], 'memory-monitor-critical', 'critical style class');

    // Markers (textual, so color is never the only signal).
    eq(markerForLevel(Level.NONE), '', 'no marker for normal');
    eq(markerForLevel(Level.WARNING), '\u26A0', 'warning marker');
    eq(markerForLevel(Level.CRITICAL), '\u26D4', 'critical marker');
    eq(markerForLevel('bogus'), '', 'unknown level has no marker');

    // Color resolution.
    eq(resolveColorClass(Level.WARNING, { enableColors: true }), 'memory-monitor-warning', 'warning color when enabled');
    eq(resolveColorClass(Level.CRITICAL, { enableColors: true }), 'memory-monitor-critical', 'critical color when enabled');
    eq(resolveColorClass(Level.WARNING, { enableColors: false }), null, 'no color when disabled');
    eq(resolveColorClass(Level.NONE, { enableColors: true, showNormalColor: false }), null, 'no normal color by default');
    eq(resolveColorClass(Level.NONE, { enableColors: true, showNormalColor: true }), 'memory-monitor-normal', 'normal color when toggled');
    eq(resolveColorClass(Level.NONE, { enableColors: false, showNormalColor: true }), null, 'normal color requires master switch');
    eq(resolveColorClass('bogus', { enableColors: true }), null, 'unknown level has no color');

    // Bar fill resolution (menu progress bars).
    eq(resolveBarFill(Level.WARNING, { enableColors: true }), BAR_FILL.warning, 'warning bar fill');
    eq(resolveBarFill(Level.CRITICAL, { enableColors: true }), BAR_FILL.critical, 'critical bar fill');
    eq(resolveBarFill(Level.WARNING, { enableColors: false }), null, 'no bar fill when colors disabled');
    eq(resolveBarFill(Level.NONE, { enableColors: true, showNormalColor: false }), null, 'no normal bar fill by default');
    eq(resolveBarFill(Level.NONE, { enableColors: true, showNormalColor: true }), BAR_FILL.normal, 'normal bar fill when toggled');
    eq(resolveBarFill(Level.NONE, { enableColors: false, showNormalColor: true }), null, 'normal bar fill requires master switch');
    eq(resolveBarFill('bogus', { enableColors: true }), null, 'unknown level has no bar fill');
    ok(Array.isArray(BAR_FILL.warning) && BAR_FILL.warning.length === 4, 'bar fill is an RGBA array');
}