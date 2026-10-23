// tests/test-glib-timer.js — real GLib timer API used by the Monitor.
//
// Verifies that the modern `GLib.Source.remove(sourceId)` API (used by the
// Monitor's default scheduler) actually cancels a pending timeout source in
// this GJS/GLib version. Unlike the fake scheduler in test-monitor-lifecycle.js,
// this exercises the real GLib main context headlessly (no display needed).

import GLib from 'gi://GLib';

export function run(t) {
    const { eq } = t;

    eq(typeof GLib.Source.remove, 'function', 'GLib.Source.remove is available');

    let fired = false;
    const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
        fired = true;
        return GLib.SOURCE_REMOVE;
    });
    eq(id > 0, true, 'timeout source created');

    const removed = GLib.Source.remove(id);
    eq(removed, true, 'GLib.Source.remove cancels an active source');
    eq(fired, false, 'removed source has not fired yet');

    // Run a few non-blocking main-context iterations to prove the cancelled
    // source never fires again.
    const context = GLib.MainContext.default();
    for (let i = 0; i < 10; i++)
        context.iteration(false);
    eq(fired, false, 'cancelled source never fires');
}