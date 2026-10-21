// tests/test-monitor-lifecycle.js — timer lifecycle against a fake scheduler.
//
// The Monitor's timer backend is injectable, so start/restart/stop and their
// re-entrancy behaviour are exercised deterministically without a live GLib
// main loop. The fake scheduler mirrors GLib's contract: `remove(id)` cancels
// a source, and a removed source never fires again.

import { Monitor } from '../vram-ram-status@local/lib/monitor.js';
import { amdIo, MEMINFO } from './fixtures.js';

/**
 * A minimal GLib-like timer backend. Each `add()` creates a recurring source
 * identified by an incrementing integer; `remove(id)` cancels it so subsequent
 * `fire(id)` calls are no-ops (exactly as GLib.source_remove behaves).
 */
class FakeScheduler {
    constructor() {
        this._nextId = 1;
        this._sources = new Map();
        this.added = [];
        this.removed = [];
    }

    add(seconds, callback) {
        const id = this._nextId++;
        this._sources.set(id, { seconds, callback });
        this.added.push({ id, seconds });
        return id;
    }

    remove(id) {
        this.removed.push(id);
        return this._sources.delete(id);
    }

    fire(id) {
        const source = this._sources.get(id);
        if (!source)
            return false;
        source.callback();
        return true;
    }

    activeIds() {
        return [...this._sources.keys()];
    }

    activeCount() {
        return this._sources.size;
    }
}

export function run(t) {
    const { eq } = t;

    // 1. start() schedules exactly one source and collects once immediately.
    {
        let snapshots = 0;
        const sched = new FakeScheduler();
        const m = new Monitor({ io: amdIo(), scheduler: sched, onSnapshot: () => snapshots++ });
        m.start();
        eq(sched.added.length, 1, 'start schedules one source');
        eq(sched.activeCount(), 1, 'one active source after start');
        eq(snapshots, 1, 'start collects once immediately');
        m.stop();
    }

    // 2. The recurring callback keeps `_timeout` valid, so the source stays
    //    cancellable after firing (the original bug cleared it on first tick).
    {
        let snapshots = 0;
        const sched = new FakeScheduler();
        const m = new Monitor({ io: amdIo(), scheduler: sched, onSnapshot: () => snapshots++ });
        m.start();
        const id = sched.activeIds()[0];
        sched.fire(id);
        sched.fire(id);
        eq(snapshots, 3, 'initial collect plus two fires');
        eq(sched.activeCount(), 1, 'source still active after recurring fires');
        m.stop();
        eq(sched.removed.includes(id), true, 'stop removes the active source');
        eq(sched.activeCount(), 0, 'no active source after stop');
        const after = snapshots;
        sched.fire(id);
        eq(snapshots, after, 'removed source does not fire again');
    }

    // 3. restart() removes the old source and adds exactly one new source.
    {
        const sched = new FakeScheduler();
        const m = new Monitor({ io: amdIo(), scheduler: sched });
        m.start();
        const firstId = sched.activeIds()[0];
        m.restart(5);
        eq(sched.removed.includes(firstId), true, 'restart removes the old source');
        eq(sched.activeCount(), 1, 'restart leaves exactly one active source');
        eq(sched.added.length, 2, 'restart added exactly one new source');
        eq(sched.activeIds()[0], sched.added[1].id, 'the new source is the active one');
        eq(sched.added[1].seconds, 5, 'the new source uses the new interval');
        m.stop();
    }

    // 4. Repeated start/restart/stop sequences never accumulate sources.
    {
        const sched = new FakeScheduler();
        const m = new Monitor({ io: amdIo(), scheduler: sched });
        for (let i = 0; i < 10; i++) {
            m.start();
            m.restart(2 + (i % 3));
        }
        eq(sched.activeCount(), 1, 'repeated start/restart keeps one active source');
        for (let i = 0; i < 10; i++)
            m.stop();
        eq(sched.activeCount(), 0, 'repeated stop keeps zero active sources');
        eq(m._timeout, 0, 'timeout id cleared after stop');
    }

    // 5. stop() invoked from inside onSnapshot cancels future fires.
    {
        let snapshots = 0;
        const sched = new FakeScheduler();
        let m;
        m = new Monitor({
            io: amdIo(),
            scheduler: sched,
            onSnapshot: () => {
                snapshots++;
                if (snapshots >= 2)
                    m.stop();
            },
        });
        m.start();
        const id = sched.activeIds()[0];
        sched.fire(id);
        eq(sched.activeCount(), 0, 'stop from the callback removes the source');
        const after = snapshots;
        sched.fire(id);
        eq(snapshots, after, 'no further snapshot after stop from callback');
    }

    // 6. restart() invoked from inside onSnapshot re-arms exactly once.
    {
        let snapshots = 0;
        const sched = new FakeScheduler();
        let m;
        m = new Monitor({
            io: amdIo(),
            scheduler: sched,
            onSnapshot: () => {
                snapshots++;
                if (snapshots === 2)
                    m.restart(60);
            },
        });
        m.start();
        const firstId = sched.activeIds()[0];
        sched.fire(firstId);
        eq(sched.removed.includes(firstId), true, 'restart from callback removes the old source');
        eq(sched.activeCount(), 1, 'restart from callback keeps one active source');
        const newId = sched.activeIds()[0];
        eq(newId !== firstId, true, 'the re-armed source is distinct');
        eq(sched.added[sched.added.length - 1].seconds, 60, 'the new interval is applied');
        m.stop();
    }
}
