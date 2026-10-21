// extension.js — GNOME Shell extension lifecycle and coordination.
//
// This module runs inside the GNOME Shell process. It wires the indicator,
// the monitor, and (from later phases) settings signals and the dropdown menu.
// It must never import GTK or Adwaita (those only work in the preferences
// process).

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Monitor } from './lib/monitor.js';
import { Status } from './lib/model.js';
import { Indicator } from './ui/indicator.js';

// The baseline polled every two seconds; the configurable default of ten
// seconds is introduced together with the settings schema.
const BASELINE_REFRESH_SECONDS = 2;

export default class VramRamExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        this._indicator.enable();

        // Transition-only error logging, preserving the baseline behaviour of
        // not spamming the journal on every poll.
        this._ramFailed = null;
        this._vramFailed = null;

        this._monitor = new Monitor({
            refreshSeconds: BASELINE_REFRESH_SECONDS,
            onSnapshot: snapshot => this._onSnapshot(snapshot),
        });
        this._monitor.start();
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
    }
}
