# Changelog

All notable changes to this extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0-alpha] — 2026-10-23

First public alpha release (previously tracked internally as 2.0.0).
Field-verified on Fedora 44 / GNOME Shell 50.5.

Complete rewrite of the baseline "Memory Monitor" extension.

### Added

- Configurable display formats, metric order, decimal precision, unit
  placement, separator, and per-metric visibility.
- Configurable refresh interval (default 10 s) with live updates.
- Configurable panel placement (box + position index).
- Native dropdown menu (RAM details, per-GPU memory, device name, memory class,
  provider, last successful update, Preferences action).
- Multi-GPU discovery with stable PCI identity and automatic / specific /
  all-GPU selection.
- AMD, Intel and NVIDIA providers with truthful
  dedicated / shared / local / unavailable semantics.
- Warning/critical alerts with hysteresis, cooldown, and transition-only
  notifications.
- Theme-compatible warning/critical colors plus a textual marker.
- GTK4/libadwaita preferences (Display, Hardware, Monitoring, Alerts, About).
- Suspend/resume revalidation and graceful error handling.
- Headless unit test suite (`gjs -m tests/run-tests.js`).

### Changed

- Renamed the extension from "VRAM & RAM Status" to **Memory Monitor**.
  - UUID: `vram-ram-status@local` → `memory-monitor@work_in_progress`
  - GSettings schema: `org.gnome.shell.extensions.vram-ram-status` →
    `org.gnome.shell.extensions.memory-monitor`
  - Style classes, log prefix, notification app name, and JS class names
    updated to match.
- Default refresh interval changed from 2 s to 10 s.
- Only GNOME Shell 50 is declared supported (was 49–53).

### Fixed

- Removed reliance on St `tooltip_text`, which was removed in GNOME Shell 50
  (St 18); alert/usage detail is now exposed through the menu and a textual
  panel marker instead.
- Fixed the dropdown menu not opening on click: GNOME 50 `PopupMenu.open()`
  returns early when the menu is empty (before emitting `open-state-changed`),
  but the extension rendered content lazily from that signal. The menu now
  renders eagerly on the first update.
- Corrected the author/email shown in the About page and `original-author`
  metadata (`lisanlbou@work_in_progress`).

### Hardened

- Timer lifecycle: fixed a leak where the recurring `_schedule()` callback
  cleared the source id, so `stop()`/`disable()` could leave timers running;
  restarts no longer accumulate timer sources.
- Collection: `_collect()` now recovers from collection and callback exceptions
  with a degraded snapshot and transition-only logging (no per-poll flooding);
  per-stage isolation keeps RAM, discovery, and per-GPU failures from taking
  down the whole snapshot.
- UI: panel actors are updated in place and the dropdown menu is rebuilt lazily
  on open, eliminating per-poll actor churn.
- Alerts: visual warning/critical classification is now independent of the
  notification toggle, so colors work even when notifications are disabled.
- Memory semantics: added a `visible` memory class so the AMD
  `mem_info_vis_vram_*` fallback is never mislabeled `dedicated`.
- Parsing/diagnostics: strict decimal parsing for byte counters, threshold
  normalization (warning < critical), and error codes included in journal logs.
