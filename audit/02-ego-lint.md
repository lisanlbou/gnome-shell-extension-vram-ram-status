# Phase 2 — ego-lint (GNOME Extension Reviewer)

## 1. Tool provenance

- Repository: https://github.com/ZviBaratz/gnome-extension-reviewer
- Cloned to: `/tmp/gnome-extension-reviewer` (outside the extension repo; no
  code or dependencies copied into VRAM-tray).
- Commit: **`158f59d364a0568efd1b38b5339539633b0649d0`**
  (`chore(main): release 0.1.31`).
- Tool: bash + python + YAML rules; deterministic; no AI/network at runtime.

## 2. Command syntax verified

`./ego-lint --help` confirms: `ego-lint [OPTIONS] [EXTENSION_DIR]`,
`--show LEVELS` (fail,warn,pass,skip,all), exit 0 = no blocking issues,
exit 1 = blocking issues, exit 2 = invalid args.

## 3. Command run (source tree)

```bash
/tmp/gnome-extension-reviewer/ego-lint \
  /home/lisandro-dev/Documents/Projects/VRAM-tray/vram-ram-status@local \
  --show all
```

**Exit status: 1** (one blocking issue).

Full output saved to `audit/ego-lint-output.txt`.

## 4. Summary

`230 checks — 207 passed, 1 failed, 10 warnings, 12 skipped`

The 12 SKIPs are expected: 5 polkit-related (`No polkit files found`),
`eslint` (`no eslint.config.mjs`), 2 schema-usage checks (`dynamic key access
detected`), `package/exists` (`no zip present in source tree at lint time`),
and 3 version-gated `R-WEB`/`R-DEPR-04-legacy` checks (`Not applicable for
declared shell-version(s)`).

## 5. FAIL (blocking)

### F1 — `metadata/missing-url`

- **Rule:** `metadata/missing-url`
- **File/line:** `metadata.json` (whole file)
- **Explanation:** `metadata.json` has no `url` field. `url` is a standard
  metadata field and is **required for EGO submission**.
- **Severity:** High (only blocking issue → ego-lint verdict "LIKELY REJECTED").
- **Confirmed defect:** Yes. The field is genuinely absent.
- **Proposed correction:** add `"url": "<project homepage/repo URL>"`.
- **Regression risk:** None (metadata-only; no runtime effect).

## 6. WARNINGS

### W1 — `R-LOG-02` (x2): legacy `log()`

- **File/line:** `extension.js:115`, `lib/monitor.js:38` (`DEFAULT_LOGGER`).
- **Explanation:** Uses the Shell global `log()`; reviewer suggests
  `console.debug()`.
- **Severity:** Low. **False positive / style preference** — `log()` is still a
  supported Shell global and the conventional journal sink; not a rejection risk.
- **Proposed correction (optional):** switch to `console.debug(...)`.
- **Regression risk:** Minimal; `console.debug` also goes to the journal.

### W2 — `R-SLOP-44`: non-idiomatic GLib C-binding

- **File/line:** `lib/monitor.js:27-34` (`GLib.source_remove`).
- **Explanation:** `GLib.source_remove(id)` is the C-binding form;
  `GLib.Source.remove(id)` is the idiomatic GJS form.
- **Severity:** Low. Both work; cosmetic.
- **Proposed correction (optional):** use `GLib.Source.remove(id)`.
- **Regression risk:** None (the injected test scheduler must stay unchanged).

### W3 — `R-SLOP-16`: synchronous `GLib.file_get_contents`

- **File/line:** `lib/io.js:13`.
- **Explanation:** Synchronous read in the Shell main loop.
- **Severity:** Low. **Effectively a false positive for this workload** — only
  tiny `/proc`/`/sys` files are read. Measured **~19 µs per file read** (Phase 6);
  negligible at the 10 s default interval.
- **Proposed correction:** none required (documented justification).
- **Regression risk (if changed):** async reads would re-order the snapshot
  pipeline for no measurable benefit.

### W4 — `metadata/non-standard-field`: `original-authors`

- **File/line:** `metadata.json:8`.
- **Explanation:** `original-authors` (plural) is not a standard field; the
  standard field is `original-author` (singular).
- **Severity:** Low. Confirmed (non-standard spelling).
- **Proposed correction:** rename to `"original-author"` or drop it.
- **Regression risk:** None.

### W5 — `quality/private-api`: `Main.panel` access

- **File/line:** `ui/indicator.js:58` (`Main.panel.addToStatusArea(...)`).
- **Explanation:** Reviewer flags `Main.panel` as private API.
- **Severity:** Low. **Largely a false positive** — `Main.panel.addToStatusArea()`
  is the de-facto standard, documented way to add a panel indicator; the
  extension pins GNOME 50 only (satisfies version pinning).
- **Proposed correction:** none required.
- **Regression risk:** N/A.

### W6 — `quality/excessive-null-checks`: 50 null/undefined checks (ratio 0.023)

- **File/line:** across `lib/` (parsers + providers).
- **Explanation:** Static heuristic counting `null`/`undefined` guards.
- **Severity:** Low. **Intentional and justified** — defensive validation of
  unreliable `/proc`/`/sys` interfaces; the audit instruction says to retain
  legitimate error handling for unreliable hardware interfaces.
- **Proposed correction:** none (optionally trim a few redundant checks).
- **Regression risk:** N/A.

### W7 — `lifecycle/signal-balance`: 6 `.connect()` vs 2 `.disconnect()`

- **File/line:** `extension.js` (settings signals), `ui/menu.js:35`, `ui/menu.js:99`.
- **Explanation:** Static count suggests an imbalance.
- **Severity:** Low. **False positive — verified**:
  - All `_settings.connect(...)` handlers (incl. the 26 `REFRESH_KEYS`) are
    disconnected in `disable()` via the `_signalIds` loop.
  - `menu.js:35` `open-state-changed` is disconnected in `Menu.destroy()`.
  - `menu.js:99` `prefs.connect('activate')` is on a transient `PopupMenuItem`
    destroyed with the menu — standard GNOME pattern, no explicit disconnect.
  - `LoginManager` uses `connectObject(...)`/`disconnectObject(this)`.
  Corroborated by `resource-tracking/ownership: 0 orphans`.
- **Proposed correction:** none.
- **Regression risk:** N/A.

### W8 — `lifecycle/destroy-no-null`: `.destroy()` without null

- **File/line:** `extension.js:94` (`this._indicator.destroy()`).
- **Explanation:** Reviewer wants the reference nulled after destroy.
- **Severity:** Low. **False positive** — the next line reassigns
  `this._indicator = new Indicator(...)`; no stale-access window.
- **Proposed correction:** none.
- **Regression risk:** N/A.

### W9 — `gobject/missing-gtypename`

- **File/line:** `ui/progressBar.js:18`.
- **Explanation:** `GObject.registerClass` derives a generic GType name
  `ProgressBar`, which could collide with another extension's class in the
  same Shell process.
- **Severity:** Low/Medium. **Confirmed, worth fixing** (unique GTypeName is
  best practice).
- **Proposed correction:** `GObject.registerClass({ GTypeName:
  'VramRamProgressBar' }, class ProgressBar extends St.DrawingArea {...})`.
- **Regression risk:** None (internal GType name only).

### W10 (package lint only) — `metadata/uuid-matches-dir`

- **Explanation:** When linting the *extracted zip*, ego-lint reported
  `UUID does not match directory 'pkg-check'`. This is an artifact of this
  audit's temporary extraction directory, **not** a real defect (the real
  directory is correctly `vram-ram-status@local`). Recorded as NOT APPLICABLE.

## 7. Classification summary

| Class | Count | Items |
| --- | --- | --- |
| FAIL | 1 | F1 (missing url) |
| WARN | 10 (source) / 11 (package) | W1–W9 (+W10 artifact) |
| PASS | 207 | all remaining checks |
| SKIP | 12 | polkit, eslint, schema-usage, package/exists, version-gated |

## 8. Conclusion

ego-lint initially reported exit 1 with exactly one blocking issue
(`metadata/missing-url`). That issue was trivial and metadata-only; no security,
lifecycle, import, or packaging blockers were found. All warnings are either
false positives (verified) or low-severity style/robustness items.

## 9. Post-remediation result (after applying F1/F2/F3)

```bash
/tmp/gnome-extension-reviewer/ego-lint vram-ram-status@local --show all
```

**Exit status: 0 — no blocking issues.** Verdict: "MAY PASS WITH COMMENTS".

`231 checks — 210 passed, 0 failed, 9 warnings, 12 skipped`

Changes applied:

- F1: added `"url": "https://example.com/vram-ram-status"` (placeholder).
- F2: added `GTypeName: 'VramRamProgressBar'` to `GObject.registerClass`.
- F3: renamed `original-authors` → `original-author`.

The `gobject/missing-gtypename` warning and the `metadata/non-standard-field`
warning are both resolved. One new, expected warning appeared:
`metadata/url-format` (the placeholder is not a repository URL) — this resolves
automatically once the placeholder is replaced with the real URL. Final output
in `audit/ego-lint-output.txt`.



