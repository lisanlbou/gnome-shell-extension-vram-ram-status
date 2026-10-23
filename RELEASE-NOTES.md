# Memory Monitor — 0.1.0-alpha

**Released:** 2026-10-23 · **GNOME Shell:** 50 (tested on 50.5) · **License:** GPL-2.0-or-later

First public alpha. Shows system RAM and GPU (VRAM) usage in the top panel,
reading only `/proc/meminfo` and `/sys` — no network access, no root, and no
synchronous subprocesses.

## Highlights

- RAM + VRAM numbers with configurable formats, precision, units, separators,
  per-metric visibility and icons.
- Configurable refresh interval (1–60 s, default **10 s**), applied live.
- Native dropdown menu with per-metric progress bars colored by alert state.
- Multi-GPU discovery by stable PCI identity (AMD / Intel / NVIDIA) with
  truthful `dedicated` / `shared` / `local` / `visible` / `unavailable` semantics.
- Warning/critical alerts with hysteresis and transition-only notifications.

## What changed in this alpha

- Renamed from "VRAM & RAM Status" to **Memory Monitor**; UUID is now
  `memory-monitor@work_in_progress`, schema
  `org.gnome.shell.extensions.memory-monitor`.
- Fixed the dropdown menu not opening on click under GNOME 50.
- Corrected the author shown in the About page and `original-author` metadata.

## Install

```sh
./build.sh
gnome-extensions install memory-monitor@work_in_progress.shell-extension.zip
```

See [INSTALL.md](INSTALL.md).

## Verification

- 324 headless unit tests pass (`gjs -m tests/run-tests.js`).
- Field-verified on Fedora 44 / GNOME Shell 50.5: loads to `ACTIVE`, panel
  indicator renders, and the dropdown opens on left-click.

## Known limitations

- NVIDIA VRAM is reported as *unavailable* unless an opt-in NVML helper is
  configured (none is bundled).
- Only GNOME Shell 50 is declared supported.

See the [full README](memory-monitor@work_in_progress/README.md) and
[CHANGELOG](memory-monitor@work_in_progress/CHANGELOG.md).
