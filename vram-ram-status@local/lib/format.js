// format.js — numerical display formatting and units.
//
// Pure JavaScript: no Shell/St/GTK/Adwaita imports. Used by both the Shell
// process (panel label + menu) and the headless unit tests.

import { Kind } from './model.js';
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

/** Short metric prefix used in compact formats. */
function shortPrefix(kind) {
    return kind === Kind.RAM ? 'R' : 'V';
}

/** Long metric label used in the "full" format. */
function fullPrefix(kind) {
    return kind === Kind.RAM ? 'RAM' : 'VRAM';
}

/**
 * The unit suffix appended once to a metric's numeric portion.
 *
 * Mirrors the baseline default: RAM shows " GiB" while the compact VRAM form
 * shows no unit. The "full" format always shows " GiB" for both metrics.
 * Returns '' when unit placement is 'none'.
 */
export function metricUnit(kind, format, unitPlacement) {
    const f = normalizeFormat(format);
    const p = normalizeUnitPlacement(unitPlacement);
    if (p === 'none')
        return '';
    if (kind === Kind.RAM)
        return ' GiB';
    if (f === 'full')
        return ' GiB';
    return '';
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
 * Render a single metric as panel text.
 *
 * Returns e.g. "R 14.2/31 GiB", "V 9%", "VRAM 2.9/32 GiB", or "V N/A".
 * A reading is treated as unavailable when it is null, not OK, or missing
 * usable used/total values.
 */
export function formatMetric(kind, reading, options = {}) {
    const o = normalizeOptions(kind, options);
    const prefix = o.format === 'full' ? fullPrefix(kind) : shortPrefix(kind);
    const unit = metricUnit(kind, o.format, o.unitPlacement);

    if (!reading || reading.status !== 'ok' ||
        reading.usedBytes === null || reading.totalBytes === null) {
        return `${prefix} N/A`;
    }

    const used = formatGiB(reading.usedBytes, o.decimals);
    const total = formatGiB(reading.totalBytes, o.decimals);
    if (used === null || total === null)
        return `${prefix} N/A`;

    switch (o.format) {
        case 'percentage': {
            const pct = Math.round((reading.usedBytes / reading.totalBytes) * 100);
            return `${prefix} ${pct}%`;
        }
        case 'used-only':
            return `${prefix} ${used}${unit}`;
        case 'used-percent': {
            const pct = Math.round((reading.usedBytes / reading.totalBytes) * 100);
            return `${prefix} ${used}${unit} (${pct}%)`;
        }
        case 'full':
        case 'used-total':
        default:
            return `${prefix} ${used}/${total}${unit}`;
    }
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
