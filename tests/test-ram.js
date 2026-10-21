// tests/test-ram.js — /proc/meminfo parser against fixture text.

import GLib from 'gi://GLib';

import { parseMeminfo } from '../vram-ram-status@local/lib/memory/ram.js';

function readFixture(name) {
    const here = import.meta.url.replace(/^file:\/\//, '');
    const dir = here.substring(0, here.lastIndexOf('/'));
    const path = `${dir}/fixtures/${name}`;
    const [ok, contents] = GLib.file_get_contents(path);
    if (!ok)
        throw new Error(`missing fixture: ${name}`);
    return new TextDecoder().decode(contents);
}

export function run(t) {
    const { eq } = t;

    // 32476244 kB total, 19840216 kB available
    eq(parseMeminfo(readFixture('meminfo-normal.txt')),
       { total: 33255673856, available: 20316381184, used: 12939292672 },
       'normal meminfo parses total/available/used');

    eq(parseMeminfo(readFixture('meminfo-missing-available.txt')), null, 'missing MemAvailable -> null');
    eq(parseMeminfo(readFixture('meminfo-zero-total.txt')), null, 'zero total -> null');
    eq(parseMeminfo(readFixture('meminfo-malformed.txt')), null, 'malformed total -> null');
    eq(parseMeminfo(readFixture('meminfo-huge.txt')), null, 'unusually large total -> null');

    // Inline edge cases.
    eq(parseMeminfo(null), null, 'null input -> null');
    eq(parseMeminfo(''), null, 'empty input -> null');
    eq(parseMeminfo('MemTotal:       100 kB\nMemAvailable:   200 kB\n'), null, 'available > total -> null');
}
