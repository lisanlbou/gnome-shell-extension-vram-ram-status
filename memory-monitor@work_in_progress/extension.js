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

// Settings that only affect how the current snapshot is rendered (formats,
// visibility, alert colors, menu toggles); all are handled by re-rendering the
// latest snapshot on change.
const REFRESH_KEYS = [
    'ram-format',
    'vram-format',
    'metric-order',
    'decimals',
    'unit-placement',
    'separator',
    'show-ram',
    'show-vram',
    'show-icons',
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
    'menu-show-ram',
    'menu-show-vram',
];

export default class MemoryMonitorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Transition-only error logging, preserving the baseline behaviour of
        // not spamming the journal on every poll.
        this._ramFailed = false;
        this._vramFailed = false;

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
            ...REFRESH_KEYS.map(key =>
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
        for (const kind of ['ram', 'vram']) {
            const failed = snapshot[kind].status !== Status.OK;
            if (failed === this[`_${kind}Failed`])
                continue;
            const label = kind === 'ram' ? 'RAM' : 'VRAM';
            log(failed
                ? `memory-monitor: ${label} usage unavailable (${snapshot[kind].errorCode ?? 'unknown'})`
                : `memory-monitor: ${label} reading recovered`);
            this[`_${kind}Failed`] = failed;
        }
    }

    _processAlerts(snapshot) {
        const common = {
            hysteresis: this._settings.get_int('alert-hysteresis'),
            cooldown: this._settings.get_int('alert-cooldown'),
        };

        const levels = {};
        for (const kind of ['ram', 'vram']) {
            const thresholds = normalizeThresholdPair(
                this._settings.get_int(`${kind}-warning`),
                this._settings.get_int(`${kind}-critical`),
            );
            const result = this._evaluateAlert(kind, snapshot[kind], this._alertState[kind], {
                ...common,
                enabled: this._settings.get_boolean(`${kind}-alert-enabled`),
                warning: thresholds.warning,
                critical: thresholds.critical,
            });
            this._alertState[kind] = result.state;
            levels[kind] = result.level;
        }

        this._indicator.setLevels(levels.ram, levels.vram);
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
