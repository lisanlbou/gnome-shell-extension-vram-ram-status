// format.js — numerical display formatting and units.
//
// Pure JavaScript: no Shell/St/GTK/Adwaita imports. Used by both the Shell
// process (panel label + menu) and the headless unit tests.

import { Kind, Status } from './model.js';
import { DEFAULTS, normalizeDecimals, normalizeFormat, normalizeUnitPlacement } from './settings.js';

const GIB = 1073741824;

/**
 * Format a byte count as GiB text, matching the baseline behaviour:
 * `toFixed(decimals)` with a trailing ".0" stripped. Returns null for
 * invalid/non-finite inputs so callers can render "N/A".
 */
export function formatGiB(bytes, decimals = DEFAULTS.decimals) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0)
        return null;
    const d = normalizeDecimals(decimals);
    const text = (n / GIB).toFixed(d);
    return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/**
 * The compact unit suffix appended to a metric's numeric value ("G" for GiB).
 * Returns '' when unit placement is 'none'.
 */
export function metricUnit(unitPlacement) {
    return normalizeUnitPlacement(unitPlacement) === 'none' ? '' : 'G';
}

/** Normalize a per-metric format option object. */
export function normalizeOptions(kind, options = {}) {
    return {
        format: normalizeFormat(options.format ?? DEFAULTS.ramFormat),
        decimals: normalizeDecimals(options.decimals ?? DEFAULTS.decimals),
        unitPlacement: normalizeUnitPlacement(options.unitPlacement ?? DEFAULTS.unitPlacement),
    };
}

/** Default options for a metric kind (the baseline display). */
export function defaultOptions(kind) {
    return {
        format: DEFAULTS.ramFormat,
        decimals: DEFAULTS.decimals,
        unitPlacement: DEFAULTS.unitPlacement,
    };
}

/**
 * The structured parts of a rendered metric, used by the indicator to compose
 * separate actors so the icon, value, or percentage can be colored
 * independently (see the "color application mode" setting).
 *
 * Returns { icon, value, percent }:
 *   - icon: the metric kind ('ram' | 'vram').
 *   - value: the numeric portion ("4.2/16G", "4.2G"), or null.
 *   - percent: the percentage portion ("26%"), or null.
 * A reading is treated as unavailable when it is null, not OK, or missing
 * usable used/total values; the value becomes "N/A" and percent is null.
 */
export function formatMetricParts(kind, reading, options = {}) {
    const o = normalizeOptions(kind, options);
    const icon = kind === Kind.RAM ? Kind.RAM : Kind.VRAM;
    const unit = metricUnit(o.unitPlacement);

    if (!reading || reading.status !== Status.OK ||
        reading.usedBytes === null || reading.totalBytes === null) {
        return { icon, value: 'N/A', percent: null };
    }

    const used = formatGiB(reading.usedBytes, o.decimals);
    const total = formatGiB(reading.totalBytes, o.decimals);
    if (used === null || total === null)
        return { icon, value: 'N/A', percent: null };

    const pct = Math.round((reading.usedBytes / reading.totalBytes) * 100);

    switch (o.format) {
        case 'percentage':
            return { icon, value: null, percent: `${pct}%` };
        case 'used-only':
            return { icon, value: `${used}${unit}`, percent: null };
        case 'used-percent':
            return { icon, value: `${used}${unit}`, percent: `${pct}%` };
        case 'used-total-percent':
            return { icon, value: `${used}/${total}${unit}`, percent: `${pct}%` };
        case 'used-total':
        default:
            return { icon, value: `${used}/${total}${unit}`, percent: null };
    }
}

/**
 * Render a single metric as compact panel text ("4.2/16G 26%", "26%", or
 * "N/A"). Icons are rendered separately by the indicator, so no text prefix is
 * included here.
 */
export function formatMetric(kind, reading, options = {}) {
    const parts = formatMetricParts(kind, reading, options);
    const text = [];
    if (parts.value !== null)
        text.push(parts.value);
    if (parts.percent !== null)
        text.push(parts.percent);
    return text.join(' ');
}

/**
 * Build the full panel label from a snapshot, honouring metric order,
 * visibility and the configured separator.
 */
export function formatLabel(snapshot, {
    ramFormat = DEFAULTS.ramFormat,
    vramFormat = DEFAULTS.vramFormat,
    metricOrder = DEFAULTS.metricOrder,
    decimals = DEFAULTS.decimals,
    unitPlacement = DEFAULTS.unitPlacement,
    separator = DEFAULTS.separator,
    showRam = DEFAULTS.showRam,
    showVram = DEFAULTS.showVram,
} = {}) {
    const ramText = formatMetric(Kind.RAM, snapshot.ram, { format: ramFormat, decimals, unitPlacement });
    const vramText = formatMetric(Kind.VRAM, snapshot.vram, { format: vramFormat, decimals, unitPlacement });

    const parts = [];
    if (metricOrder === 'vram-first') {
        if (showVram) parts.push(vramText);
        if (showRam) parts.push(ramText);
    } else {
        if (showRam) parts.push(ramText);
        if (showVram) parts.push(vramText);
    }
    return parts.join(separator);
}
