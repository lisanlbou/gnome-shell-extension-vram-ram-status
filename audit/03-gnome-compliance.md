# Phase 3 — Official GNOME Compliance Review

Sources reviewed:
- https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- https://gjs.guide/extensions/review-guidelines/best-practices.html

Extension declares GNOME Shell `["50"]` only. Compliance is assessed against the
rules applicable to GNOME 45+ (ES-module / Extension-class era), which covers
GNOME 50.

## 1. Metadata

| Criterion | Result | Evidence |
| --- | --- | --- |
| Valid JSON | PASS | ego-lint `metadata/valid-json`; parses cleanly |
| Valid, unique UUID | PASS | `vram-ram-status@local`; matches dir; contains `@`; not `@gnome.org` |
| Correct shell-version | PASS | `["50"]` array, major-only, known version |
| Required fields (uuid/name/description/shell-version) | PASS | all present |
| `url` field | **FIXED** | placeholder `https://example.com/vram-ram-status` added (replace before submission) |
| No unnecessary keys | FIXED | `original-authors` → `original-author` |
| Valid schema ID | PASS | `org.gnome.shell.extensions.vram-ram-status` |
| Valid schema path | PASS | `/org/gnome/shell/extensions/vram-ram-status/` |
| Directory structure | PASS | `extension.js`/`prefs.js`/`metadata.json`/`schemas/*.gschema.xml` at root |

## 2. Imports and API usage

| Criterion | Result | Evidence |
| --- | --- | --- |
| Modern ES modules | PASS | all modules use `import`/`export`; no legacy `imports.*` |
| No deprecated imports | PASS | ego-lint R-DEPR-* all clean |
| Shell imports only in runtime modules | PASS | `extension.js`/`lib/*`/`ui/*` import Shell/St/Clutter/Gio/Glib; `prefs.js` and pure `lib/{model,format,color,alerts,settings,selection,counters,memory/ram}` do not |
| GTK4/Adwaita restricted to prefs | PASS | `gi://Gtk?version=4.0` and `gi://Adw` only in `prefs.js` |
| No fabricated/undocumented APIs | PASS | all APIs exist in GJS/GNOME 50 (verified against runtime; extension is ACTIVE) |
| API compat with GNOME 50 | PASS | `St`/`Clutter`/`PanelMenu`/`PopupMenu`/`LoginManager` usage is current; the one removed API (`St.tooltip_text`, removed in GNOME 50 / St 18) is already avoided (CHANGELOG) |

## 3. Lifecycle

| Criterion | Result | Evidence |
| --- | --- | --- |
| Nothing created before `enable()` | PASS | module scope only defines constants/frozen maps and regexes; no GObject, no signals, no main-loop sources at import time |
| Timers removed | PASS | `Monitor._clearTimeout()` idempotent; `stop()` cancels the source; the recurring callback never clears `_timeout` (source stays cancellable). Test `test-monitor-lifecycle.js` verifies no accumulation |
| Signals disconnected | PASS | settings ids loop-disconnected; `Menu` open-state disconnected; `connectObject`/`disconnectObject` for LoginManager |
| UI actors destroyed | PASS | `Indicator.destroy()` destroys `Menu` then `button`; `Menu.destroy()` disconnects its handler |
| Resources released | PASS | settings/monitor/indicator/loginManager nulled in `disable()`; `_alertState` nulled |
| File monitors canceled | N/A | no `Gio.FileMonitor` used |
| Async work canceled/ignored | PASS | only async op is `notify()` D-Bus `call` with no retained state; failure swallowed; safe to ignore after disable |
| No callbacks use destroyed objects | PASS | `_inFlight` re-entrancy guard; destroyed actors are replaced, not reused |
| No residual activity after repeated enable/disable | PASS (static) | clean `disable()` symmetry; **interactive runtime cycles NOT RUN** (see Phase 5) |

## 4. Security

| Criterion | Result | Evidence |
| --- | --- | --- |
| No unnecessary subprocesses | PASS | no `Subprocess`/`spawn` anywhere; ego-lint `disclosure/subprocess` clean |
| No privilege escalation | PASS | no pkexec/polkit; no root |
| No inappropriate filesystem writes | PASS | reads only; no writes at all in Shell code |
| No telemetry/network | PASS | no network APIs; ego-lint `disclosure/network` clean |
| No secrets in code | PASS | none found |
| No eval/dynamic execution | PASS | none |
| No untrusted code execution | PASS | no exec/eval/spawn |
| External device names / file content | PASS | `parseUevent`/`parseMeminfo`/`sanitizeBytes` validate strictly; menu renders device names via plain `St.Label` (no Pango markup), so `displayName`/PCI ids can never be interpreted as markup (see `ui/menu.js` header comment) |

## 5. Preferences

| Criterion | Result | Evidence |
| --- | --- | --- |
| Native GSettings | PASS | `this.getSettings()` (no explicit schema id), driven by `settings-schema` in metadata |
| Schema consistency | PASS | 26 keys; schema id/path correct; `glib-compile-schemas --strict` passes |
| Proper defaults | PASS | defaults in schema match `lib/settings.js` DEFAULTS |
| No invalid widget construction | PASS | `Adw.PreferencesPage/Group/ComboRow/SpinRow/SwitchRow/EntryRow/ActionRow`; `Gtk.StringList` + `Adw.ComboRow` |
| No prefs resource leaks | PASS | widgets owned by the prefs window; ego-lint `prefs/memory-leak` clean |

**Minor prefs note (resolved):** `Adw.ComboRow.selected` was initially flagged as
"deprecated, migrate to `selected-item`". Runtime introspection of libadwaita
1.9.4 shows `selected-item` is **read-only** (no setter) and `selected` is
writable and not actually flagged deprecated. **No migration exists** — `selected`
is the correct API. Corrected to "no change".
