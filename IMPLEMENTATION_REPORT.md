# IMPLEMENTATION REPORT — Memory Monitor (GNOME 45–51 compatibility pass)

Date: 2026-10-23 · Extension: `memory-monitor@work_in_progress` · Environment: GNOME Shell 50.5 / GJS 1.88.1 / glib 2.88.3 / gettext 0.26

## Summary

Applied the **Memory Monitor** tasks (MM-01 … MM-06) from the implementation
instructions. The work focuses on correctness, accessibility, internationalization
and packaging, while preserving the existing GNOME 50 behavior and all saved
GSettings values (no schema IDs, keys, UUID or desktop IDs were renamed).

Implemented:

- **MM-01 (P0):** fixed the progress-bar preferred-size contract — `vfunc_get_preferred_height`
  now returns the required `[minimum, natural]` pair instead of a scalar, and the
  bar is exposed to AT-SPI as an `Atk` level bar with a readable value.
- **MM-02 (P1):** switched the timer backend from the legacy `GLib.source_remove`
  to the modern `GLib.Source.remove` and added a real-GLib regression test.
- **MM-03 (P1):** the dropdown menu now updates rows **in place** while open
  instead of `removeAll()` on every poll; it rebuilds only on structural changes
  (GPU list, section visibility, OK↔unavailable flips), preserving keyboard focus.
- **MM-04 (P1):** informative accessible names for the panel control, the
  per-metric marker (`warning`/`critical` in words, not just ⚠/⛔), and level-bar
  semantics for progress bars.
- **MM-05 (P1) + section 4 (i18n):** Gettext integration (Shell + preferences),
  `gettext-domain` in metadata, complete `es` and `pt_BR` catalogs, and a
  `gnome-extensions pack --podir` build that ships `.mo` files.
- **MM-06 (P2):** NVIDIA remains honestly *unavailable* (unchanged, as required);
  no fake VRAM backend was added.

## Changes by file

| File | Change |
| --- | --- |
| `ui/progressBar.js` | `vfunc_get_preferred_height` returns `[BAR_HEIGHT, BAR_HEIGHT]`; added `Atk.Role.LEVEL_BAR` role, a `value` GObject property, and a `St.GenericAccessible` exposing current/min/max value. |
| `lib/monitor.js` | Default scheduler `remove()` uses `GLib.Source.remove(id)` (documented why). |
| `ui/menu.js` | Replaced `removeAll()`-per-render with a row "plan" + in-place update vs. rebuild-on-structure-change; all user strings wrapped in `_()`. |
| `ui/indicator.js` | Added accessible name for each metric box and a spoken word for the alert marker; imported `_`. |
| `extension.js` | Notification title/body translated via `_()`; imported `_`. |
| `prefs.js` | All preferences strings wrapped in `_()`/`ngettext`; imported prefs-side gettext. |
| `lib/gettext.js` | New: re-exports `gettext`/`ngettext`/`pgettext` from the GNOME 45+ Shell extension module (no circular import with the entry point). |
| `metadata.json` | Added `"gettext-domain": "memory-monitor@work_in_progress"`. |
| `po/` | New: `memory-monitor@work_in_progress.pot`, `es.po`, `pt_BR.po`, `LINGUAS`. |
| `build.sh` | Now validates translations and packages with `gnome-extensions pack --podir` (compiles `.mo`). |
| `scripts/update-translations.sh` | New: xgettext extraction + msgmerge + msgfmt validation. |
| `tests/test-glib-timer.js` | New: real `GLib.Source.remove` regression test. |
| `tests/run-tests.js` | Registered the new `glib-timer` suite. |

## Finding checklist

| Task | Status | Notes |
| --- | --- | --- |
| MM-01 progress-bar preferred size | **Done** | Return pair `[BAR_HEIGHT, BAR_HEIGHT]`; a11y role/value added. GI runtime paint test needs a live Shell (see below). |
| MM-02 timer API + lifecycle | **Done** | `GLib.Source.remove` verified live via `tests/test-glib-timer.js`; lifecycle tests still green. |
| MM-03 menu in-place update | **Done** | In-place update on value changes; rebuild only on structural changes. |
| MM-04 accessibility | **Partial** | Names/roles/warnings added; Orca/interactive a11y not run (no automation). |
| MM-05 translations | **Done** | `es` + `pt_BR` catalogs compile (`msgfmt --check`), packaged as `.mo`. |
| MM-06 backend honesty / performance | **Done (unchanged)** | NVIDIA remains unavailable; no fake backend. |


## Validation commands and outputs

```
# Baseline (before changes): 324 passed, 0 failed
gjs -m tests/run-tests.js

# After changes (including new glib-timer suite): 329 passed, 0 failed
gjs -m tests/run-tests.js
#   ...
#   329 passed, 0 failed

# JS syntax (all sources + tests)
find . -type f -name '*.js' -not -path './node_modules/*' -print0 \
  | xargs -0 -r -n1 node --check
#   ALL JS SYNTAX OK

# GSettings schema (strict)
glib-compile-schemas --strict --dry-run memory-monitor@work_in_progress/schemas/
#   (clean)

# Gettext catalogs
msgfmt --check --check-format -o /dev/null memory-monitor@work_in_progress/po/es.po
msgfmt --check --check-format -o /dev/null memory-monitor@work_in_progress/po/pt_BR.po
#   OK (105 translated messages each, 0 untranslated, 0 fuzzy)

# Packaging
./build.sh
#   329 passed, 0 failed
#   ==> Compiling GSettings schema
#   ==> Validating translations
#   ==> Packaging memory-monitor@work_in_progress
#   ==> Done: memory-monitor@work_in_progress.shell-extension.zip

unzip -l memory-monitor@work_in_progress.shell-extension.zip
#   includes lib/**, ui/**, schemas/*.gschema.xml, locale/{es,pt_BR}/LC_MESSAGES/*.mo,
#   extension.js, prefs.js, stylesheet.css, metadata.json, LICENSE, README.md, CHANGELOG.md

git diff --check   # clean
```

### Live-session status (GNOME 50)

`gnome-extensions info memory-monitor@work_in_progress` reported the extension
**ACTIVE** in the running GNOME Shell **50.5** session, against the **pre-existing
installed copy** (the baseline). This is a real GNOME 50 data point for the
baseline code.

> The changes in this workspace have **not** been reloaded into the live
> session. Reloading would require installing the new bundle and logging out/in,
> which the instructions forbid doing automatically in the user's production
> session. The modified code is therefore **not yet runtime-tested in a live
> Shell**; the exact manual steps are listed below.

## GNOME 45–51 matrix

Only evidence-supported claims are listed. No GNOME 45–49 or 51 runtime is
available in this environment.

| GNOME | Static | Shell load / enable | Functional UI | Preferences | i18n / a11y | Can declare support? |
|:--:|:--|:--|:--|:--|:--|:--|
| 45 | Not tested | Not tested | Not tested | Not tested | Not tested | No |
| 46 | Not tested | Not tested | Not tested | Not tested | Not tested | No |
| 47 | Not tested | Not tested | Not tested | Not tested | Not tested | No |
| 48 | Not tested | Not tested | Not tested | Not tested | Not tested | No |
| 49 | Not tested | Not tested | Not tested | Not tested | Not tested | No |
| 50 | PASS (syntax/schema/329 tests) | Baseline ACTIVE (50.5) | Not re-tested after changes | Not re-tested after changes | `.mo` packaged; not runtime-tested | **No new claim** |
| 51 | Not tested | Not tested | Not tested | Not tested | Not tested | No |

`metadata.json` still declares `"shell-version": ["50"]` only — the policy in
the instructions: a version is added **only** after a real runtime test for that
version. Nothing was added speculatively.

## Remaining risks / limitations

- **Live Shell reload:** the modified code was not reloaded; `enable()/disable()`,
  panel interaction, menu open/close and prefs were not re-validated against the
  changed source.
- **GI virtual-function behavior:** the `vfunc_get_preferred_height` fix is
  correct by contract (matches GNOME's own `BarLevel`), but no headless test can
  instantiate `St`/`Clutter` outside a compositor; the paint/height behavior must
  be confirmed in a live Shell.
- **Orca / screen reader:** not executed; `ACCESSIBILITY_TESTS.md` lists manual
  steps and is marked *not tested*.
- **NVIDIA VRAM:** intentionally still *unavailable*; no backend implemented
  (out of scope).
- **Versions 45–49 / 51:** no VMs available; not declared supported.

## Manual tests for maintainer

1. Build and install into a disposable session/VM:
   ```sh
   ./build.sh
   gnome-extensions install memory-monitor@work_in_progress.shell-extension.zip
   # log out and back in
   gnome-extensions enable memory-monitor@work_in_progress
   ```
2. Panel: confirm RAM/VRAM render; open the dropdown while values refresh
   (menu should not flicker or lose keyboard focus); change panel box/position 10×.
3. Enable/disable the extension 20× and watch `journalctl --user -b -o cat | grep -i memory-monitor`
   for errors or leaked timers.
4. Alerts: set RAM warning to 1% and confirm a localized notification and the
   ⚠ marker; confirm hysteresis/cooldown.
5. Preferences: switch `LANG=es_ES.UTF-8` and `LANG=pt_BR.UTF-8` (restart Shell)
   and confirm translated UI; confirm English fallback.
6. Accessibility: follow `ACCESSIBILITY_TESTS.md`.
7. Suspend/resume: confirm the monitor revalidates.

## Final recommendation

- **Ready for maintainer review:** yes — the changes are scoped, all automated
  checks pass, and the package is complete and clean.
- **Ready for EGO submission:** **no** — the modified code has not been reloaded
  into a live GNOME Shell session, Orca was not exercised, and only GNOME 50 is
  declared. The maintainer must run the manual live-session checks above (and the
  GNOME 45–51 matrix where VMs are available) before any submission.
