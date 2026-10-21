# VRAM & RAM Status

A GNOME Shell extension that shows system RAM and GPU memory usage directly in
the top panel. It reads only `/proc/meminfo` and `/sys` — no network access, no
root privileges, and no synchronous subprocesses.

## Requirements

- Fedora Workstation on **Wayland** (tested on Fedora 44)
- GNOME Shell **50** (tested on 50.5)
- GTK4 / libadwaita for the preferences window

Only GNOME Shell 50 is declared supported. Other versions are not advertised
until they are individually validated.

## Features

- RAM and VRAM as numbers with configurable formats (`used/total`,
  `used/total + percentage`, `percentage`, `used only`, `used + percentage`),
  metric order, decimal precision, unit placement, separator, per-metric
  visibility, and optional RAM/GPU icons.
- Configurable refresh interval (1/2/5/10/15/30/60 s; default **10 s**), applied
  without restarting the Shell.
- Configurable panel placement (left/center/right + index).
- Native dropdown menu: RAM used/total/available, per-GPU memory, device name,
  memory class, provider, last successful update, and a Preferences action,
  with per-metric progress bars colored by alert state.
- Multi-GPU discovery by stable PCI identity (survives `cardN` reordering), with
  automatic / specific / all-GPU selection.
- Separate RAM and VRAM threshold alerts (warning/critical) with hysteresis and
  cooldown; notifications fire only on transitions.
- Per-metric warning/critical colors (disable-able) with a per-metric textual
  marker so state is visible without color alone; choose whether the color
  applies to the whole metric, its icon, its value, or its percentage, and
  optionally color the normal (green) state.

## Data semantics

Memory is reported with an explicit class:

| Class | Meaning |
| --- | --- |
| `system` | Host RAM (`MemTotal − MemAvailable`). |
| `dedicated` | Discrete/dedicated GPU memory (AMD `mem_info_vram_*`). |
| `local` | GPU-local memory (Intel discrete, when counters exist). |
| `shared` | System memory shared with an integrated GPU (Intel). |
| `unknown` | Vendor not recognized. |

The extension prefers truthful *unavailable* states over guessed values. A
reading is shown only when the kernel exposes usable, finite, non-negative
counters with `used <= total`; anomalous data is reported as unavailable rather
than as a misleading percentage. Memory classes are never equated across
vendors: AMD "dedicated" and Intel "local" are not forced into a single
"universal VRAM total".

## Vendor support

- **AMD** — supported via sysfs `mem_info_vram_used/_total` (dedicated VRAM),
  falling back to `mem_info_vis_vram_*` when the primary counters are absent.
- **Intel** — integrated GPUs share system memory and are reported as *shared*
  with an explicit unavailable state; discrete GPUs are reported as *local*
  memory only when the kernel exposes local-memory counters.
- **NVIDIA** — the proprietary driver does not expose VRAM through sysfs. VRAM
  is reported as *unavailable* unless an opt-in, capability-detected NVML
  helper is configured. This extension never runs `nvidia-smi` synchronously in
  the Shell process and bundles no helper.

## Optional dependencies

None for RAM and AMD. NVIDIA VRAM requires an opt-in NVML helper that is not
bundled (see below).

### NVIDIA helper (optional, not bundled)

If a helper is ever added, it must satisfy these constraints, which this
release is designed around but does not ship:

- Opt-in and capability-detected; its absence is clearly reported as
  *unavailable*, never as a fabricated value.
- Launched asynchronously with a bounded timeout, safe fixed arguments, and
  explicit process cleanup; it must never block the Shell.
- No network access and no root privileges.

## Install / uninstall

See `INSTALL.md`.

## Settings

Persisted under `org.gnome.shell.extensions.vram-ram-status`. Display,
Hardware, Monitoring, Alerts and About are all editable from Preferences
(`gnome-extensions prefs vram-ram-status@local`).

| Key | Type | Default | Purpose |
| --- | --- | --- | --- |
| `ram-format` / `vram-format` | `s` | `used-total` | Display format |
| `metric-order` | `s` | `vram-first` | Which metric is first |
| `decimals` | `i` | `1` | Decimal places (0–3) |
| `unit-placement` | `s` | `suffix` | `suffix` / `none` |
| `separator` | `s` | ` \| ` | Text between metrics |
| `show-ram` / `show-vram` | `b` | `true` | Per-metric visibility |
| `show-icons` | `b` | `true` | RAM/GPU icons in the panel |
| `menu-show-ram` / `menu-show-vram` | `b` | `true` | Menu RAM/VRAM sections |
| `refresh-interval` | `i` | `10` | 1/2/5/10/15/30/60 s |
| `panel-box` / `panel-position` | `s` / `i` | `right` / `0` | Panel placement |
| `selected-gpu` | `s` | `auto` | `auto` / `all` / PCI id |
| `*-alert-enabled` | `b` | `false` | Per-metric alerts |
| `*-warning` / `*-critical` | `i` | `80` / `95` | Threshold percent |
| `alert-cooldown` / `alert-hysteresis` | `i` | `300` / `5` | Anti-flap tuning |
| `enable-colors` | `b` | `true` | Warning/critical colors |
| `color-target` | `s` | `whole` | `whole` / `icon` / `value` / `percentage` |
| `show-normal-color` | `b` | `false` | Green normal state |

## Testing

```sh
gjs -m tests/run-tests.js
```

The pure-logic modules (parsers, formatter, selection, alert state machine,
providers, discovery) are exercised headless. Shell/UI behaviour requires a
live or nested GNOME Shell session.

## Troubleshooting

- Watch the journal: `journalctl --user -f -o cat | grep -i vram-ram-status`.
- Verify state: `gnome-extensions info vram-ram-status@local` (should show
  `State: ACTIVE`).
- A GPU shows *unavailable*: confirm the counters exist under
  `/sys/class/drm/card*/device/` (AMD) or that an NVIDIA helper is configured.
- The extension does not appear: GNOME Shell only scans the extensions
  directory at startup — log out and back in after installing.
- On Wayland there is no safe in-place reload; do not use Alt+F2 → `r`.

## Compatibility

- GNOME 50 (50.5): tested.
- GNOME 49 / 51 / 52 / 53: not tested here; not declared supported.

## License

GPL-2.0-or-later. See `LICENSE`.
