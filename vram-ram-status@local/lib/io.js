// io.js — thin Shell-side file readers over GLib.
//
// This module imports GLib (not Shell/St/GTK), and is used only inside the
// GNOME Shell process. Parsers in lib/ stay pure by receiving text, while this
// module owns the actual sysfs/proc reads. All reads are synchronous local
// file reads of known /proc and /sys paths — never subprocesses.

import GLib from 'gi://GLib';

/** Read a whole file as UTF-8 text, or null on any error. */
export function readText(path) {
    try {
        const [ok, contents] = GLib.file_get_contents(path);
        if (!ok)
            return null;
        return new TextDecoder().decode(contents);
    } catch (e) {
        return null;
    }
}

/** List directory entry names, or [] on any error. */
export function listDir(path) {
    try {
        const dir = GLib.Dir.open(path, 0);
        const names = [];
        let name;
        while ((name = dir.read_name()) !== null)
            names.push(name);
        dir.close();
        return names;
    } catch (e) {
        return [];
    }
}
