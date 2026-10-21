// tests/test-discovery.js — DRM card node listing.

import { listCardNodes, DRM_BASE } from '../vram-ram-status@local/lib/gpu/discovery.js';

export function run(t) {
    const { eq } = t;

    eq(DRM_BASE, '/sys/class/drm', 'DRM base path');

    eq(listCardNodes(['card0', 'card1', 'card1-DP-1', 'card1-eDP-1', 'renderD128', 'version']),
       ['card0', 'card1'], 'keeps only cardN, drops connectors/render/version');
    eq(listCardNodes([]), [], 'empty list');
    eq(listCardNodes(null), [], 'null -> empty');
    eq(listCardNodes(['card10', 'card2', 'card1']),
       ['card1', 'card2', 'card10'], 'numeric ordering, not lexicographic');
}
