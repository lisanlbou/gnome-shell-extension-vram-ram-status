// tests/test-settings.js — pure settings defaults and normalization.

import {
    DEFAULTS,
    FORMATS,
    PANEL_BOXES,
    REFRESH_INTERVALS,
    normalizeFormat,
    normalizeMetricOrder,
    normalizeUnitPlacement,
    normalizePanelBox,
    normalizePanelPosition,
    normalizeDecimals,
    normalizePercent,
    normalizeRefreshInterval,
    normalizeCooldown,
    normalizeHysteresis,
} from '../vram-ram-status@local/lib/settings.js';

export function run(t) {
    const { eq } = t;

    // Defaults
    eq(DEFAULTS.refreshInterval, 10, 'default refresh is 10s');
    eq(DEFAULTS.ramFormat, 'used-total', 'default RAM format is used-total');
    eq(DEFAULTS.vramFormat, 'used-total', 'default VRAM format is used-total');
    eq(DEFAULTS.metricOrder, 'vram-first', 'default order is vram-first');
    eq(DEFAULTS.panelBox, 'right', 'default panel box is right');
    eq(DEFAULTS.selectedGpu, 'auto', 'default GPU selection is auto');
    eq(DEFAULTS.enableColors, true, 'default colors enabled');

    // Format / enum validators
    eq(normalizeFormat('percentage'), 'percentage', 'valid format kept');
    eq(normalizeFormat('bogus'), 'used-total', 'invalid format -> default');
    eq(FORMATS.length, 5, 'five display formats');

    eq(normalizeMetricOrder('ram-first'), 'ram-first', 'valid order kept');
    eq(normalizeMetricOrder('x'), 'vram-first', 'invalid order -> default');

    eq(normalizeUnitPlacement('none'), 'none', 'valid unit placement');
    eq(normalizeUnitPlacement('x'), 'suffix', 'invalid unit placement -> default');

    // Panel
    eq(normalizePanelBox('left'), 'left', 'valid panel box');
    eq(normalizePanelBox('bogus'), 'right', 'invalid panel box -> default');
    eq(PANEL_BOXES, ['left', 'center', 'right'], 'panel boxes');
    eq(normalizePanelPosition(-3), 0, 'negative position -> 0');
    eq(normalizePanelPosition(2.9), 2, 'fractional position floored');
    eq(normalizePanelPosition('x'), 0, 'non-numeric position -> 0');
    eq(normalizePanelPosition(1000), 100, 'position clamped to max');

    // Numeric bounds
    eq(normalizeDecimals(99), 3, 'decimals clamped high');
    eq(normalizeDecimals(-1), 0, 'decimals clamped low');
    eq(normalizeDecimals(2), 2, 'decimals within range');

    eq(normalizePercent(150, 80), 100, 'percent clamped high');
    eq(normalizePercent(-5, 80), 0, 'percent clamped low');
    eq(normalizePercent('x', 80), 80, 'non-numeric percent -> fallback');

    eq(normalizeRefreshInterval(10), 10, 'exact interval kept');
    eq(normalizeRefreshInterval(9), 10, 'nearest interval 9 -> 10');
    eq(normalizeRefreshInterval(4), 5, 'nearest interval 4 -> 5');
    eq(normalizeRefreshInterval(1000), 60, 'interval clamped to 60');
    eq(normalizeRefreshInterval('x'), 10, 'non-numeric interval -> default');
    eq(REFRESH_INTERVALS, [1, 2, 5, 10, 15, 30, 60], 'supported intervals');

    eq(normalizeCooldown(-1), 0, 'cooldown clamped low');
    eq(normalizeCooldown(999999), 86400, 'cooldown clamped high');
    eq(normalizeHysteresis(999), 50, 'hysteresis clamped high');
}
