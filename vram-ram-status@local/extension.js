// extension.js — GNOME Shell extension lifecycle and coordination.
//
// This module runs inside the GNOME Shell process. It wires the indicator,
// the monitor, and the GSettings signals. It must never import GTK or Adwaita
// (those only work in the preferences process).

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Monitor } from './lib/monitor.js';
import { Status } from './lib/model.js';
import { normalizeRefreshInterval } from './lib/settings.js';
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
];

export default class VramRamExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Transition-only error logging, preserving the baseline behaviour of
        // not spamming the journal on every poll.
        this._ramFailed = null;
        this._vramFailed = null;

        this._indicator = new Indicator(this._settings);
        this._indicator.enable();

        this._monitor = new Monitor({
            refreshSeconds: this._refreshInterval(),
            onSnapshot: snapshot => this._onSnapshot(snapshot),
            getSelectedGpu: () => this._settings.get_string('selected-gpu'),
        });
        this._monitor.start();

        this._signalIds = [
            this._settings.connect('changed::refresh-interval', () => {
                this._monitor.restart(this._refreshInterval());
            }),
            this._settings.connect('changed::selected-gpu', () => this._monitor.refreshNow()),
            this._settings.connect('changed::panel-box', () => this._recreateIndicator()),
            this._settings.connect('changed::panel-position', () => this._recreateIndicator()),
            ...DISPLAY_KEYS.map(key =>
                this._settings.connect(`changed::${key}`, () => this._monitor.refreshNow())),
        ];
    }

    _refreshInterval() {
        return normalizeRefreshInterval(this._settings.get_int('refresh-interval'));
    }

    _recreateIndicator() {
        if (this._indicator)
            this._indicator.destroy();
        this._indicator = new Indicator(this._settings);
        this._indicator.enable();
        if (this._monitor.last)
            this._indicator.update(this._monitor.last);
    }

    _onSnapshot(snapshot) {
        this._logTransitions(snapshot);
        this._indicator.update(snapshot);
    }

    _logTransitions(snapshot) {
        const ramFailed = snapshot.ram.status !== Status.OK;
        if (ramFailed !== this._ramFailed) {
            log(ramFailed
                ? 'vram-ram-status: RAM usage unavailable'
                : 'vram-ram-status: RAM reading recovered');
            this._ramFailed = ramFailed;
        }

        const vramFailed = snapshot.vram.status !== Status.OK;
        if (vramFailed !== this._vramFailed) {
            log(vramFailed
                ? 'vram-ram-status: VRAM usage unavailable'
                : 'vram-ram-status: VRAM reading recovered');
            this._vramFailed = vramFailed;
        }
    }

    disable() {
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
        this._settings = null;
    }
}

