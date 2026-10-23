// gpu/selection.js — resolve the persistent per-GPU selection.
//
// Pure JavaScript: no Shell/GLib imports, so the selection logic is testable
// headless. Selection is by stable PCI identity, never by cardN.

/**
 * Resolve a selection key against the discovered devices.
 *
 * `selectedKey` is 'auto', 'all', or a stable device id (e.g.
 * 'pci-0000:c4:00.0'). Returns { mode, primary, devices, fallback } where
 * primary is the device whose VRAM is shown in the panel and devices is the
 * full list (for the dropdown). A missing selected device falls back to the
 * first discovered device, flagged with fallback: true.
 */
export function resolveSelection(devices, selectedKey) {
    const list = Array.isArray(devices) ? devices : [];
    if (list.length === 0)
        return { mode: 'auto', primary: null, devices: list };

    const key = (typeof selectedKey === 'string' && selectedKey.length > 0)
        ? selectedKey
        : 'auto';

    if (key === 'all')
        return { mode: 'all', primary: list[0], devices: list };

    if (key === 'auto')
        return { mode: 'auto', primary: list[0], devices: list };

    const match = list.find(device => device.stableId === key);
    if (match)
        return { mode: 'specific', primary: match, devices: list };

    // Selected device disappeared; fall back to automatic selection.
    return { mode: 'auto', primary: list[0], devices: list, fallback: true };
}
