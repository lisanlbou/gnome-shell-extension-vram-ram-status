// ui/indicator.js — St panel label, positioning, colors and dropdown menu.
//
// Runs inside the GNOME Shell process. Wraps a PanelMenu.Button (required by
// Main.panel.addToStatusArea) containing a single St.Label. The dropdown menu
// and warning/critical styling are delegated to Menu and the alert levels.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Format from '../lib/format.js';
import { Level, maxLevel } from '../lib/alerts.js';
import { normalizePanelBox, normalizePanelPosition } from '../lib/settings.js';
import { Menu } from './menu.js';

const STATUS_AREA_ROLE = 'vram-ram-indicator';

const LEVEL_STYLE = Object.freeze({
    [Level.WARNING]: 'vram-ram-warning',
    [Level.CRITICAL]: 'vram-ram-critical',
});

export class Indicator {
    constructor(settings, openPreferences) {
        this._settings = settings;
        this._button = new PanelMenu.Button(0.0, 'VRAM & RAM Status', false);
        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._label);

        this._ramLevel = Level.NONE;
        this._vramLevel = Level.NONE;
        this._menu = new Menu(this._button, openPreferences);
    }

    /** Add the button to the panel using the configured box and index. */
    enable() {
        const box = normalizePanelBox(this._settings.get_string('panel-box'));
        const position = normalizePanelPosition(this._settings.get_int('panel-position'));
        Main.panel.addToStatusArea(STATUS_AREA_ROLE, this._button, position, box);
    }

    /** Render a snapshot onto the panel label and dropdown. */
    update(snapshot) {
        const label = Format.formatLabel(snapshot, this._displayOptions());
        this._label.set_text(this._alertMarker() + label);
        this._menu.update(snapshot);
    }

    /** Set current alert levels and apply the matching color class. */
    setLevels(ramLevel, vramLevel) {
        this._ramLevel = ramLevel;
        this._vramLevel = vramLevel;

        this._label.remove_style_class_name(LEVEL_STYLE[Level.WARNING]);
        this._label.remove_style_class_name(LEVEL_STYLE[Level.CRITICAL]);

        if (!this._settings.get_boolean('enable-colors'))
            return;
        const style = LEVEL_STYLE[maxLevel(ramLevel, vramLevel)];
        if (style)
            this._label.add_style_class_name(style);
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

    /**
     * A textual alert marker, so warning/critical state is visible without
     * relying on color (and readable by screen readers). Empty when no alert.
     */
    _alertMarker() {
        const level = maxLevel(this._ramLevel, this._vramLevel);
        if (level === Level.CRITICAL)
            return '\u26D4 '; // ⛔ no entry
        if (level === Level.WARNING)
            return '\u26A0 '; // ⚠ warning sign
        return '';
    }

    destroy() {
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        this._label = null;
        this._menu = null;
    }
}


