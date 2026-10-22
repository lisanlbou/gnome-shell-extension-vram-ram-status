# Phase 7 — Package Validation

## Build

Used the project's existing build process without overwriting the installed
extension:

```bash
./build.sh
```

`build.sh` runs the unit tests (329/0), compiles the schema
(`glib-compile-schemas --strict`), and zips `vram-ram-status@local/` into
`vram-ram-status@local.shell-extension.zip` (47,605 bytes). It does **not**
install anything, so the installed (symlinked) extension was untouched.

## Package contents (33 files)

- `metadata.json`, `extension.js`, `prefs.js`, `stylesheet.css`
- `LICENSE` (GPL-2.0-or-later full text), `README.md`, `CHANGELOG.md`
- `schemas/org.gnome.shell.extensions.vram-ram-status.gschema.xml`
- `schemas/gschemas.compiled` (compiled schema — expected for GNOME 45+)
- `lib/…` (16 modules), `ui/…` (3 modules)

## Checks

| Check | Result |
| --- | --- |
| Required files present | PASS (metadata.json, extension.js, prefs.js, stylesheet.css, schema, LICENSE) |
| Metadata matches extension | PASS (uuid/name/description/version correct) |
| Schema valid | PASS (`glib-compile-schemas --strict` clean; ego-lint `schema/compile` dry-run clean) |
| Imports resolve | PASS (ego-lint import BFS + the extension is ACTIVE from this exact tree) |
| No `.git` directory | PASS |
| No test fixtures | PASS (no `tests/`) |
| No audit reports | PASS (no `audit/`) |
| No dev-only dependencies | PASS |
| No caches / temp files | PASS (no `__pycache__`, `*.pyc`, `*.log`, `*.tmp`, `*.swp`) |
| No unrelated scripts | PASS (no `build.sh`, no `INSTALL.md`, no `plan.md`) |
| Licensing | PASS (GPL-2.0-or-later `LICENSE` present and full) |
| No sensitive data | PASS |

## ego-lint on the extracted package

```bash
/tmp/gnome-extension-reviewer/ego-lint /tmp/pkg-check --show all
```

Result: `230 checks — 206 passed, 1 failed, 11 warnings, 12 skipped`. The single
FAIL is again `metadata/missing-url`. The one extra warning vs the source tree
(`metadata/uuid-matches-dir`) is an artifact of the temporary extraction folder
name `pkg-check`, not a real defect. Full output: `audit/ego-lint-output-package.txt`.

## Conclusion

The distributable package is well-formed and contains only the extension. After
the remediation pass it lints clean (ego-lint exit 0 on the extracted package).
The `url` field is a placeholder and must be replaced with the real URL before
submission. Nothing was uploaded to extensions.gnome.org.
