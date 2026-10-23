// ui/indicator.js — St panel indicator: icons, per-metric values, dropdown menu.
//
// Runs inside the GNOME Shell process. Wraps a PanelMenu.Button (required by
// Main.panel.addToStatusArea) containing a horizontal St.BoxLayout that renders
// each visible metric as a sub-box of actors (marker, icon, numeric value,
// percentage), with the configured separator between metrics. Alert colors are
// applied per metric and per part (see the "color application mode" setting);
// the dropdown menu is delegated to Menu.

import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Format from '../lib/format.js';
import { Kind } from '../lib/model.js';
import { Level } from '../lib/alerts.js';
import * as Color from '../lib/color.js';
import { normalizeColorTarget, normalizePanelBox, normalizePanelPosition } from '../lib/settings.js';
import { Menu } from './menu.js';

const STATUS_AREA_ROLE = 'memory-monitor-indicator';

/**
 * Icon and accessible name for each metric kind ('ram' | 'vram').
 * RAM uses a memory-stick icon because Adwaita's 'computer-symbolic' and
 * 'video-display-symbolic' are the identical monitor glyph.
 */
const METRIC_ICONS = Object.freeze({
    [Kind.RAM]: { iconName: 'media-flash-symbolic', accessibleName: 'RAM' },
    [Kind.VRAM]: { iconName: 'video-display-symbolic', accessibleName: 'VRAM' },
});

export class Indicator {
    constructor(settings, openPreferences) {
        this._settings = settings;
        this._button = new PanelMenu.Button(0.0, 'Memory Monitor', false);
        this._box = new St.BoxLayout({
            style_class: 'memory-monitor-indicator',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._box);

        this._ramLevel = Level.NONE;
        this._vramLevel = Level.NONE;
        this._menu = new Menu(this._button, openPreferences);
        this._metrics = [];
        this._separators = [];
        this._lastLayoutKey = null;
    }

    /** Add the button to the panel using the configured box and index. */
    enable() {
        const box = normalizePanelBox(this._settings.get_string('panel-box'));
        const position = normalizePanelPosition(this._settings.get_int('panel-position'));
        Main.panel.addToStatusArea(STATUS_AREA_ROLE, this._button, position, box);
    }

    /**
     * Render a snapshot onto the panel box and dropdown. Panel actors are
     * reused across polls (rebuilt only when their structure changes); the
     * dropdown is delegated to Menu, which rebuilds lazily.
     */
    update(snapshot) {
        const options = this._displayOptions();
        const color = this._colorOptions();
        const metrics = this._visibleMetrics(snapshot, options);

        const partsByKind = {};
        for (const metric of metrics) {
            partsByKind[metric.kind] = Format.formatMetricParts(metric.kind, metric.reading, {
                format: metric.format,
                decimals: options.decimals,
                unitPlacement: options.unitPlacement,
            });
        }

        const key = this._layoutKey(metrics, options, partsByKind);
        if (key !== this._lastLayoutKey)
            this._rebuild(metrics, options, partsByKind, color);
        else
            this._updateInPlace(metrics, options, partsByKind, color);

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

    _layoutKey(metrics, options, partsByKind) {
        return metrics.map(metric => {
            const parts = partsByKind[metric.kind];
            const flags = [
                Color.markerForLevel(metric.level) ? 'm' : '-',
                options.showIcons ? 'i' : '-',
                parts.value !== null ? 'v' : '-',
                parts.percent !== null ? 'p' : '-',
            ].join('');
            return `${metric.kind}:${flags}`;
        }).join('|');
    }

    _rebuild(metrics, options, partsByKind, color) {
        const box = this._box;
        box.destroy_all_children();
        this._metrics = [];
        this._separators = [];

        metrics.forEach((metric, index) => {
            if (index > 0) {
                const separator = this._label(options.separator);
                this._separators.push(separator);
                box.add_child(separator);
            }
            this._createMetric(box, metric, partsByKind[metric.kind], options, color);
        });

        this._lastLayoutKey = this._layoutKey(metrics, options, partsByKind);
    }

    _updateInPlace(metrics, options, partsByKind, color) {
        metrics.forEach((metric, index) => {
            const desc = this._metrics[index];
            const parts = partsByKind[metric.kind];

            if (desc.marker)
                desc.marker.text = Color.markerForLevel(metric.level);
            if (desc.value)
                desc.value.text = parts.value;
            if (desc.percent)
                desc.percent.text = parts.percent;

            this._applyColorClasses(desc, metric.level, color);
        });

        for (const separator of this._separators)
            separator.text = options.separator;
    }

    _createMetric(box, { kind, level }, parts, options, color) {
        const metricBox = new St.BoxLayout({
            style_class: 'memory-monitor-metric',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const desc = {
            kind,
            box: metricBox,
            marker: null,
            markerClass: null,
            icon: null,
            value: null,
            percent: null,
            colorClass: null,
            colorTarget: null,
        };

        const marker = Color.markerForLevel(level);
        if (marker) {
            desc.marker = this._label(marker);
            metricBox.add_child(desc.marker);
        }

        if (options.showIcons) {
            const iconInfo = METRIC_ICONS[kind] ?? METRIC_ICONS[Kind.VRAM];
            desc.icon = new St.Icon({
                icon_name: iconInfo.iconName,
                icon_size: 16,
                accessible_name: iconInfo.accessibleName,
            });
            metricBox.add_child(desc.icon);
        }

        if (parts.value !== null) {
            desc.value = this._label(parts.value);
            metricBox.add_child(desc.value);
        }

        if (parts.percent !== null) {
            desc.percent = this._label(parts.percent);
            metricBox.add_child(desc.percent);
        }

        this._applyColorClasses(desc, level, color);

        box.add_child(metricBox);
        this._metrics.push(desc);
    }

    _colorActor(desc, target) {
        if (target === 'icon' && desc.icon)
            return desc.icon;
        if (target === 'value' && desc.value)
            return desc.value;
        if (target === 'percentage' && desc.percent)
            return desc.percent;
        return desc.box;
    }

    _applyColorClasses(desc, level, color) {
        const newClass = Color.resolveColorClass(level, color);

        // The textual marker is always colored when a color class applies.
        if (desc.marker) {
            if (desc.markerClass && desc.markerClass !== newClass)
                desc.marker.remove_style_class_name(desc.markerClass);
            if (newClass && newClass !== desc.markerClass)
                desc.marker.add_style_class_name(newClass);
            desc.markerClass = newClass;
        }

        // Re-apply the class to the targeted part (or the whole metric box).
        if (newClass !== desc.colorClass || color.target !== desc.colorTarget) {
            if (desc.colorClass)
                this._colorActor(desc, desc.colorTarget).remove_style_class_name(desc.colorClass);
            desc.colorClass = newClass;
            desc.colorTarget = color.target;
            if (newClass)
                this._colorActor(desc, color.target).add_style_class_name(newClass);
        }
    }

    _label(text) {
        const label = new St.Label({
            text,
            y_align: Clutter.ActorAlign.CENTER,
        });
        // St.Label ellipsizes by default (Pango.EllipsizeMode.END), so numeric
        // values such as "2.9/32G" get truncated to "2.9…" whenever the panel
        // is short on horizontal space. Disable ellipsization so the full
        // used/total and percentage text is always visible.
        label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        return label;
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
        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        this._box = null;
        this._metrics = [];
        this._separators = [];
        this._lastLayoutKey = null;
    }
}


