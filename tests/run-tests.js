// tests/run-tests.js — headless unit test runner (no GNOME Shell required).
//
// Run with:  gjs -m tests/run-tests.js
//
// Only pure-logic modules (no Shell/St/GTK/Adwaita imports) are exercised here.
// Shell/UI behaviour is validated separately against a live GNOME Shell.

import { runSuite } from './harness.js';
import * as testModel from './test-model.js';
import * as testRam from './test-ram.js';
import * as testFormat from './test-format.js';
import * as testAmd from './test-amd.js';
import * as testCounters from './test-counters.js';
import * as testDiscovery from './test-discovery.js';
import * as testSelection from './test-selection.js';
import * as testProviders from './test-providers.js';
import * as testMonitor from './test-monitor.js';
import * as testMonitorLifecycle from './test-monitor-lifecycle.js';
import * as testMonitorRecovery from './test-monitor-recovery.js';
import * as testSettings from './test-settings.js';
import * as testAlerts from './test-alerts.js';
import * as testColor from './test-color.js';
import * as testGlibTimer from './test-glib-timer.js';

const suites = [
    ['model', testModel.run],
    ['ram', testRam.run],
    ['format', testFormat.run],
    ['amd', testAmd.run],
    ['counters', testCounters.run],
    ['discovery', testDiscovery.run],
    ['selection', testSelection.run],
    ['providers', testProviders.run],
    ['monitor', testMonitor.run],
    ['monitor-lifecycle', testMonitorLifecycle.run],
    ['monitor-recovery', testMonitorRecovery.run],
    ['settings', testSettings.run],
    ['alerts', testAlerts.run],
    ['color', testColor.run],
    ['glib-timer', testGlibTimer.run],
];

let passed = 0;
let failed = 0;

for (const [name, fn] of suites) {
    const r = runSuite(name, fn);
    passed += r.passed;
    failed += r.failed;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0)
    throw new Error(`${failed} test(s) failed`);
