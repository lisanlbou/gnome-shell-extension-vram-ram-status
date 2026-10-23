// ui/menu.js — native PopupMenu rows for RAM, per-GPU memory and actions.
//
// Runs inside the GNOME Shell process. Uses GNOME-native PopupMenu components
// with plain-text St.Label rows (no Pango markup) so device names and numbers
// are never interpreted as markup. Each metric also gets a progress bar whose
// fill is colored by the alert level (warning/critical/optional normal); the
// textual percentage and the ⚠/⛔ marker keep state readable without color.

import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { _ } from '../lib/gettext.js';
import * as Format from '../lib/format.js';
import { Level } from '../lib/alerts.js';
import { markerForLevel, resolveBarFill } from '../lib/color.js';
import { MemoryClass, Status, readingFraction } from '../lib/model.js';
import { ProgressBar } from './progressBar.js';

/** Translate a memory class into a full, natural-language phrase. */
function memoryClassPhrase(cls) {
    switch (cls) {
        case MemoryClass.SYSTEM: return _('system memory');
        case MemoryClass.DEDICATED: return _('dedicated memory');
        case MemoryClass.VISIBLE: return _('visible memory');
        case MemoryClass.SHARED: return _('shared memory');
        case MemoryClass.LOCAL: return _('local memory');
        default: return _('unknown memory');
    }
}

/** Vendor keys are identifiers; only the "unknown" status word is translated. */
function providerLabel(provider) {
    return (provider && provider !== 'unknown') ? provider : _('unknown');
}

/**
 * Structural signature of a single plan row. It intentionally excludes dynamic
 * values (text, fraction, fill, accessible name) so a value-only change updates
 * in place rather than rebuilding; only row kind and — for separators — their
 * stable heading text distinguish one structure from another.
 */
function signatureFor(spec) {
    switch (spec.type) {
        case 'separator': return `sep:${spec.text}`;
        case 'label': return 'label';
        case 'bar': return 'bar';
        case 'prefs': return 'prefs';
    }
    return 'unknown';
}

export class Menu {
    constructor(button, openPreferences) {
        this._button = button;
        this._openPreferences = openPreferences;
        this._open = false;
        this._dirty = false;
        this._lastState = null;
        this._rows = [];
        this._openStateId = this._button.menu.connect('open-state-changed', (menu, open) => {
            this._open = open;
            if (open && this._dirty && this._lastState)
                this._render(this._lastState);
        });
    }

    /**
     * Store the latest snapshot/options and rebuild the menu only while it is
     * open. When closed, mark dirty and rebuild on the next open instead of
     * tearing down and recreating every popup item on every poll — except that
     * the first update populates the menu eagerly, because an empty PopupMenu
     * refuses to open (see open()/isEmpty() in GNOME's popupMenu.js).
     */
    update(snapshot, {
        ramLevel = Level.NONE,
        vramLevel = Level.NONE,
        enableColors = true,
        showNormalColor = false,
        menuShowRam = true,
        menuShowVram = true,
    } = {}) {
        this._lastState = {
            snapshot,
            ramLevel,
            vramLevel,
            enableColors,
            showNormalColor,
            menuShowRam,
            menuShowVram,
        };

        if (this._open) {
            this._render(this._lastState);
            this._dirty = false;
        } else if (this._button.menu.isEmpty()) {
            // GNOME 50's PopupMenu.open() returns early when the menu has no
            // visible items and never emits 'open-state-changed' in that case.
            // Since the first render was deferred to that signal, an empty menu
            // could never open at all. Populate it eagerly on the first update
            // so a later click can actually open it.
            this._render(this._lastState);
            this._dirty = false;
        } else {
            this._dirty = true;
        }
    }

    /** Disconnect the open-state handler before the button is torn down. */
    destroy() {
        if (this._openStateId) {
            this._button.menu.disconnect(this._openStateId);
            this._openStateId = 0;
        }
        this._lastState = null;
        this._rows = [];
        this._dirty = false;
    }

    _render({ snapshot, ramLevel, vramLevel, enableColors, showNormalColor, menuShowRam, menuShowVram }) {
        const plan = this._buildPlan({
            snapshot, ramLevel, vramLevel, enableColors, showNormalColor, menuShowRam, menuShowVram,
        });
        if (this._sameStructure(plan))
            this._updateRows(plan);
        else
            this._rebuildRows(plan);
    }

    _buildPlan({ snapshot, ramLevel, vramLevel, enableColors, showNormalColor, menuShowRam, menuShowVram }) {
        const color = { enableColors, showNormalColor };
        const plan = [];

        if (menuShowRam)
            this._ramPlan(plan, snapshot, ramLevel, color);
        if (menuShowVram)
            this._gpuPlan(plan, snapshot, vramLevel, color);

        plan.push({ type: 'separator', text: '' });
        plan.push({ type: 'label', text: this._lastUpdateText(snapshot) });
        plan.push({ type: 'separator', text: '' });
        plan.push({ type: 'prefs', text: _('Preferences') });

        return plan;
    }

    _ramPlan(plan, snapshot, level, color) {
        const ram = snapshot.ram;
        plan.push({ type: 'separator', text: 'RAM' });
        if (ram.status === Status.OK && ram.usedBytes !== null && ram.totalBytes !== null) {
            const available = ram.totalBytes - ram.usedBytes;
            const pct = Math.round((ram.usedBytes / ram.totalBytes) * 100);
            plan.push({
                type: 'bar',
                fraction: readingFraction(ram),
                fill: resolveBarFill(level, color),
                accessibleName: _('RAM usage %d%%').format(pct),
            });
            plan.push({
                type: 'label',
                text: this._marked(_('Used %s / %s GiB · Available %s GiB (%d%%)').format(
                    Format.formatGiB(ram.usedBytes),
                    Format.formatGiB(ram.totalBytes),
                    Format.formatGiB(available),
                    pct), level),
            });
        } else {
            plan.push({ type: 'label', text: _('Unavailable') });
        }
    }

    _gpuPlan(plan, snapshot, vramLevel, color) {
        const gpus = snapshot.gpus || [];
        if (gpus.length === 0) {
            plan.push({ type: 'separator', text: 'GPU' });
            plan.push({ type: 'label', text: _('No GPU detected') });
            return;
        }

        const primaryId = snapshot.vram?.deviceId ?? null;
        for (const { device, reading } of gpus) {
            const isPrimary = primaryId !== null && device.stableId === primaryId;
            const level = isPrimary ? vramLevel : Level.NONE;
            plan.push({ type: 'separator', text: device.displayName });
            if (reading.status === Status.OK && reading.usedBytes !== null && reading.totalBytes !== null) {
                const pct = Math.round((reading.usedBytes / reading.totalBytes) * 100);
                plan.push({
                    type: 'bar',
                    fraction: readingFraction(reading),
                    fill: resolveBarFill(level, color),
                    accessibleName: _('%s memory %d%%').format(device.displayName, pct),
                });
                plan.push({
                    type: 'label',
                    text: this._marked(_('Used %s / %s GiB (%d%%)').format(
                        Format.formatGiB(reading.usedBytes),
                        Format.formatGiB(reading.totalBytes),
                        pct), level),
                });
                plan.push({
                    type: 'label',
                    text: `${memoryClassPhrase(reading.memoryClass)} · ${providerLabel(reading.provider)}`,
                });
            } else {
                plan.push({
                    type: 'label',
                    text: _('Unavailable (%s)').format(memoryClassPhrase(reading.memoryClass)),
                });
            }
        }
    }

    _lastUpdateText(snapshot) {
        if (!snapshot.lastOkAt)
            return _('No successful update yet');
        return _('Updated %s').format(new Date(snapshot.lastOkAt).toLocaleTimeString());
    }

    _marked(text, level) {
        const marker = markerForLevel(level);
        return marker ? `${marker} ${text}` : text;
    }

    _sameStructure(plan) {
        if (this._rows.length !== plan.length)
            return false;
        for (let i = 0; i < plan.length; i++) {
            if (this._rows[i].signature !== signatureFor(plan[i]))
                return false;
        }
        return true;
    }

    /** Rebuild every row from scratch (only on structural changes). */
    _rebuildRows(plan) {
        const menu = this._button.menu;
        menu.removeAll();
        this._rows = plan.map(spec => this._createRow(menu, spec));
    }

    /** Update text/fill/accessible values in place, preserving the actor tree. */
    _updateRows(plan) {
        plan.forEach((spec, i) => {
            const row = this._rows[i];
            switch (spec.type) {
                case 'separator':
                    if (row.label)
                        row.label.text = spec.text;
                    break;
                case 'label':
                    row.label.text = spec.text;
                    break;
                case 'bar':
                    row.bar.setValue(spec.fraction, spec.fill);
                    row.bar.set_accessible_name(spec.accessibleName);
                    break;
                case 'prefs':
                    // The Preferences action text is static.
                    break;
            }
        });
    }

    _createRow(menu, spec) {
        switch (spec.type) {
            case 'separator': {
                const item = new PopupMenu.PopupSeparatorMenuItem(spec.text);
                menu.addMenuItem(item);
                return { type: 'separator', label: item.label, signature: signatureFor(spec) };
            }
            case 'label': {
                const item = new PopupMenu.PopupBaseMenuItem({
                    reactive: false,
                    can_focus: false,
                });
                const label = new St.Label({ text: spec.text });
                item.add_child(label);
                menu.addMenuItem(item);
                return { type: 'label', label, signature: signatureFor(spec) };
            }
            case 'bar': {
                const bar = new ProgressBar({
                    fraction: spec.fraction ?? 0,
                    fill: spec.fill,
                    accessible_name: spec.accessibleName,
                });
                const item = new PopupMenu.PopupBaseMenuItem({
                    reactive: false,
                    can_focus: false,
                });
                item.add_child(bar);
                menu.addMenuItem(item);
                return { type: 'bar', bar, signature: signatureFor(spec) };
            }
            case 'prefs': {
                const item = new PopupMenu.PopupMenuItem(spec.text);
                item.connect('activate', () => this._openPreferences());
                menu.addMenuItem(item);
                return { type: 'prefs', signature: signatureFor(spec) };
            }
        }
        throw new Error(`Unknown menu plan row type: ${spec.type}`);
    }
}
