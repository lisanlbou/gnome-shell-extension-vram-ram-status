// ui/menu.js — native PopupMenu rows for RAM, per-GPU memory and actions.
//
// Runs inside the GNOME Shell process. Uses GNOME-native PopupMenu components
// with plain-text St.Label rows (no Pango markup) so device names and numbers
// are never interpreted as markup. Each metric also gets a progress bar whose
// fill is colored by the alert level (warning/critical/optional normal); the
// textual percentage and the ⚠/⛔ marker keep state readable without color.

import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Format from '../lib/format.js';
import { Level } from '../lib/alerts.js';
import { markerForLevel, resolveBarFill } from '../lib/color.js';
import { MemoryClass, Status, readingFraction } from '../lib/model.js';
import { ProgressBar } from './progressBar.js';

const MEMORY_CLASS_LABELS = Object.freeze({
    [MemoryClass.SYSTEM]: 'system',
    [MemoryClass.DEDICATED]: 'dedicated',
    [MemoryClass.SHARED]: 'shared',
    [MemoryClass.LOCAL]: 'local',
    [MemoryClass.UNKNOWN]: 'unknown',
});

export class Menu {
    constructor(button, openPreferences) {
        this._button = button;
        this._openPreferences = openPreferences;
    }

    /** Rebuild the button's menu from a snapshot and the current options. */
    update(snapshot, {
        ramLevel = Level.NONE,
        vramLevel = Level.NONE,
        enableColors = true,
        showNormalColor = false,
        menuShowRam = true,
        menuShowVram = true,
    } = {}) {
        const menu = this._button.menu;
        menu.removeAll();

        const color = { enableColors, showNormalColor };

        if (menuShowRam)
            this._addRamSection(menu, snapshot, ramLevel, color);
        if (menuShowVram)
            this._addGpuSections(menu, snapshot, vramLevel, color);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(''));
        this._addLabelRow(menu, this._lastUpdateText(snapshot));

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(''));
        const prefs = new PopupMenu.PopupMenuItem('Preferences');
        prefs.connect('activate', () => this._openPreferences());
        menu.addMenuItem(prefs);
    }

    _lastUpdateText(snapshot) {
        if (!snapshot.lastOkAt)
            return 'No successful update yet';
        return `Updated ${new Date(snapshot.lastOkAt).toLocaleTimeString()}`;
    }

    _addLabelRow(menu, text) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        item.add_child(new St.Label({ text }));
        menu.addMenuItem(item);
    }

    _addBarRow(menu, fraction, level, color, accessibleName) {
        const bar = new ProgressBar({
            fraction: fraction ?? 0,
            fill: resolveBarFill(level, color),
            accessible_name: accessibleName,
        });
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        item.add_child(bar);
        menu.addMenuItem(item);
    }

    _marked(text, level) {
        const marker = markerForLevel(level);
        return marker ? `${marker} ${text}` : text;
    }

    _addRamSection(menu, snapshot, level, color) {
        const ram = snapshot.ram;
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('RAM'));
        if (ram.status === Status.OK && ram.usedBytes !== null && ram.totalBytes !== null) {
            const available = ram.totalBytes - ram.usedBytes;
            const pct = Math.round((ram.usedBytes / ram.totalBytes) * 100);
            this._addBarRow(menu, readingFraction(ram), level, color, `RAM usage ${pct}%`);
            this._addLabelRow(menu, this._marked(
                `Used ${Format.formatGiB(ram.usedBytes)} / ${Format.formatGiB(ram.totalBytes)} GiB` +
                ` · Available ${Format.formatGiB(available)} GiB (${pct}%)`, level));
        } else {
            this._addLabelRow(menu, 'Unavailable');
        }
    }

    _addGpuSections(menu, snapshot, vramLevel, color) {
        const gpus = snapshot.gpus || [];
        if (gpus.length === 0) {
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('GPU'));
            this._addLabelRow(menu, 'No GPU detected');
            return;
        }

        const primaryId = snapshot.vram?.deviceId ?? null;
        for (const { device, reading } of gpus) {
            const isPrimary = primaryId !== null && device.stableId === primaryId;
            const level = isPrimary ? vramLevel : Level.NONE;
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(device.displayName));
            if (reading.status === Status.OK && reading.usedBytes !== null && reading.totalBytes !== null) {
                const pct = Math.round((reading.usedBytes / reading.totalBytes) * 100);
                const cls = MEMORY_CLASS_LABELS[reading.memoryClass] ?? reading.memoryClass;
                this._addBarRow(menu, readingFraction(reading), level, color,
                    `${device.displayName} memory ${pct}%`);
                this._addLabelRow(menu, this._marked(
                    `Used ${Format.formatGiB(reading.usedBytes)} / ${Format.formatGiB(reading.totalBytes)} GiB (${pct}%)`,
                    level));
                this._addLabelRow(menu, `${cls} memory · ${reading.provider ?? 'unknown'}`);
            } else {
                const cls = MEMORY_CLASS_LABELS[reading.memoryClass] ?? 'unknown';
                this._addLabelRow(menu, `Unavailable (${cls} memory)`);
            }
        }
    }
}
