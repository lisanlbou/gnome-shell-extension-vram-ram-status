// tests/test-discovery.js — DRM enumeration, vendor/driver/stable identity.

import {
    DRM_BASE,
    listCardNodes,
    vendorFromHex,
    parseUevent,
    buildDevice,
    discover,
} from '../vram-ram-status@local/lib/gpu/discovery.js';

export function run(t) {
    const { eq } = t;

    eq(DRM_BASE, '/sys/class/drm', 'DRM base path');

    eq(listCardNodes(['card0', 'card1', 'card1-DP-1', 'card1-eDP-1', 'renderD128', 'version']),
       ['card0', 'card1'], 'keeps only cardN, drops connectors/render/version');
    eq(listCardNodes([]), [], 'empty list');
    eq(listCardNodes(null), [], 'null -> empty');
    eq(listCardNodes(['card10', 'card2', 'card1']),
       ['card1', 'card2', 'card10'], 'numeric ordering, not lexicographic');

    // vendorFromHex
    eq(vendorFromHex('0x1002'), 'amd', 'AMD vendor hex');
    eq(vendorFromHex('0x8086'), 'intel', 'Intel vendor hex');
    eq(vendorFromHex('0x10de'), 'nvidia', 'NVIDIA vendor hex');
    eq(vendorFromHex('0x1234'), 'unknown', 'unknown vendor hex');
    eq(vendorFromHex(null), 'unknown', 'null vendor');
    eq(vendorFromHex(' 0x1002\n'), 'amd', 'vendor hex trimmed');

    // parseUevent
    eq(parseUevent('DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n'),
       { driver: 'amdgpu', pciSlot: '0000:c4:00.0' }, 'parses driver and PCI slot');
    eq(parseUevent('PCI_ID=1002:150E\n'),
       { driver: null, pciSlot: null }, 'ignores unknown keys');
    eq(parseUevent(null), { driver: null, pciSlot: null }, 'null uevent');

    // buildDevice
    const dev = buildDevice({
        cardNode: 'card1',
        vendorHexText: '0x1002',
        ueventText: 'DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n',
    });
    eq(dev.stableId, 'pci-0000:c4:00.0', 'stable id from PCI slot');
    eq(dev.vendor, 'amd', 'vendor resolved');
    eq(dev.driver, 'amdgpu', 'driver resolved');
    eq(dev.displayName, 'AMD 0000:c4:00.0', 'display name');

    eq(buildDevice({ cardNode: 'card1-DP-1', vendorHexText: '0x1002', ueventText: '' }),
       null, 'rejects connector directory');

    const noUevent = buildDevice({ cardNode: 'card1', vendorHexText: '0x1002', ueventText: null });
    eq(noUevent.stableId, 'pci-card1', 'falls back to cardN when no PCI slot');

    // discover with injected io
    const devices = discover({
        listDir: () => ['card1', 'card1-DP-1', 'renderD128', 'version'],
        readText: path => {
            if (path.endsWith('/vendor')) return '0x1002';
            if (path.endsWith('/uevent')) return 'DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n';
            return null;
        },
    });
    eq(devices.length, 1, 'discover finds one card device');
    eq(devices[0].stableId, 'pci-0000:c4:00.0', 'discovered stable id');
}
