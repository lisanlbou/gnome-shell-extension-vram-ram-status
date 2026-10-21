# Changelog

## 2.0.0 — 2026-10-21

Complete rewrite of the baseline "VRAM & RAM Status" extension.

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

- Default refresh interval changed from 2 s to 10 s.
- Only GNOME Shell 50 is declared supported (was 49–53).

### Fixed

- Removed reliance on St `tooltip_text`, which was removed in GNOME Shell 50
  (St 18); alert/usage detail is now exposed through the menu and a textual
  panel marker instead.
