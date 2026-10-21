// ui/indicator.js — St panel indicator: icons, per-metric values, dropdown menu.
//
// Runs inside the GNOME Shell process. Wraps a PanelMenu.Button (required by
// Main.panel.addToStatusArea) containing a horizontal St.BoxLayout that renders
// each visible metric as a sub-box of actors (marker, icon, numeric value,
// percentage), with the configured separator between metrics. Alert colors are
// applied per metric and per part (see the "color application mode" setting);
// the dropdown menu is delegated to Menu.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Format from '../lib/format.js';
import { Kind } from '../lib/model.js';
import { Level } from '../lib/alerts.js';
import * as Color from '../lib/color.js';
import { normalizeColorTarget, normalizePanelBox, normalizePanelPosition } from '../lib/settings.js';
import { Menu } from './menu.js';

const STATUS_AREA_ROLE = 'vram-ram-indicator';

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
        const color = this._colorOptions();
        const box = this._box;
        box.destroy_all_children();

        const metrics = this._visibleMetrics(snapshot, options);
        metrics.forEach((metric, index) => {
            if (index > 0)
                box.add_child(this._label(options.separator));
            this._appendMetric(box, metric, options, color);
        });

        this._menu.update(snapshot, {
            ramLevel: this._ramLevel,
            vramLevel: this._vramLevel,
            enableColors: color.enableColors,
            showNormalColor: color.showNormalColor,
            menuShowRam: this._settings.get_boolean('menu-show-ram'),
            menuShowVram: this._settings.get_boolean('menu-show-vram'),
        });
    }

    /** Record the current per-metric alert levels (colors are applied on render). */
    setLevels(ramLevel, vramLevel) {
        this._ramLevel = ramLevel;
        this._vramLevel = vramLevel;
    }

    _visibleMetrics(snapshot, options) {
        const order = options.metricOrder === 'ram-first'
            ? [Kind.RAM, Kind.VRAM]
            : [Kind.VRAM, Kind.RAM];
        const byKind = {
            [Kind.RAM]: { reading: snapshot.ram, format: options.ramFormat, show: options.showRam, level: this._ramLevel },
            [Kind.VRAM]: { reading: snapshot.vram, format: options.vramFormat, show: options.showVram, level: this._vramLevel },
        };
        return order
            .filter(kind => byKind[kind].show)
            .map(kind => ({
                kind,
                reading: byKind[kind].reading,
                format: byKind[kind].format,
                level: byKind[kind].level,
            }));
    }

    _appendMetric(box, { kind, reading, format, level }, options, color) {
        const parts = Format.formatMetricParts(kind, reading, {
            format,
            decimals: options.decimals,
            unitPlacement: options.unitPlacement,
        });

        const metricBox = new St.BoxLayout({
            style_class: 'vram-ram-metric',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const colorClass = Color.resolveColorClass(level, color);

        const marker = Color.markerForLevel(level);
        if (marker) {
            const markerLabel = this._label(marker);
            if (colorClass)
                markerLabel.add_style_class_name(colorClass);
            metricBox.add_child(markerLabel);
        }

        let icon = null;
        if (options.showIcons) {
            const iconInfo = METRIC_ICONS[kind] ?? METRIC_ICONS[Kind.VRAM];
            icon = new St.Icon({
                icon_name: iconInfo.iconName,
                icon_size: 16,
                accessible_name: iconInfo.accessibleName,
            });
            metricBox.add_child(icon);
        }

        let value = null;
        if (parts.value !== null) {
            value = this._label(parts.value);
            metricBox.add_child(value);
        }

        let percentage = null;
        if (parts.percent !== null) {
            percentage = this._label(parts.percent);
            metricBox.add_child(percentage);
        }

        if (colorClass)
            this._applyColor(colorClass, color.target, { metricBox, icon, value, percentage });

        box.add_child(metricBox);
    }

    _applyColor(colorClass, target, { metricBox, icon, value, percentage }) {
        if (target === 'icon' && icon)
            icon.add_style_class_name(colorClass);
        else if (target === 'value' && value)
            value.add_style_class_name(colorClass);
        else if (target === 'percentage' && percentage)
            percentage.add_style_class_name(colorClass);
        else
            metricBox.add_style_class_name(colorClass);
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

    /** Settings that determine alert colors (read once per render). */
    _colorOptions() {
        return {
            enableColors: this._settings.get_boolean('enable-colors'),
            showNormalColor: this._settings.get_boolean('show-normal-color'),
            target: normalizeColorTarget(this._settings.get_string('color-target')),
        };
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


