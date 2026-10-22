// tests/test-settings.js — pure settings defaults and normalization.

import {
    DEFAULTS,
    FORMATS,
    COLOR_TARGETS,
    PANEL_BOXES,
    REFRESH_INTERVALS,
    normalizeFormat,
    normalizeUnitPlacement,
    normalizePanelBox,
    normalizePanelPosition,
    normalizeDecimals,
    normalizePercent,
    normalizeRefreshInterval,
    normalizeColorTarget,
    normalizeThresholdPair,
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
    eq(DEFAULTS.ramCritical, 95, 'default RAM critical is 95');
    eq(DEFAULTS.vramCritical, 95, 'default VRAM critical is 95');
    eq(DEFAULTS.showIcons, true, 'default show icons');
    eq(DEFAULTS.colorTarget, 'whole', 'default color target whole');
    eq(DEFAULTS.showNormalColor, false, 'default show normal color false');
    eq(DEFAULTS.menuShowRam, true, 'default menu RAM shown');
    eq(DEFAULTS.menuShowVram, true, 'default menu VRAM shown');

    // Format / enum validators
    eq(FORMATS, ['percentage', 'used-only', 'used-total', 'used-total-percent', 'used-percent'], 'five display formats');
    eq(normalizeFormat('percentage'), 'percentage', 'valid format kept');
    eq(normalizeFormat('used-total-percent'), 'used-total-percent', 'used/total+percent format kept');
    eq(normalizeFormat('full'), 'used-total', 'legacy full maps to used-total');
    eq(normalizeFormat('bogus'), 'used-total', 'invalid format -> default');

    // Color target
    eq(COLOR_TARGETS, ['whole', 'icon', 'value', 'percentage'], 'color targets');
    eq(normalizeColorTarget('icon'), 'icon', 'valid color target kept');
    eq(normalizeColorTarget('bogus'), 'whole', 'invalid color target -> whole');

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

    // Threshold pair validation
    eq(normalizeThresholdPair(80, 95), { warning: 80, critical: 95 }, 'valid pair kept');
    eq(normalizeThresholdPair(95, 90), { warning: 95, critical: 96 }, 'inverted pair raises critical');
    eq(normalizeThresholdPair(100, 100), { warning: 99, critical: 100 }, 'ceiling pair pulls warning down');
    eq(normalizeThresholdPair(0, 0), { warning: 0, critical: 1 }, 'zero pair raises critical');
    eq(normalizeThresholdPair('x', 'y'), { warning: 80, critical: 95 }, 'non-numeric pair uses defaults');
}
