// model.js — normalized measurement contract shared across providers.
//
// Pure JavaScript: no Shell/St/GTK/Adwaita imports, so this module is usable
// from the Shell process, the preferences process, and headless unit tests.

/** Semantic class of a memory region. */
export const MemoryClass = Object.freeze({
    SYSTEM: 'system',      // host RAM
    DEDICATED: 'dedicated', // discrete/dedicated GPU memory (VRAM)
    SHARED: 'shared',      // system memory shared with the GPU
    LOCAL: 'local',        // GPU-local memory (e.g. Intel discrete)
    UNKNOWN: 'unknown',
});

/** Reading status. */
export const Status = Object.freeze({
    OK: 'ok',
    UNAVAILABLE: 'unavailable',
    STALE: 'stale',
    ERROR: 'error',
});

/** Metric kind. */
export const Kind = Object.freeze({
    RAM: 'ram',
    VRAM: 'vram',
});

/**
 * A normalized memory reading.
 *
 * usedBytes/totalBytes are byte counts and may be null when the counter is not
 * available. timestamp is epoch milliseconds. status and errorCode describe
 * the provenance of the values.
 */
export class Reading {
    constructor({
        kind,
        usedBytes = null,
        totalBytes = null,
        memoryClass = MemoryClass.UNKNOWN,
        provider = null,
        deviceId = null,
        timestamp = null,
        status = Status.OK,
        errorCode = null,
    } = {}) {
        this.kind = kind;
        this.usedBytes = usedBytes;
        this.totalBytes = totalBytes;
        this.memoryClass = memoryClass;
        this.provider = provider;
        this.deviceId = deviceId;
        this.timestamp = timestamp;
        this.status = status;
        this.errorCode = errorCode;
    }
}

/**
 * True for a valid byte count: a non-negative safe integer. Requiring a safe
 * integer rejects both fractional garbage and absurdly large values that would
 * otherwise lose precision and produce a misleading percentage.
 */
export function isValidByteCount(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Normalize a raw byte count. Returns the number when it is a valid byte
 * count, otherwise null. Integer strings are coerced conservatively.
 */
export function sanitizeBytes(value) {
    if (value === null || value === undefined)
        return null;
    const n = typeof value === 'number' ? value : Number(value);
    return isValidByteCount(n) ? n : null;
}

/**
 * Percentage of `used` over `total`, or null when it cannot be computed
 * meaningfully (missing values, non-positive total, or used > total).
 */
export function percentUsed(used, total) {
    const u = sanitizeBytes(used);
    const t = sanitizeBytes(total);
    if (u === null || t === null || t <= 0 || u > t)
        return null;
    const pct = (u / t) * 100;
    return Number.isFinite(pct) ? pct : null;
}

/** Convenience: percentage from a Reading (used/total). */
export function readingPercent(reading) {
    if (!reading)
        return null;
    return percentUsed(reading.usedBytes, reading.totalBytes);
}

/** Whether a Reading carries usable used+total values. */
export function isUsable(reading) {
    return !!reading &&
        reading.status === Status.OK &&
        sanitizeBytes(reading.usedBytes) !== null &&
        sanitizeBytes(reading.totalBytes) !== null &&
        reading.totalBytes > 0 &&
        reading.usedBytes <= reading.totalBytes;
}
