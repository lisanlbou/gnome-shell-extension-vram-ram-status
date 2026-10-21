// ui/indicator.js — St panel indicator: icons, per-metric values, dropdown menu.
//
// Runs inside the GNOME Shell process. Wraps a PanelMenu.Button (required by
// Main.panel.addToStatusArea) containing a horizontal St.BoxLayout that renders
// each visible metric as sub-actors (icon, numeric value, percentage), with the
// configured separator between metrics. The dropdown menu and warning/critical
// styling are delegated to Menu and the alert levels.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Format from '../lib/format.js';
import { Kind } from '../lib/model.js';
import { Level, maxLevel } from '../lib/alerts.js';
import { normalizePanelBox, normalizePanelPosition } from '../lib/settings.js';
import { Menu } from './menu.js';

const STATUS_AREA_ROLE = 'vram-ram-indicator';

const LEVEL_STYLE = Object.freeze({
    [Level.WARNING]: 'vram-ram-warning',
    [Level.CRITICAL]: 'vram-ram-critical',
});

/** Icon and accessible name for each metric kind ('ram' | 'vram'). */
const METRIC_ICONS = Object.freeze({
    [Kind.RAM]: { iconName: 'computer-symbolic', accessibleName: 'RAM' },
    [Kind.VRAM]: { iconName: 'video-display-symbolic', accessibleName: 'VRAM' },
});

export class Indicator {
    constructor(settings, openPreferences) {
        this._settings = settings;
        this._button = new PanelMenu.Button(0.0, 'VRAM & RAM Status', false);
        this._box = new St.BoxLayout({
            style_class: 'vram-ram-indicator',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._box);

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

    /** Render a snapshot onto the panel box and dropdown. */
    update(snapshot) {
        const options = this._displayOptions();
        const box = this._box;
        box.destroy_all_children();

        const marker = this._alertMarker();
        if (marker)
            box.add_child(this._label(marker));

        const metrics = this._visibleMetrics(snapshot, options);
        metrics.forEach((metric, index) => {
            if (index > 0)
                box.add_child(this._label(options.separator));
            this._appendMetric(box, metric, options);
        });

        this._menu.update(snapshot);
    }

    /** Set current alert levels and apply the matching color class. */
    setLevels(ramLevel, vramLevel) {
        this._ramLevel = ramLevel;
        this._vramLevel = vramLevel;

        this._box.remove_style_class_name(LEVEL_STYLE[Level.WARNING]);
        this._box.remove_style_class_name(LEVEL_STYLE[Level.CRITICAL]);

        if (!this._settings.get_boolean('enable-colors'))
            return;
        const style = LEVEL_STYLE[maxLevel(ramLevel, vramLevel)];
        if (style)
            this._box.add_style_class_name(style);
    }

    _visibleMetrics(snapshot, options) {
        const order = options.metricOrder === 'ram-first'
            ? [Kind.RAM, Kind.VRAM]
            : [Kind.VRAM, Kind.RAM];
        const byKind = {
            [Kind.RAM]: { reading: snapshot.ram, format: options.ramFormat, show: options.showRam },
            [Kind.VRAM]: { reading: snapshot.vram, format: options.vramFormat, show: options.showVram },
        };
        return order
            .filter(kind => byKind[kind].show)
            .map(kind => ({ kind, reading: byKind[kind].reading, format: byKind[kind].format }));
    }

    _appendMetric(box, { kind, reading, format }, options) {
        const parts = Format.formatMetricParts(kind, reading, {
            format,
            decimals: options.decimals,
            unitPlacement: options.unitPlacement,
        });

        if (options.showIcons) {
            const iconInfo = METRIC_ICONS[kind] ?? METRIC_ICONS[Kind.VRAM];
            box.add_child(new St.Icon({
                icon_name: iconInfo.iconName,
                icon_size: 16,
                accessible_name: iconInfo.accessibleName,
            }));
        }

        if (parts.value !== null)
            box.add_child(this._label(parts.value));
        if (parts.percent !== null)
            box.add_child(this._label(parts.percent));
    }

    _label(text) {
        return new St.Label({
            text,
            y_align: Clutter.ActorAlign.CENTER,
        });
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
            showIcons: this._settings.get_boolean('show-icons'),
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
        this._box = null;
        this._menu = null;
    }
}


