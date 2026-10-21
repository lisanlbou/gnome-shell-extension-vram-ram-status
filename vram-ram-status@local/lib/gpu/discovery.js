// gpu/discovery.js — enumerate DRM devices and map stable identities.
//
// Pure JavaScript where possible: the list/parse helpers below take plain data
// so they can be tested headless. The Shell process injects the actual /sys
// reads. Full device enumeration (vendor/driver/stable-id) is expanded in the
// multi-GPU phase; the baseline phase only needs card node listing.

const CARD_RE = /^card\d+$/;

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

/** Default DRM class directory (for documentation / tests). */
export const DRM_BASE = '/sys/class/drm';
