// prefs.js — GTK4/libadwaita preferences window.
//
// Runs in the standalone preferences process; never import Shell/St/Meta here.

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const VERSION = '2.0.0';

const FORMATS = ['used-total', 'percentage', 'used-only', 'used-percent', 'full'];
const FORMAT_LABELS = {
    'used-total': 'Used / total',
    'percentage': 'Percentage',
    'used-only': 'Used only',
    'used-percent': 'Used + percentage',
    'full': 'Full labels',
};

const METRIC_ORDERS = ['vram-first', 'ram-first'];
const METRIC_ORDER_LABELS = {
    'vram-first': 'VRAM first',
    'ram-first': 'RAM first',
};

const UNIT_PLACEMENTS = ['suffix', 'none'];
const UNIT_PLACEMENT_LABELS = {
    'suffix': 'After value',
    'none': 'Hidden',
};

const PANEL_BOXES = ['left', 'center', 'right'];
const PANEL_BOX_LABELS = {
    'left': 'Left',
    'center': 'Center',
    'right': 'Right',
};

const REFRESH_INTERVALS = [1, 2, 5, 10, 15, 30, 60];
const REFRESH_LABELS = {
    1: '1 second',
    2: '2 seconds',
    5: '5 seconds',
    10: '10 seconds',
    15: '15 seconds',
    30: '30 seconds',
    60: '60 seconds',
};

export default class VramRamPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._buildDisplayPage(window);
        this._buildMonitoringPage(window);
        this._buildAboutPage(window);
    }

    // --- helpers -----------------------------------------------------------

    _stringCombo(group, { title, subtitle, key, choices, labels }) {
        const model = new Gtk.StringList();
        for (const choice of choices)
            model.append(labels[choice] ?? choice);
        const row = new Adw.ComboRow({
            title,
            subtitle,
            model,
            selected: Math.max(0, choices.indexOf(this._settings.get_string(key))),
        });
        row.connect('notify::selected', () => {
            if (row.selected >= 0)
                this._settings.set_string(key, choices[row.selected]);
        });
        group.add(row);
        return row;
    }

    _spinRow(group, { title, subtitle, key, lower, upper }) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            adjustment: new Gtk.Adjustment({ lower, upper, step_increment: 1 }),
            value: this._settings.get_int(key),
        });
        row.connect('notify::value', () => {
            this._settings.set_int(key, Math.round(row.value));
        });
        group.add(row);
        return row;
    }

    _switchRow(group, { title, subtitle, key }) {
        const row = new Adw.SwitchRow({
            title,
            subtitle,
            active: this._settings.get_boolean(key),
        });
        row.connect('notify::active', () => {
            this._settings.set_boolean(key, row.active);
        });
        group.add(row);
        return row;
    }

    // --- pages -------------------------------------------------------------

    _buildDisplayPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Display',
            icon_name: 'video-display-symbolic',
        });
        window.add(page);

        const format = new Adw.PreferencesGroup({
            title: 'Format',
            description: 'How RAM and VRAM are rendered in the panel.',
        });
        page.add(format);

        this._stringCombo(format, { title: 'RAM format', key: 'ram-format', choices: FORMATS, labels: FORMAT_LABELS });
        this._stringCombo(format, { title: 'VRAM format', key: 'vram-format', choices: FORMATS, labels: FORMAT_LABELS });
        this._stringCombo(format, { title: 'Metric order', key: 'metric-order', choices: METRIC_ORDERS, labels: METRIC_ORDER_LABELS });
        this._spinRow(format, { title: 'Decimal precision', subtitle: 'Digits after the decimal point.', key: 'decimals', lower: 0, upper: 3 });
        this._stringCombo(format, { title: 'Unit placement', key: 'unit-placement', choices: UNIT_PLACEMENTS, labels: UNIT_PLACEMENT_LABELS });

        const separatorRow = new Adw.EntryRow({
            title: 'Separator',
            text: this._settings.get_string('separator'),
        });
        separatorRow.connect('notify::text', () => {
            this._settings.set_string('separator', separatorRow.text);
        });
        format.add(separatorRow);

        this._switchRow(format, { title: 'Show RAM', key: 'show-ram' });
        this._switchRow(format, { title: 'Show VRAM', key: 'show-vram' });

        const placement = new Adw.PreferencesGroup({
            title: 'Panel placement',
            description: 'Where in the top panel the indicator appears.',
        });
        page.add(placement);

        this._stringCombo(placement, { title: 'Panel box', key: 'panel-box', choices: PANEL_BOXES, labels: PANEL_BOX_LABELS });
        this._spinRow(placement, { title: 'Panel position', subtitle: 'Index within the selected panel box.', key: 'panel-position', lower: 0, upper: 100 });
    }

    // PAGES_INSERT
    _buildMonitoringPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Monitoring',
            icon_name: 'utilities-system-monitor-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Refresh',
            description: 'How often metrics are collected. Changes apply immediately.',
        });
        page.add(group);

        const model = new Gtk.StringList();
        for (const interval of REFRESH_INTERVALS)
            model.append(REFRESH_LABELS[interval]);
        const current = normalizeRefreshInterval(this._settings.get_int('refresh-interval'));
        const row = new Adw.ComboRow({
            title: 'Refresh interval',
            model,
            selected: Math.max(0, REFRESH_INTERVALS.indexOf(current)),
        });
        row.connect('notify::selected', () => {
            if (row.selected >= 0)
                this._settings.set_int('refresh-interval', REFRESH_INTERVALS[row.selected]);
        });
        group.add(row);
    }

    _buildAboutPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'VRAM & RAM Status',
            description: 'Displays system RAM and GPU memory from /proc/meminfo and sysfs. No network access, no root required.',
        });
        page.add(group);

        group.add(new Adw.ActionRow({ title: 'Version', subtitle: VERSION }));
        group.add(new Adw.ActionRow({ title: 'Author', subtitle: 'lisandro@local' }));
        group.add(new Adw.ActionRow({
            title: 'GPU support',
            subtitle: 'AMD dedicated VRAM is supported natively. Intel and NVIDIA are capability-detected and reported as unavailable when no supported backend is present.',
        }));
    }
}

function normalizeRefreshInterval(value) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return 10;
    let best = REFRESH_INTERVALS[0];
    let bestDelta = Infinity;
    for (const interval of REFRESH_INTERVALS) {
        const delta = Math.abs(interval - n);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = interval;
        }
    }
    return best;
}
