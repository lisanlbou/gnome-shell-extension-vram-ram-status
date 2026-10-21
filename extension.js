import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class VramRamExtension extends Extension {
    enable() {
        this._button = new PanelMenu.Button(0.0, 'VramRamStatus', false);
        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER
        });

        this._button.add_child(this._label);
        Main.panel.addToStatusArea('vram-ram-indicator', this._button);

        this._update();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }

    _readInt(path) {
        try {
            const [ok, contents] = GLib.file_get_contents(path);
            if (!ok) {
                log(`vram-ram-status: failed to read ${path}`);
                return null;
            }
            const text = new TextDecoder().decode(contents).trim();
            const value = Number.parseInt(text, 10);
            if (Number.isNaN(value)) {
                log(`vram-ram-status: unexpected content in ${path}: "${text}"`);
                return null;
            }
            return value;
        } catch (e) {
            logError(e, `vram-ram-status: error reading ${path}`);
            return null;
        }
    }

    _findVram() {
        const base = '/sys/class/drm/';
        let dir;
        try {
            dir = GLib.Dir.open(base, 0);
        } catch (e) {
            logError(e, `vram-ram-status: failed to open ${base}`);
            return null;
        }

        const names = [];
        let name;
        while ((name = dir.read_name()) !== null) {
            names.push(name);
        }
        dir.close();

        // Match only cardN directories, not connector dirs like card1-DP-1.
        const cardRe = /^card\d+$/;
        for (const name of names) {
            if (!cardRe.test(name)) {
                continue;
            }
            const used = this._readInt(`${base}${name}/device/mem_info_vram_used`);
            const total = this._readInt(`${base}${name}/device/mem_info_vram_total`);
            if (used !== null && total !== null && total > 0) {
                return { used, total };
            }
        }
        return null;
    }

    _readRam() {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/meminfo');
            if (!ok) {
                log('vram-ram-status: failed to read /proc/meminfo');
                return null;
            }
            const text = new TextDecoder().decode(contents);

            let total = null;
            let available = null;
            for (const line of text.split('\n')) {
                const totalMatch = line.match(/^MemTotal:\s+(\d+)\s*kB/);
                if (totalMatch) {
                    total = Number.parseInt(totalMatch[1], 10) * 1024;
                }
                const availMatch = line.match(/^MemAvailable:\s+(\d+)\s*kB/);
                if (availMatch) {
                    available = Number.parseInt(availMatch[1], 10) * 1024;
                }
                if (total !== null && available !== null) {
                    break;
                }
            }

            if (total === null || available === null) {
                log('vram-ram-status: MemTotal/MemAvailable not found in /proc/meminfo');
                return null;
            }
            return { used: total - available, total };
        } catch (e) {
            logError(e, 'vram-ram-status: error reading /proc/meminfo');
            return null;
        }
    }

    _formatGiB(bytes) {
        return (bytes / 1073741824).toFixed(1).replace(/\.0$/, '');
    }

    _update() {
        const vram = this._findVram();
        const ram = this._readRam();

        const vramFailed = vram === null;
        const ramFailed = ram === null;

        // Log only on state changes, so a persistent problem doesn't spam the
        // journal on every 2-second poll.
        if (vramFailed !== this._vramFailed) {
            log(vramFailed
                ? 'vram-ram-status: VRAM usage unavailable'
                : 'vram-ram-status: VRAM reading recovered');
            this._vramFailed = vramFailed;
        }
        if (ramFailed !== this._ramFailed) {
            log(ramFailed
                ? 'vram-ram-status: RAM usage unavailable'
                : 'vram-ram-status: RAM reading recovered');
            this._ramFailed = ramFailed;
        }

        const vramText = vram
            ? `V ${this._formatGiB(vram.used)}/${this._formatGiB(vram.total)}`
            : 'V N/A';
        const ramText = ram
            ? `R ${this._formatGiB(ram.used)}/${this._formatGiB(ram.total)} GiB`
            : 'R N/A';

        const label = `${vramText} | ${ramText}`;
        this._label.set_text(label);

        if (vram && ram) {
            this._button.tooltip_text =
                `VRAM ${this._formatGiB(vram.used)}/${this._formatGiB(vram.total)} GiB\n` +
                `RAM ${this._formatGiB(ram.used)}/${this._formatGiB(ram.total)} GiB`;
        } else {
            this._button.tooltip_text = label;
        }
    }
}
