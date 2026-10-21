// tests/test-alerts.js — threshold, hysteresis, cooldown state machine.

import { Level, classifyPercent, evaluateAlert, maxLevel } from '../vram-ram-status@local/lib/alerts.js';

const BASE = { warning: 80, critical: 90, hysteresis: 5, cooldown: 300 };

export function run(t) {
    const { eq } = t;

    // classifyPercent
    eq(classifyPercent(50, 80, 90), Level.NONE, 'below warning');
    eq(classifyPercent(85, 80, 90), Level.WARNING, 'warning range');
    eq(classifyPercent(95, 80, 90), Level.CRITICAL, 'critical range');
    eq(classifyPercent(null, 80, 90), Level.NONE, 'null -> none');
    eq(classifyPercent(NaN, 80, 90), Level.NONE, 'NaN -> none');

    // maxLevel
    eq(maxLevel(Level.NONE, Level.WARNING), Level.WARNING, 'max none/warning');
    eq(maxLevel(Level.WARNING, Level.CRITICAL), Level.CRITICAL, 'max warning/critical');

    // Startup already over threshold -> notify once.
    let r = evaluateAlert(95, { ...BASE, now: 1000000 });
    eq(r.level, Level.CRITICAL, 'startup over critical level');
    eq(r.notify, true, 'startup over critical notifies');

    // Same level again -> no notify.
    r = evaluateAlert(95, { ...BASE, now: 1001000 }, r.state);
    eq(r.notify, false, 'repeated level does not notify');

    // Escalate none -> warning -> critical.
    r = evaluateAlert(85, { ...BASE, now: 2000000 });
    eq(r.level, Level.WARNING, 'warning level');
    eq(r.notify, true, 'warning transition notifies');
    const warnState = r.state;

    r = evaluateAlert(92, { ...BASE, now: 2400000 }, warnState);
    eq(r.level, Level.CRITICAL, 'escalates to critical');
    eq(r.notify, true, 'escalation notifies after cooldown');

    // Hysteresis holds critical slightly below the threshold.
    r = evaluateAlert(87, { ...BASE, now: 2500000 }, { level: Level.CRITICAL, lastNotifyAt: null });
    eq(r.level, Level.CRITICAL, 'hysteresis holds critical');
    eq(r.notify, false, 'no notify while held');

    // Clear: drops below critical - hysteresis and warning - hysteresis.
    r = evaluateAlert(70, { ...BASE, now: 2600000 }, { level: Level.CRITICAL, lastNotifyAt: null });
    eq(r.level, Level.NONE, 'clears to none');
    eq(r.notify, false, 'clear does not notify');

    // Cooldown suppresses a transition that occurs too soon.
    r = evaluateAlert(95, { ...BASE, now: 3000000 }, { level: Level.NONE, lastNotifyAt: 2999500 });
    eq(r.notify, false, 'cooldown suppresses notification');
    eq(r.level, Level.CRITICAL, 'level still becomes critical');

    // Stale/unknown data suppresses alerts.
    r = evaluateAlert(null, { ...BASE, now: 4000000 }, { level: Level.CRITICAL, lastNotifyAt: null });
    eq(r.level, Level.NONE, 'stale -> none');
    eq(r.notify, false, 'stale does not notify');
}
