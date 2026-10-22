# Phase 5 — Functional and Lifecycle Verification

## Environment

This is a **real GNOME Shell 50.5 Wayland session**, so runtime observations
are genuine. The installed extension is a symlink to the audited source tree and
is **ACTIVE**.

## Read-only runtime verification (performed)

| Check | Result |
| --- | --- |
| Extension discoverable & active | PASS — `gnome-extensions info` → `State: ACTIVE`, `Version: 2.0.0` |
| Schema loaded with defaults | PASS — `gsettings list-recursively` returns all 26 keys |
| No crash/exception in journal | PASS — journal shows only two transition log lines (see below), no stack traces |
| Imports resolve at runtime | PASS — the extension is ACTIVE and polled (transition logs prove the pipeline runs) |

Journal evidence (this boot, filtered to the extension):

```
vram-ram-status: RAM reading recovered
vram-ram-status: VRAM reading recovered
```

These are the transition-only recovery logs — the extension observed a
transient RAM/VRAM unavailability (consistent with a suspend/resume or a
transient GPU state) and recovered. This is the intended behavior of the
`_logTransitions` design (no per-poll spam).

## Live settings observed

The live session currently runs **non-default** settings (user has been
testing): `refresh-interval=60`, `ram-format='percentage'`,
`ram-alert-enabled=true`, `alert-cooldown=999`. This confirms settings
persistence works, but means the "10 s default" was not the active interval at
audit time.

## Interactive runtime tests — NOT RUN (require changing the running desktop)

The following functional/lifecycle tests **were not executed** because they
visibly change the running desktop, and the audit constraints require approval
before doing so. They are marked NOT RUN, not PASS:

- 20 enable/disable cycles
- Repeated preference changes (formats, thresholds, colors, panel position)
- Opening/closing the dropdown repeatedly
- Opening/closing the Preferences window
- Changing refresh interval and observing timer re-arm
- Disabling the extension while polling
- Suspend/resume cycle
- Temporarily hiding GPU data (forcing unavailable)
- RAM-only / VRAM-only / combined modes at runtime
- Independent display formats at runtime
- Notification firing and cooldown (requires RAM/VRAM to cross a threshold)
- Warning/critical color transitions on the live panel

## What static analysis + headless tests already cover

The lifecycle mechanics that these interactive tests would exercise are covered
headlessly and statically:

- Timer lifecycle: `tests/test-monitor-lifecycle.js` (6 scenarios: start,
  recurring-callback keeps source cancellable, restart, repeated
  start/restart/stop without accumulation, stop-from-callback, restart-from-
  callback).
- Error recovery: `tests/test-monitor-recovery.js` (throwing provider,
  throwing meminfo read, throwing callback, total collection throw, throwing
  discovery).
- Selection/discovery/format/alert/color logic: 329 passing unit tests.
- `disable()` symmetry and signal cleanup: verified statically (Phase 3) and by
  ego-lint `resource-tracking/ownership: 0 orphans`.
- `_recreateIndicator()` correctness (panel-box/panel-position change):
  **verified against GNOME Shell 50.5 `panel.js` source** — `addToStatusArea`
  throws on a duplicate role, but `_addToPanelBox` installs a `destroy` handler
  that deletes the role, so destroy-then-re-add is safe.

## Results (executed 2026-10-22, after approval)

| Test | Result |
| --- | --- |
| 20 enable/disable cycles | PASS — no failures; ACTIVE after; no `Extension point conflict` |
| Panel box/position moves (center→left→right) | PASS — no errors; restored |
| Settings live-update (refresh-interval, ram-format, decimals, show-ram) | PASS — no errors |
| Alert notification (ram-warning=30, ~31% RAM) | PASS — real D-Bus `Notify` captured: "RAM usage warning" / "RAM usage is 31% (warning threshold reached)", fired once (transition-only) |
| Settings restored to pre-test values | PASS — `diff` vs snapshot empty |
| Menu open/close | NOT RUN — needs a real click (Wayland) |
| Suspend/resume | NOT RUN — cannot auto-resume |

**Defect found and fixed (F16):** every `enable()` logged spurious
`RAM/VRAM reading recovered` lines, because `_ramFailed`/`_vramFailed` were
initialized to `null` and `false !== null` on the first successful poll. Fixed
by initializing them to `false` in `enable()`.

> The running Shell still executes the code loaded at login; the F16 fix and the
> earlier F1/F2/F3 + cleanups take effect after the next log-out/in.

## Updated recommendation

The automatable runtime tests passed. The only remaining manual items are menu
open/close and suspend/resume (and replacing the placeholder `url`).
