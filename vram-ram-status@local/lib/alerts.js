// lib/alerts.js — thresholds, cooldown, hysteresis and state transitions.
//
// Pure JavaScript: no Shell/St/GTK/Adwaita/GLib imports, so the state machine
// is testable headless. The Shell process feeds it a percentage (or null for
// unknown/stale readings) plus the configured thresholds, and persists the
// returned state across polls.

export const Level = Object.freeze({
    NONE: 'none',
    WARNING: 'warning',
    CRITICAL: 'critical',
});

/** Severity ordering, used to compare levels. */
const SEVERITY = Object.freeze({
    [Level.NONE]: 0,
    [Level.WARNING]: 1,
    [Level.CRITICAL]: 2,
});

/**
 * Classify a percentage against thresholds, ignoring hysteresis/cooldown.
 * Non-finite percentages map to no alert.
 */
export function classifyPercent(percent, warning, critical) {
    if (!Number.isFinite(percent))
        return Level.NONE;
    if (percent >= critical)
        return Level.CRITICAL;
    if (percent >= warning)
        return Level.WARNING;
    return Level.NONE;
}

/**
 * Evaluate one metric against its thresholds and previous state.
 *
 * Returns { level, transitioned, notify, state } where `state` is the value to
 * persist for the next poll ({ level, lastNotifyAt }). Notifications fire only
 * on a transition into warning/critical and are gated by the cooldown.
 * Unknown/stale readings (non-finite percent) suppress alerts entirely.
 */
export function evaluateAlert(percent, options, prevState) {
    const warning = options.warning;
    const critical = options.critical;
    const hysteresis = options.hysteresis;
    const cooldown = options.cooldown;
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const prev = prevState || { level: Level.NONE, lastNotifyAt: null };

    if (!Number.isFinite(percent)) {
        return {
            level: Level.NONE,
            transitioned: false,
            notify: false,
            state: { level: Level.NONE, lastNotifyAt: prev.lastNotifyAt },
        };
    }

    let level = Level.NONE;
    if (prev.level === Level.CRITICAL && percent >= critical - hysteresis) {
        // Hold critical until usage drops below critical - hysteresis.
        level = Level.CRITICAL;
    } else if (prev.level === Level.WARNING &&
               percent >= warning - hysteresis && percent < critical) {
        // Hold warning until usage drops below warning - hysteresis.
        level = Level.WARNING;
    } else {
        level = classifyPercent(percent, warning, critical);
    }

    const transitioned = level !== prev.level;
    const cooldownOk =
        prev.lastNotifyAt === null || now - prev.lastNotifyAt >= cooldown * 1000;
    const notify = level !== Level.NONE && transitioned && cooldownOk;

    return {
        level,
        transitioned,
        notify,
        state: { level, lastNotifyAt: notify ? now : prev.lastNotifyAt },
    };
}

/** Highest severity of two levels. */
export function maxLevel(a, b) {
    return SEVERITY[a] >= SEVERITY[b] ? a : b;
}
