// tests/test-monitor-recovery.js — controlled error recovery in _collect().
//
// Verifies that collection and callback failures degrade gracefully instead of
// propagating to GLib, that single-stage failures do not take down the whole
// snapshot, and that diagnostics are logged transitionally (once per scope).

import { Monitor } from '../vram-ram-status@local/lib/monitor.js';
import { Status } from '../vram-ram-status@local/lib/model.js';

const MEMINFO = 'MemTotal:       32476244 kB\nMemAvailable:   19840216 kB\n';

function amdIo() {
    const files = {
        '/proc/meminfo': MEMINFO,
        '/sys/class/drm/card1/device/vendor': '0x1002',
        '/sys/class/drm/card1/device/uevent': 'DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n',
        '/sys/class/drm/card1/device/mem_info_vram_used': '3000705024',
        '/sys/class/drm/card1/device/mem_info_vram_total': '34359738368',
    };
    return {
        readText: path => (path in files ? files[path] : null),
        listDir: () => ['card1', 'card1-DP-1', 'renderD128', 'version'],
    };
}

export function run(t) {
    const { eq } = t;

    // 1. A throwing provider degrades one GPU without affecting RAM or others.
    {
        const files = {
            '/proc/meminfo': MEMINFO,
            '/sys/class/drm/card0/device/vendor': '0x8086',
            '/sys/class/drm/card0/device/uevent': 'DRIVER=i915\nPCI_SLOT_NAME=0000:00:02.0\n',
            '/sys/class/drm/card1/device/vendor': '0x1002',
            '/sys/class/drm/card1/device/uevent': 'DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n',
        };
        const io = {
            readText: path => {
                if (path.startsWith('/sys/class/drm/card1/device/mem_info_vram'))
                    throw new Error('io read failure');
                return (path in files ? files[path] : null);
            },
            listDir: () => ['card0', 'card1', 'version'],
        };
        const snap = new Monitor({ io }).collect();
        eq(snap.ram.status, Status.OK, 'RAM unaffected by throwing provider');
        eq(snap.gpus[0].reading.status, Status.UNAVAILABLE, 'Intel shared unaffected');
        eq(snap.gpus[0].reading.errorCode, 'intel-shared-memory', 'Intel error code preserved');
        eq(snap.gpus[1].reading.status, Status.ERROR, 'throwing AMD provider -> error reading');
        eq(snap.gpus[1].reading.errorCode, 'provider-error', 'provider-error code');
    }

    // 2. A throwing meminfo read degrades RAM only, leaving VRAM intact.
    {
        const files = {
            '/sys/class/drm/card1/device/vendor': '0x1002',
            '/sys/class/drm/card1/device/uevent': 'DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n',
            '/sys/class/drm/card1/device/mem_info_vram_used': '3000705024',
            '/sys/class/drm/card1/device/mem_info_vram_total': '34359738368',
        };
        const io = {
            readText: path => {
                if (path === '/proc/meminfo')
                    throw new Error('meminfo read failure');
                return (path in files ? files[path] : null);
            },
            listDir: () => ['card1', 'version'],
        };
        const snap = new Monitor({ io }).collect();
        eq(snap.ram.status, Status.ERROR, 'RAM read failure -> error');
        eq(snap.ram.errorCode, 'ram-read-failed', 'ram-read-failed code');
        eq(snap.vram.status, Status.OK, 'VRAM unaffected by RAM failure');
    }

    // 3. A throwing onSnapshot callback is swallowed and monitoring continues.
    {
        const logs = [];
        let shouldThrow = true;
        let delivered = 0;
        const m = new Monitor({
            io: amdIo(),
            logger: msg => logs.push(msg),
            onSnapshot: () => {
                delivered++;
                if (shouldThrow)
                    throw new Error('callback boom');
            },
        });
        m.refreshNow();
        eq(delivered, 1, 'snapshot delivered despite throwing callback');
        eq(logs.filter(l => l.includes('snapshot failed')).length, 1, 'snapshot failure logged once');
        m.refreshNow();
        eq(logs.filter(l => l.includes('snapshot failed')).length, 1, 'snapshot failure not re-logged');
        shouldThrow = false;
        m.refreshNow();
        eq(delivered, 3, 'monitoring continues after callback recovery');
        eq(logs.filter(l => l.includes('snapshot recovered')).length, 1, 'snapshot recovery logged once');
    }

    // 4. A total collection throw yields a degraded snapshot and no exception.
    {
        const logs = [];
        let fail = true;
        const m = new Monitor({
            io: amdIo(),
            logger: msg => logs.push(msg),
            getSelectedGpu: () => {
                if (fail)
                    throw new Error('boom');
                return 'auto';
            },
        });
        m.refreshNow();
        eq(m.last.ram.status, Status.ERROR, 'degraded RAM status');
        eq(m.last.ram.errorCode, 'collect-failed', 'degraded RAM code');
        eq(m.last.vram.status, Status.ERROR, 'degraded VRAM status');
        eq(m.last.gpus.length, 0, 'degraded snapshot has no GPUs');
        eq(logs.filter(l => l.includes('collection failed')).length, 1, 'collection failure logged once');
        m.refreshNow();
        eq(logs.filter(l => l.includes('collection failed')).length, 1, 'collection failure not re-logged');
        fail = false;
        m.refreshNow();
        eq(m.last.ram.status, Status.OK, 'collection recovers');
        eq(logs.filter(l => l.includes('collection recovered')).length, 1, 'collection recovery logged once');
    }

    // 5. A throwing discovery keeps existing devices and retries next poll.
    {
        const logs = [];
        let listThrows = true;
        const io = {
            readText: path => (path === '/proc/meminfo' ? MEMINFO : null),
            listDir: () => {
                if (listThrows)
                    throw new Error('listdir boom');
                return ['card1', 'version'];
            },
        };
        const m = new Monitor({ io, logger: msg => logs.push(msg) });
        const snap = m.collect();
        eq(snap.vram.status, Status.UNAVAILABLE, 'no GPU after discovery failure');
        eq(snap.vram.errorCode, 'no-gpu', 'no-gpu code after discovery failure');
        eq(logs.filter(l => l.includes('discovery failed')).length, 1, 'discovery failure logged once');
        listThrows = false;
        m.collect();
        eq(logs.filter(l => l.includes('discovery recovered')).length, 1, 'discovery recovery logged once');
    }
}
