// tests/fixtures.js — shared fake-filesystem fixtures for monitor tests.
//
// Kept free of Shell/GTK/Adwaita imports. The /proc and /sys layout used by
// the monitor tests is defined once here instead of being duplicated per file.

export const MEMINFO = 'MemTotal:       32476244 kB\nMemAvailable:   19840216 kB\n';

export function amdIo() {
    const files = {
        '/proc/meminfo': MEMINFO,
        '/sys/class/drm/card1/device/vendor': '0x1002',
        '/sys/class/drm/card1/device/uevent': 'DRIVER=amdgpu\nPCI_SLOT_NAME=0000:c4:00.0\n',
        '/sys/class/drm/card1/device/mem_info_vram_used': '3000705024',
        '/sys/class/drm/card1/device/mem_info_vram_total': '34359738368',
    };
    return {
        readText: path => (path in files ? files[path] : null),
        listDir: () => ['card1', 'card1-DP-1', 'renderD128', 'version'],
    };
}
