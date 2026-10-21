# VRAM & RAM Monitor v2 — Environment Record

Captured at Phase 0 (baseline). This documents the reference environment the
extension is developed and acceptance-tested against.

## Host

- OS: Fedora 44 (Forty Four)
- Session: Wayland
- GNOME Shell: 50.5
- GJS: 1.88.1 (ES modules)
- GTK4 / Libadwaita: present at runtime (used by the preferences process)

## GPU (live reference)

- Model: AMD Radeon 880M / 890M (Strix), integrated
- Driver: amdgpu
- Vendor ID: 0x1002, Device ID: 1002:150E
- PCI slot: 0000:c4:00.0
- DRM node: /sys/class/drm/card1

Available AMD sysfs counters:

- mem_info_vram_used / mem_info_vram_total (dedicated VRAM)
- mem_info_vis_vram_used / mem_info_vis_vram_total (visible VRAM)
- mem_info_gtt_used / mem_info_gtt_total (GTT)

## Baseline readings (sanity check)

- RAM total: 33255673856 bytes (~31.0 GiB), available ~18.2 GiB
- VRAM used/total: 3082407936 / 34359738368 bytes (~2.9 / 32.0 GiB)

## Constraints honored

- UUID preserved: vram-ram-status@local
- Schema id: org.gnome.shell.extensions.vram-ram-status
- Only GNOME Shell 50 is declared supported until other versions are validated.
- No synchronous subprocesses in the Shell process; no network; no root.
- Optional NVIDIA/Intel backends are capability-detected and truthful about
  "unavailable" rather than guessing memory semantics.
