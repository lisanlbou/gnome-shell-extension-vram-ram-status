// prefs.js — GTK4/libadwaita preferences window.
//
// Runs in the standalone preferences process; never import Shell/St/Meta here.

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Discovery from './lib/gpu/discovery.js';
import * as IO from './lib/io.js';
import {
    FORMATS,
    METRIC_ORDERS,
    UNIT_PLACEMENTS,
    COLOR_TARGETS,
    PANEL_BOXES,
    REFRESH_INTERVALS,
    normalizeRefreshInterval,
} from './lib/settings.js';

const FORMAT_LABELS = {
    'percentage': 'Percentage',
    'used-only': 'Used only',
    'used-total': 'Used / total',
    'used-total-percent': 'Used / total + percentage',
    'used-percent': 'Used + percentage',
};

const METRIC_ORDER_LABELS = {
    'vram-first': 'VRAM first',
    'ram-first': 'RAM first',
};

const UNIT_PLACEMENT_LABELS = {
    'suffix': 'After value',
    'none': 'Hidden',
};

const COLOR_TARGET_LABELS = {
    'whole': 'Whole metric',
    'icon': 'Icon only',
    'value': 'Value only',
    'percentage': 'Percentage only',
};

const PANEL_BOX_LABELS = {
    'left': 'Left',
    'center': 'Center',
    'right': 'Right',
};

const REFRESH_LABELS = {
    1: '1 second',
    2: '2 seconds',
    5: '5 seconds',
    10: '10 seconds',
    15: '15 seconds',
    30: '30 seconds',
    60: '60 seconds',
};

export default class MemoryMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._buildDisplayPage(window);
        this._buildHardwarePage(window);
        this._buildMonitoringPage(window);
        this._buildAlertsPage(window);
        this._buildAboutPage(window);
    }

    // --- helpers -----------------------------------------------------------

    _stringCombo(group, { title, subtitle = null, key, choices, labels }) {
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

    _spinRow(group, { title, subtitle = null, key, lower, upper }) {
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

    _switchRow(group, { title, subtitle = null, key }) {
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
        this._switchRow(format, { title: 'Show icons', subtitle: 'Show a small RAM and GPU icon before each metric.', key: 'show-icons' });

        const menu = new Adw.PreferencesGroup({
            title: 'Dropdown menu',
            description: 'Sections shown in the panel menu, each with a progress bar colored by alert state.',
        });
        page.add(menu);
        this._switchRow(menu, { title: 'Show RAM in menu', key: 'menu-show-ram' });
        this._switchRow(menu, { title: 'Show VRAM in menu', key: 'menu-show-vram' });

        const placement = new Adw.PreferencesGroup({
            title: 'Panel placement',
            description: 'Where in the top panel the indicator appears.',
        });
        page.add(placement);

        this._stringCombo(placement, { title: 'Panel box', key: 'panel-box', choices: PANEL_BOXES, labels: PANEL_BOX_LABELS });
        this._spinRow(placement, { title: 'Panel position', subtitle: 'Index within the selected panel box.', key: 'panel-position', lower: 0, upper: 100 });
    }

    _buildHardwarePage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Hardware',
            icon_name: 'video-display-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'GPU selection',
            description: 'Which GPU\'s memory is shown in the panel. Devices are identified by stable PCI identity.',
        });
        page.add(group);

        const devices = Discovery.discover(IO);
        const choices = ['auto', 'all', ...devices.map(d => d.stableId)];
        const labels = { auto: 'Automatic', all: 'All GPUs' };
        for (const device of devices)
            labels[device.stableId] = device.displayName;

        this._stringCombo(group, { title: 'GPU', key: 'selected-gpu', choices, labels });

        if (devices.length === 0) {
            group.add(new Adw.ActionRow({
                title: 'No GPU detected',
                subtitle: 'No /sys/class/drm card devices were found.',
            }));
        }
    }

    _buildAlertsPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Alerts',
            icon_name: 'dialog-warning-symbolic',
        });
        window.add(page);

        const ram = new Adw.PreferencesGroup({
            title: 'RAM alerts',
            description: 'Thresholds color the RAM indicator; notifications are optional.',
        });
        page.add(ram);
        this._switchRow(ram, { title: 'Enable RAM notifications', subtitle: 'Notify on threshold transitions.', key: 'ram-alert-enabled' });
        this._spinRow(ram, { title: 'Warning threshold', subtitle: 'Percentage of RAM usage.', key: 'ram-warning', lower: 0, upper: 100 });
        this._spinRow(ram, { title: 'Critical threshold', subtitle: 'Percentage of RAM usage.', key: 'ram-critical', lower: 0, upper: 100 });

        const vram = new Adw.PreferencesGroup({
            title: 'VRAM alerts',
            description: 'Thresholds color the GPU indicator; notifications are optional.',
        });
        page.add(vram);
        this._switchRow(vram, { title: 'Enable VRAM notifications', subtitle: 'Notify on threshold transitions.', key: 'vram-alert-enabled' });
        this._spinRow(vram, { title: 'Warning threshold', subtitle: 'Percentage of VRAM usage.', key: 'vram-warning', lower: 0, upper: 100 });
        this._spinRow(vram, { title: 'Critical threshold', subtitle: 'Percentage of VRAM usage.', key: 'vram-critical', lower: 0, upper: 100 });

        const advanced = new Adw.PreferencesGroup({
            title: 'Advanced',
            description: 'Prevent alert flapping and repeated notifications.',
        });
        page.add(advanced);
        this._spinRow(advanced, { title: 'Cooldown', subtitle: 'Minimum seconds between notifications.', key: 'alert-cooldown', lower: 0, upper: 86400 });
        this._spinRow(advanced, { title: 'Hysteresis', subtitle: 'Percentage points below a threshold required to clear it.', key: 'alert-hysteresis', lower: 0, upper: 50 });

        const appearance = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Color warning, critical and (optionally) normal states, per metric or per part.',
        });
        page.add(appearance);
        this._switchRow(appearance, { title: 'Use colors', subtitle: 'Color the indicator for warning and critical states.', key: 'enable-colors' });
        this._switchRow(appearance, { title: 'Color normal state', subtitle: 'Color the indicator green when no alert is active.', key: 'show-normal-color' });
        this._stringCombo(appearance, { title: 'Color application', subtitle: 'Which part of each metric changes color.', key: 'color-target', choices: COLOR_TARGETS, labels: COLOR_TARGET_LABELS });
    }

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
            title: 'Memory Monitor',
            description: 'Displays system RAM and GPU memory from /proc/meminfo and sysfs. No network access, no root required.',
        });
        page.add(group);

        group.add(new Adw.ActionRow({ title: 'Version', subtitle: this.metadata['version-name'] }));
        group.add(new Adw.ActionRow({ title: 'Author', subtitle: 'lisanlbou@work_in_progress' }));
        group.add(new Adw.ActionRow({
            title: 'GPU support',
            subtitle: 'AMD dedicated VRAM is supported natively. Intel and NVIDIA are capability-detected and reported as unavailable when no supported backend is present.',
        }));
    }
}
