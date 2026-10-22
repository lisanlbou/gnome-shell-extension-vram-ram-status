# Phase 1 — Baseline

Date of audit: 2026-10-22
Auditor role: GNOME Shell extension maintainer / security reviewer / GJS engineer.

## 1. Environment

| Item | Value |
| --- | --- |
| OS | Fedora 44 (Forty Four), Wayland session |
| GNOME Shell | 50.5 (`gnome-shell --version`) |
| GJS | 1.88.1 (ES modules, `gjs --version`) |
| glib-compile-schemas | 2.88.3 |
| GTK4 | 4.22.5 (`pkg-config --modversion gtk4`) |
| libadwaita | 1.9.4 (`pkg-config --modversion libadwaita-1`) |
| zip | Info-ZIP 3.0 |
| GPU (live) | AMD Radeon 880M/890M (Strix), `amdgpu`, vendor `0x1002`, single DRM card node `card1` |

This is a **real GNOME Shell graphical session** (Wayland), so runtime
observations below are genuine, not simulated.

## 2. Repository structure

Project root: `/home/lisandro-dev/Documents/Projects/VRAM-tray`

Extension root (the directory that is packaged and installed): **`vram-ram-status@local/`**.

```
VRAM-tray/
├── .git/
├── .gitignore
├── INSTALL.md
├── build.sh                 <- build process (tests + schema compile + zip)
├── plan.md
├── tests/                   <- headless unit tests (gjs -m tests/run-tests.js)
└── vram-ram-status@local/   <- EXTENSION ROOT
    ├── extension.js         <- entry point (ES module, default export)
    ├── prefs.js             <- preferences (ExtensionPreferences)
    ├── metadata.json
    ├── stylesheet.css
    ├── LICENSE              <- GPL-2.0-or-later
    ├── README.md, CHANGELOG.md
    ├── schemas/org.gnome.shell.extensions.vram-ram-status.gschema.xml
    ├── schemas/gschemas.compiled  <- build artifact (gitignored, NOT tracked)
    ├── lib/                 <- pure logic + Shell-side helpers
    │   ├── alerts.js, color.js, format.js, io.js, model.js, monitor.js,
    │   │   notify.js, settings.js
    │   ├── gpu/{counters,discovery,selection}.js
    │   ├── gpu/providers/{amd,intel,nvidia}.js
    │   └── memory/ram.js
    └── ui/{indicator,menu,progressBar}.js
```

### Build process

`build.sh`:
1. `gjs -m tests/run-tests.js` — run the unit tests.
2. `glib-compile-schemas --strict "$EXT/schemas/"` — compile the schema (strict).
3. `zip -qr` the extension directory into `vram-ram-status@local.shell-extension.zip`.

The zip is produced at the repo root and is gitignored.

## 3. Git state

- Branch: `main`
- Working tree: **clean** at audit start (`git status` → nothing to commit).
- Current commit: **`0397e6640b6082cc6cd2d53e759ebd455eb4ae02`** (`0397e66 Remove completed complexity audit plan`).
- 22 commits in history; the pre-audit baseline of the original extension is
  commit `14fb73f` (documented in the handover file).

## 4. Generated files, build artifacts, ZIPs

At audit start:

| Artifact | Status |
| --- | --- |
| `vram-ram-status@local/schemas/gschemas.compiled` | Present, **not tracked** (in `.gitignore`) |
| `*.zip` at repo root | **None** at audit start (`ls *.zip` → no match) |
| `build/`, `dist/` | Not present |
| `audit/` | Created by this audit (untracked) |

After running `build.sh` (Phase 7), `vram-ram-status@local.shell-extension.zip`
is created (47,605 bytes) and remains gitignored. `git status` stays clean.

## 5. Existing tests — run without modification

Command: `gjs -m tests/run-tests.js`

Result: **329 passed, 0 failed** — exit code 0.

14 suites executed: model, ram, format, amd, counters, discovery, selection,
providers, monitor, monitor-lifecycle, monitor-recovery, settings, alerts,
color.

No failures. No modifications were made to any test or source file.

## 6. Installed extension state

- Installed path:
  `~/.local/share/gnome-shell/extensions/vram-ram-status@local`
  → **symlink** to `/home/lisandro-dev/Documents/Projects/VRAM-tray/vram-ram-status@local`.
- `gnome-extensions info vram-ram-status@local` → `Version: 2.0.0`,
  `Enabled: Yes`, `State: ACTIVE`.
- Per-user schema present at
  `~/.local/share/glib-2.0/schemas/org.gnome.shell.extensions.vram-ram-status.gschema.xml`.

> The installed extension is a symlink to the source tree, so the source under
> audit is the same code the running Shell is executing. No source files were
> changed during this phase.

## 7. Baseline notes / constraints honored

- UUID preserved: `vram-ram-status@local`.
- Schema id: `org.gnome.shell.extensions.vram-ram-status`.
- Only GNOME Shell `["50"]` declared supported.
- No synchronous subprocesses in the Shell process; no network; no root; reads
  only `/proc/meminfo` and `/sys/class/drm/...`.
