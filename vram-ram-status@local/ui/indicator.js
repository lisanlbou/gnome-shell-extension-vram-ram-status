// ui/indicator.js — St panel label and positioning.
//
// Runs inside the GNOME Shell process. Wraps a PanelMenu.Button (required by
// Main.panel.addToStatusArea) containing a single St.Label. The dropdown menu
// is introduced in a later phase; here the button only carries a tooltip.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Format from '../lib/format.js';
import { Status } from '../lib/model.js';
import { normalizePanelBox, normalizePanelPosition } from '../lib/settings.js';

const STATUS_AREA_ROLE = 'vram-ram-indicator';

export class Indicator {
    constructor(settings) {
        this._settings = settings;
        this._button = new PanelMenu.Button(0.0, 'VRAM & RAM Status', false);
        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._label);
        this._button.tooltip_text = '';
    }

    /** Add the button to the panel using the configured box and index. */
    enable() {
        const box = normalizePanelBox(this._settings.get_string('panel-box'));
        const position = normalizePanelPosition(this._settings.get_int('panel-position'));
        Main.panel.addToStatusArea(STATUS_AREA_ROLE, this._button, position, box);
    }

    /** Render a snapshot onto the panel label and tooltip. */
    update(snapshot) {
        const label = Format.formatLabel(snapshot, this._displayOptions());
        this._label.set_text(label);
        this._button.tooltip_text = this._tooltip(snapshot, label);
    }

    _displayOptions() {
        return {
            ramFormat: this._settings.get_string('ram-format'),
            vramFormat: this._settings.get_string('vram-format'),
            metricOrder: this._settings.get_string('metric-order'),
            decimals: this._settings.get_int('decimals'),
            unitPlacement: this._settings.get_string('unit-placement'),
            separator: this._settings.get_string('separator'),
            showRam: this._settings.get_boolean('show-ram'),
            showVram: this._settings.get_boolean('show-vram'),
        };
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

