// settings.js — pure defaults, allowed values and normalization helpers.
//
// This module MUST NOT import Shell, St, GTK, Adwaita or GLib. It is loaded by
// the Shell process, the preferences process, and the unit tests, so it must
// depend only on plain JavaScript. It mirrors the role of settings.js in the
// companion "Panel Apps" extension.

export const FORMATS = Object.freeze([
    'percentage',
    'used-only',
    'used-total',
    'used-total-percent',
    'used-percent',
]);

export const METRIC_ORDERS = Object.freeze(['vram-first', 'ram-first']);

export const UNIT_PLACEMENTS = Object.freeze(['suffix', 'none']);

export const COLOR_TARGETS = Object.freeze(['whole', 'icon', 'value', 'percentage']);

export const PANEL_BOXES = Object.freeze(['left', 'center', 'right']);

export const REFRESH_INTERVALS = Object.freeze([1, 2, 5, 10, 15, 30, 60]);

/** Well-known GPU selections. Any other value is treated as a stable device id. */
export const GPU_SELECTIONS = Object.freeze(['auto', 'all']);

export const DEFAULTS = Object.freeze({
    ramFormat: 'used-total',
    vramFormat: 'used-total',
    metricOrder: 'vram-first',
    decimals: 1,
    unitPlacement: 'suffix',
    separator: ' | ',
    showRam: true,
    showVram: true,
    refreshInterval: 10,
    panelBox: 'right',
    panelPosition: 0,
    selectedGpu: 'auto',
    ramAlertEnabled: false,
    ramWarning: 80,
    ramCritical: 95,
    vramAlertEnabled: false,
    vramWarning: 80,
    vramCritical: 95,
    alertCooldown: 300,
    alertHysteresis: 5,
    enableColors: true,
    showIcons: true,
    colorTarget: 'whole',
    showNormalColor: false,
    menuShowRam: true,
    menuShowVram: true,
});

export const LIMITS = Object.freeze({
    decimalsMin: 0,
    decimalsMax: 3,
    percentMin: 0,
    percentMax: 100,
    cooldownMin: 0,
    cooldownMax: 86400,
    hysteresisMin: 0,
    hysteresisMax: 50,
    panelPositionMax: 100,
});

/** Clamp a number into [min, max]; non-finite input falls back to min. */
export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return min;
    return Math.min(max, Math.max(min, n));
}

/** Validate a display format, falling back to 'used-total'. */
export function normalizeFormat(value) {
    // Legacy "full labels" format was removed in favor of compact forms; map
    // any persisted 'full' value to the closest equivalent.
    if (value === 'full')
        return DEFAULTS.ramFormat;
    return FORMATS.includes(value) ? value : DEFAULTS.ramFormat;
}

export function normalizeMetricOrder(value) {
    return METRIC_ORDERS.includes(value) ? value : DEFAULTS.metricOrder;
}

export function normalizeUnitPlacement(value) {
    return UNIT_PLACEMENTS.includes(value) ? value : DEFAULTS.unitPlacement;
}

/** Validate a color application mode, falling back to 'whole'. */
export function normalizeColorTarget(value) {
    return COLOR_TARGETS.includes(value) ? value : DEFAULTS.colorTarget;
}

export function normalizePanelBox(value) {
    return PANEL_BOXES.includes(value) ? value : DEFAULTS.panelBox;
}

/** Validate/bound a panel position index (non-negative integer). */
export function normalizePanelPosition(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0)
        return DEFAULTS.panelPosition;
    return Math.min(Math.floor(n), LIMITS.panelPositionMax);
}

/** Validate/bound the number of decimal places. */
export function normalizeDecimals(value) {
    return clamp(value, LIMITS.decimalsMin, LIMITS.decimalsMax);
}

/** Validate/bound a percentage threshold. */
export function normalizePercent(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return clamp(Math.round(n), LIMITS.percentMin, LIMITS.percentMax);
}

/** Validate a refresh interval, snapping to the nearest supported value. */
export function normalizeRefreshInterval(value) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return DEFAULTS.refreshInterval;
    let best = REFRESH_INTERVALS[0];
    let bestDelta = Infinity;
    for (const interval of REFRESH_INTERVALS) {
        const delta = Math.abs(interval - n);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = interval;
        }
    }
    return best;
}

/** Validate a GPU selection string. */
export function normalizeSelectedGpu(value) {
    return typeof value === 'string' && value.length > 0
        ? value
        : DEFAULTS.selectedGpu;
}

/** Validate/bound an alert cooldown (seconds). */
export function normalizeCooldown(value) {
    return clamp(value, LIMITS.cooldownMin, LIMITS.cooldownMax);
}

/** Validate/bound an alert hysteresis (percentage points). */
export function normalizeHysteresis(value) {
    return clamp(value, LIMITS.hysteresisMin, LIMITS.hysteresisMax);
}

/**
 * Validate a warning/critical threshold pair, guaranteeing the warning
 * threshold is strictly below the critical threshold. When the pair is
 * inverted, critical is raised to warning + 1 unless it is already at the
 * ceiling, in which case warning is pulled below critical.
 */
export function normalizeThresholdPair(warning, critical) {
    let w = normalizePercent(warning, DEFAULTS.ramWarning);
    let c = normalizePercent(critical, DEFAULTS.ramCritical);
    if (w >= c) {
        if (c < LIMITS.percentMax)
            c = Math.min(LIMITS.percentMax, w + 1);
        else
            w = Math.min(c - 1, LIMITS.percentMax - 1);
    }
    if (w >= c)
        w = Math.max(LIMITS.percentMin, c - 1);
    return { warning: w, critical: c };
}
