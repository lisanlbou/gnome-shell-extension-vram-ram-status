// extension.js — GNOME Shell extension lifecycle and coordination.
//
// This module runs inside the GNOME Shell process. It wires the indicator,
// the monitor, the alert state machine, and the GSettings signals. It must
// never import GTK or Adwaita (those only work in the preferences process).

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as LoginManager from 'resource:///org/gnome/shell/misc/loginManager.js';

import * as Alerts from './lib/alerts.js';
import { Monitor } from './lib/monitor.js';
import { readingPercent, Status } from './lib/model.js';
import { notify } from './lib/notify.js';
import { normalizeRefreshInterval, normalizeThresholdPair } from './lib/settings.js';
import { Indicator } from './ui/indicator.js';

// Settings that only affect how the last snapshot is rendered (re-render on
// change rather than moving the panel actor).
const DISPLAY_KEYS = [
    'ram-format',
    'vram-format',
    'metric-order',
    'decimals',
    'unit-placement',
    'separator',
    'show-ram',
    'show-vram',
    'show-icons',
];

// Settings that affect alert evaluation/colors (re-evaluate immediately).
const ALERT_KEYS = [
    'ram-alert-enabled',
    'ram-warning',
    'ram-critical',
    'vram-alert-enabled',
    'vram-warning',
    'vram-critical',
    'alert-cooldown',
    'alert-hysteresis',
    'enable-colors',
    'color-target',
    'show-normal-color',
];

// Settings that only affect the dropdown menu (re-render on change).
const MENU_KEYS = [
    'menu-show-ram',
    'menu-show-vram',
];

export default class VramRamExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Transition-only error logging, preserving the baseline behaviour of
        // not spamming the journal on every poll.
        this._ramFailed = null;
        this._vramFailed = null;

        this._alertState = {
            ram: { level: Alerts.Level.NONE, lastNotifyAt: null },
            vram: { level: Alerts.Level.NONE, lastNotifyAt: null },
        };

        this._indicator = new Indicator(this._settings, () => this.openPreferences());
        this._indicator.enable();

        this._monitor = new Monitor({
            refreshSeconds: this._refreshInterval(),
            onSnapshot: snapshot => this._onSnapshot(snapshot),
            getSelectedGpu: () => this._settings.get_string('selected-gpu'),
        });
        this._monitor.start();

        this._loginManager = LoginManager.getLoginManager();
        this._loginManager.connectObject('prepare-for-sleep', (lm, aboutToSuspend) => {
            if (!aboutToSuspend && this._monitor)
                this._monitor.revalidate();
        }, this);

        this._signalIds = [
            this._settings.connect('changed::refresh-interval', () => {
                this._monitor.restart(this._refreshInterval());
            }),
            this._settings.connect('changed::selected-gpu', () => this._monitor.refreshNow()),
            this._settings.connect('changed::panel-box', () => this._recreateIndicator()),
            this._settings.connect('changed::panel-position', () => this._recreateIndicator()),
            ...DISPLAY_KEYS.map(key =>
                this._settings.connect(`changed::${key}`, () => this._monitor.refreshNow())),
            ...ALERT_KEYS.map(key =>
                this._settings.connect(`changed::${key}`, () => this._monitor.refreshNow())),
            ...MENU_KEYS.map(key =>
                this._settings.connect(`changed::${key}`, () => this._monitor.refreshNow())),
        ];
    }

    _refreshInterval() {
        return normalizeRefreshInterval(this._settings.get_int('refresh-interval'));
    }

    _recreateIndicator() {
        if (this._indicator)
            this._indicator.destroy();
        this._indicator = new Indicator(this._settings, () => this.openPreferences());
        this._indicator.enable();
        if (this._monitor.last) {
            this._reapplyAlertLevels();
            this._indicator.update(this._monitor.last);
        }
    }

    _onSnapshot(snapshot) {
        this._logTransitions(snapshot);
        this._processAlerts(snapshot);
        this._indicator.update(snapshot);
    }

    _logTransitions(snapshot) {
        const ramFailed = snapshot.ram.status !== Status.OK;
        if (ramFailed !== this._ramFailed) {
            log(ramFailed
                ? `vram-ram-status: RAM usage unavailable (${snapshot.ram.errorCode ?? 'unknown'})`
                : 'vram-ram-status: RAM reading recovered');
            this._ramFailed = ramFailed;
        }

        const vramFailed = snapshot.vram.status !== Status.OK;
        if (vramFailed !== this._vramFailed) {
            log(vramFailed
                ? `vram-ram-status: VRAM usage unavailable (${snapshot.vram.errorCode ?? 'unknown'})`
                : 'vram-ram-status: VRAM reading recovered');
            this._vramFailed = vramFailed;
        }
    }

    // ALERTS_INSERT
    _processAlerts(snapshot) {
        const common = {
            hysteresis: this._settings.get_int('alert-hysteresis'),
            cooldown: this._settings.get_int('alert-cooldown'),
        };
        const ramThresholds = normalizeThresholdPair(
            this._settings.get_int('ram-warning'),
            this._settings.get_int('ram-critical'),
        );
        const vramThresholds = normalizeThresholdPair(
            this._settings.get_int('vram-warning'),
            this._settings.get_int('vram-critical'),
        );

        const ram = this._evaluateAlert('ram', snapshot.ram, this._alertState.ram, {
            ...common,
            enabled: this._settings.get_boolean('ram-alert-enabled'),
            warning: ramThresholds.warning,
            critical: ramThresholds.critical,
        });
        const vram = this._evaluateAlert('vram', snapshot.vram, this._alertState.vram, {
            ...common,
            enabled: this._settings.get_boolean('vram-alert-enabled'),
            warning: vramThresholds.warning,
            critical: vramThresholds.critical,
        });

        this._alertState.ram = ram.state;
        this._alertState.vram = vram.state;

        this._indicator.setLevels(ram.level, vram.level);
    }

    _evaluateAlert(kind, reading, prevState, cfg) {
        const percent = readingPercent(reading);
        const result = Alerts.evaluateAlert(percent, {
            warning: cfg.warning,
            critical: cfg.critical,
            hysteresis: cfg.hysteresis,
            cooldown: cfg.cooldown,
            enabled: cfg.enabled,
            now: reading.timestamp ?? Date.now(),
        }, prevState);

        if (result.notify)
            this._notify(kind, result.level, Math.round(percent));
        return result;
    }

    _notify(kind, level, percent) {
        const label = kind === 'ram' ? 'RAM' : 'VRAM';
        notify(
            `${label} usage ${level}`,
            `${label} usage is ${percent}% (${level} threshold reached)`,
        );
    }

    _reapplyAlertLevels() {
        this._indicator.setLevels(this._alertState.ram.level, this._alertState.vram.level);
    }

    disable() {
        if (this._loginManager) {
            this._loginManager.disconnectObject(this);
            this._loginManager = null;
        }
        if (this._signalIds) {
            for (const id of this._signalIds)
                this._settings.disconnect(id);
            this._signalIds = null;
        }
        if (this._monitor) {
            this._monitor.stop();
            this._monitor = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._ramFailed = null;
        this._vramFailed = null;
        this._alertState = null;
        this._settings = null;
    }
}
