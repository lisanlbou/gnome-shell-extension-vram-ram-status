// ui/indicator.js — St panel label and positioning.
//
// Runs inside the GNOME Shell process. Wraps a PanelMenu.Button (required by
// Main.panel.addToStatusArea) containing a single St.Label. The dropdown menu
// is introduced in the later phase; here the button only carries a tooltip.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Format from '../lib/format.js';
import { Kind, Status } from '../lib/model.js';
import { DEFAULTS } from '../lib/settings.js';

const STATUS_AREA_ROLE = 'vram-ram-indicator';

export class Indicator {
    constructor() {
        this._button = new PanelMenu.Button(0.0, 'VRAM & RAM Status', false);
        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._label);
        this._button.tooltip_text = '';
    }

    /** Add the button to the panel in the requested box at the given index. */
    enable(box = DEFAULTS.panelBox, position = DEFAULTS.panelPosition) {
        Main.panel.addToStatusArea(STATUS_AREA_ROLE, this._button, position, box);
    }

    /** Render a snapshot onto the panel label and tooltip. */
    update(snapshot) {
        const vramText = Format.formatMetric(Kind.VRAM, snapshot.vram, Format.defaultOptions(Kind.VRAM));
        const ramText = Format.formatMetric(Kind.RAM, snapshot.ram, Format.defaultOptions(Kind.RAM));
        const label = `${vramText} | ${ramText}`;
        this._label.set_text(label);
        this._button.tooltip_text = this._tooltip(snapshot, label);
    }

    _tooltip(snapshot, fallback) {
        const vram = snapshot.vram;
        const ram = snapshot.ram;
        const vramOk = vram.status === Status.OK && vram.usedBytes !== null && vram.totalBytes !== null;
        const ramOk = ram.status === Status.OK && ram.usedBytes !== null && ram.totalBytes !== null;
        if (vramOk && ramOk) {
            return `VRAM ${Format.formatGiB(vram.usedBytes)}/${Format.formatGiB(vram.totalBytes)} GiB\n` +
                `RAM ${Format.formatGiB(ram.usedBytes)}/${Format.formatGiB(ram.totalBytes)} GiB`;
        }
        return fallback;
    }

    destroy() {
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        this._label = null;
    }
}
