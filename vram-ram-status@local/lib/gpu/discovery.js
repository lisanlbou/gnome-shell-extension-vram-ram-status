// gpu/discovery.js — enumerate DRM devices and map stable identities.
//
// Pure helpers below take plain data so they can be tested headless; the
// Shell/preferences process injects an io object with listDir/readText.
// Devices are identified by stable PCI identity (from the device uevent), not
// by cardN, so selections survive cardN reordering.

export const DRM_BASE = '/sys/class/drm';

const CARD_RE = /^card\d+$/;

const VENDOR_HEX = Object.freeze({
    '0x1002': 'amd',
    '0x8086': 'intel',
    '0x10de': 'nvidia',
});

const VENDOR_LABELS = Object.freeze({
    amd: 'AMD',
    intel: 'Intel',
    nvidia: 'NVIDIA',
    unknown: 'Unknown',
});

/**
 * Filter a list of /sys/class/drm entry names to cardN nodes only, dropping
 * connector directories (card1-DP-1), render nodes and the version file.
 * Returns a sorted array.
 */
export function listCardNodes(names) {
    if (!Array.isArray(names))
        return [];
    const cards = names.filter(name => typeof name === 'string' && CARD_RE.test(name));
    cards.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return cards;
}

/** Map a vendor id hex string (e.g. '0x1002') to a vendor key. */
export function vendorFromHex(hexText) {
    if (typeof hexText !== 'string')
        return 'unknown';
    const norm = hexText.trim().toLowerCase();
    return VENDOR_HEX[norm] ?? 'unknown';
}

/** Parse the key=value lines of a device uevent. */
export function parseUevent(text) {
    const out = { driver: null, pciSlot: null };
    if (typeof text !== 'string')
        return out;
    for (const line of text.split('\n')) {
        const eq = line.indexOf('=');
        if (eq < 0)
            continue;
        const key = line.slice(0, eq);
        const value = line.slice(eq + 1);
        if (key === 'DRIVER')
            out.driver = value;
        else if (key === 'PCI_SLOT_NAME')
            out.pciSlot = value;
    }
    return out;
}

/**
 * Build a device descriptor from card node name and raw vendor/uevent text.
 * Returns null when the card node is not a valid cardN name.
 */
export function buildDevice({ cardNode, vendorHexText, ueventText }) {
    if (typeof cardNode !== 'string' || !CARD_RE.test(cardNode))
        return null;
    const vendor = vendorFromHex(vendorHexText);
    const uevent = parseUevent(ueventText);
    const pciSlot = (typeof uevent.pciSlot === 'string' && uevent.pciSlot.length > 0)
        ? uevent.pciSlot
        : cardNode;
    const stableId = `pci-${pciSlot}`;
    return {
        cardNode,
        stableId,
        pciSlot,
        vendor,
        driver: uevent.driver ?? null,
        displayName: `${VENDOR_LABELS[vendor] ?? 'Unknown'} ${pciSlot}`,
    };
}

/**
 * Enumerate all DRM card devices using the injected io. Returns a sorted array
 * of device descriptors.
 */
export function discover(io) {
    const names = io.listDir(DRM_BASE);
    const devices = [];
    for (const cardNode of listCardNodes(names)) {
        const base = `${DRM_BASE}/${cardNode}/device`;
        const device = buildDevice({
            cardNode,
            vendorHexText: io.readText(`${base}/vendor`),
            ueventText: io.readText(`${base}/uevent`),
        });
        if (device)
            devices.push(device);
    }
    return devices;
}
