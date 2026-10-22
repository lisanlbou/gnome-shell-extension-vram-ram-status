# FINAL REPORT — VRAM-tray Pre-Submission Audit

Date: 2026-10-22 · Extension: `vram-ram-status@local` · GNOME Shell 50.5 / GJS 1.88.1

## Executive summary

**Overall readiness: CONDITIONAL GO**

The extension is a strong EGO candidate. It is secure, compliant with the GNOME
review guidelines on every substantive point, well-modularized, and covered by
329 → 324 passing unit tests (5 removed alongside dead code). The only ego-lint blocker (a missing `url` field) has
been fixed; ego-lint now passes with 0 blocking issues. The distributable
package is clean.

Two items still gate a final GO: (1) the `url` is currently a **placeholder**
(`https://example.com/...`) and must be replaced with the real repository/home
page URL before submission, and (2) menu open/close and suspend/resume were not
automated (the menu needs a real click on Wayland, and suspend cannot be
auto-resumed). The other runtime tests (20 enable/disable cycles, panel moves,
settings live-updates, and alert notifications) were run successfully in the
live session. Everything else is either a verified false positive or a
low-severity polish item.

### Security assessment — GOOD

No subprocesses, no privilege escalation, no filesystem writes, no network, no
telemetry, no secrets, no eval/dynamic execution, no untrusted code path.
External data (device names, PCI ids, `/proc`/`/sys` contents) is strictly
validated and rendered as plain text (never Pango markup). ego-lint security and
disclosure checks all pass.

### GNOME compliance assessment — GOOD

Modern ES modules, correct import segregation (GTK/Adwaita confined to prefs),
no deprecated APIs, correct lifecycle (no init-time side effects; timers,
signals, actors, and settings all cleaned up in `disable()`), correct schema
id/path, and native GSettings. The metadata gaps (`url`, `original-authors`) are
now fixed; `url` is a placeholder pending the real value.

### Functional reliability assessment — GOOD

The full pipeline (RAM/VRAM parsing, multi-GPU discovery/selection, formatting,
alerts with hysteresis/cooldown, colors) is unit-tested headless. Interactive
runtime tests run in the live session: 20 enable/disable cycles (no failures),
panel-box/position moves (no `Extension point conflict`), settings live-updates,
and a real RAM warning notification (`Notify` captured on D-Bus). Menu
open/close and suspend/resume were not automated (see below). One defect was
found and fixed (F16: spurious "recovered" logs on enable).

### Maintainability assessment — GOOD

Well-modularized (20 files, largest 320 lines), small entry point, no unused
imports, no hallucinated APIs, `provenance-score=3`. The optional cleanups
(dead exports, stale scaffold comments, duplicated version literal) have been
applied.

## Findings table

| ID | Severity | File/line | Evidence | Why it matters | Suggested correction | EGO rejection likelihood |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | ~~High~~ FIXED | `metadata.json` | ego-lint `metadata/missing-url` | `url` is required for submission | Added placeholder `url`; **replace with real repo URL before submission** | Resolved (placeholder pending) |
| F2 | ~~Medium~~ FIXED | `ui/progressBar.js:18` | ego-lint `gobject/missing-gtypename` | Generic GType collision risk | Added `GTypeName: 'VramRamProgressBar'` | Resolved |
| F3 | ~~Low~~ FIXED | `metadata.json` | ego-lint `metadata/non-standard-field` | `original-authors` non-standard | Renamed to `original-author` | Resolved |
| F4 | ~~Low~~ SKIPPED | `prefs.js` (ComboRow) | libadwaita 1.9 introspection: `selected-item` is **read-only** (no setter) and `selected` is writable/not actually deprecated | Initial finding was incorrect — no valid migration exists | No change (keep `selected`; revisit only if libadwaita removes it) | None |
| F5 | ~~Low~~ FIXED | `lib/settings.js` | unused exports removed | Dead code | Removed `normalizeMetricOrder`, `normalizeCooldown`, `normalizeHysteresis`, `GPU_SELECTIONS` + 4 `LIMITS` entries | None |
| F6 | ~~Low~~ FIXED | `lib/format.js:34` | unused `kind` parameter | Dead parameter | Dropped parameter | None |
| F7 | ~~Low~~ FIXED | `extension.js`, `lib/monitor.js`, `prefs.js` | scaffold comments | Misleading LLM scaffolding | Removed the three `// *_INSERT` comments | None |
| F8 | ~~Low~~ FIXED | `prefs.js` | `VERSION` literal duplicated metadata | Release-bump friction | Now reads `this.metadata['version-name']` | None |
| F16 | ~~—~~ FIXED | `extension.js:52-53` | 20 enable/disable cycles logged spurious `reading recovered` lines | `_ramFailed`/`_vramFailed` started as `null`; first OK poll logged a fake recovery | Initialize to `false` | None |
| F9 | Low | `extension.js:115`, `lib/monitor.js:38` | ego-lint `R-LOG-02` | `log()` vs `console.debug()` style | Optional switch | None |
| F10 | Low | `lib/monitor.js:27-34` | ego-lint `R-SLOP-44` | Non-idiomatic `GLib.source_remove` | Optional `GLib.Source.remove` | None |
| F11 | Low | `lib/io.js:13` | ego-lint `R-SLOP-16` | Sync read; measured ~19 µs/file | Documented justification; keep | None |
| F12 | Low | `ui/indicator.js:58` | ego-lint `quality/private-api` | `Main.panel.addToStatusArea` is standard | Keep (justify + version pin) | None |
| F13 | Low | `lib/` parsers | ego-lint `excessive-null-checks` | Intentional hardware defensiveness | Keep | None |
| F14 | Low | `extension.js`, `ui/menu.js` | ego-lint `signal-balance` | Static count; verified balanced | No change | None |
| F15 | Low | `extension.js:94` | ego-lint `destroy-no-null` | Reassigned next line | No change | None |

Findings F9–F15 are ego-lint warnings that this audit verified to be false
positives or intentional; they are listed for completeness, not as defects.

**Informational:** `formatLabel`/`formatMetric`, `isUsable`, `maxLevel`,
`readVram`/`parseVramCounters` are test-only helpers **kept by author request**
(HANDOVER.md). No action required; the maintainer should remain aware they are
test/documentation surface, not runtime surface.


## Validation coverage

### PASS
- Metadata JSON validity, UUID format/match, shell-version, schema id/path
- ES modules; no deprecated imports; GTK/Adwaita confined to prefs
- Lifecycle: no init-time side effects; timer/signal/actor/settings cleanup
- Security: no subprocess/network/telemetry/secrets/eval
- Preferences: native GSettings, schema consistency, valid widgets
- Package: required files, no `.git`/tests/audit/scripts/caches, GPL license
- Unit tests: 324 passed, 0 failed (5 removed with the dead code)
- `glib-compile-schemas --strict`: clean
- Extension ACTIVE in live session; no journal errors

### FAIL
- (none — all blocking issues resolved)

### WARNING
- `metadata/url-format`: placeholder `url` is not a repository URL (replace before submission)
- Various ego-lint style warnings (F9–F15)

### NOT RUN
- Menu open/close (requires a real mouse click on Wayland — not automatable
  without extra tools)
- Suspend/resume (cannot be auto-resumed; a suspend must be triggered manually)
- Forced GPU unavailability (would require renaming sysfs counters — root)

### NOT APPLICABLE
- polkit/privileged helper checks (no polkit used)
- eslint (no eslint config present)
- file-monitor cleanup (no `Gio.FileMonitor` used)
- `metadata/uuid-matches-dir` on the extracted package (artifact of temp dir)

## Remediation roadmap

### 1. Must fix before submission
- ~~F1 — add `url` to `metadata.json`~~ **DONE** (placeholder added; replace
  `https://example.com/vram-ram-status` with the real repo/home page URL before
  submitting).
- **Run the interactive runtime tests** (enable/disable cycles, panel moves,
  dropdown/prefs, refresh-interval, notifications, suspend/resume) and confirm
  no orphan timers/signals, duplicate callbacks, or journal spam.

### 2. Recommended before submission
- ~~F2 — add a unique `GTypeName` to `ProgressBar`~~ **DONE**.
- ~~F3 — rename `original-authors` → `original-author`~~ **DONE**.

### 3. Optional improvements
- ~~F4 — migrate `Adw.ComboRow` to `selected-item`~~ **NOT APPLICABLE**
  (`selected-item` is read-only; `selected` remains the correct writable API).
- ~~F5/F6 — remove dead code~~ **DONE**.
- ~~F7 — remove scaffold comments~~ **DONE**.
- ~~F8 — centralize the version literal~~ **DONE**.
- F9/F10 — switch `log()` → `console.debug()` and `GLib.source_remove` →
  `GLib.Source.remove` (style only).

## Final recommendation

- **ego-lint passed?** Yes — exit 0, 0 blocking issues, verdict "MAY PASS WITH
  COMMENTS" (231 checks: 210 passed, 9 warnings, 12 skipped). The only
  submission-relevant warning is the placeholder `url`.
- **Official review requirements satisfied?** Yes — the `url` (placeholder) and
  `original-author` fields are now correct; the placeholder `url` must be
  replaced with the real value before submission.
- **Actual GNOME runtime tests passed?** Partially — 20 enable/disable cycles,
  panel moves, settings live-updates, and a real alert notification all passed
  with no errors. Menu open/close and suspend/resume were not automated.
  Static + headless lifecycle coverage is strong, and the extension is ACTIVE.
- **Distributable package passed?** Yes — clean contents, valid schema, GPL
  license, no forbidden files; ego-lint exit 0 on the extracted package.
- **What remains unverified:** menu open/close, suspend/resume, forced GPU
  unavailability — plus replacing the placeholder `url` (and a log-out/in to
  load the final code).

**Verdict: CONDITIONAL GO** — after (1) replacing the placeholder `url` with the
real repository/home page URL and (2) a final log-out/in with a quick manual
menu/suspend check, the extension is expected to be a clean submission
candidate. This audit does **not** claim extensions.gnome.org will approve the
extension; final approval rests with the EGO reviewers.

