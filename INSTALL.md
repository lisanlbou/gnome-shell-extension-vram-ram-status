# Memory Monitor — Installation

Steps to install the **Memory Monitor** extension (UUID
`memory-monitor@local`) for GNOME Shell 50 on Fedora Workstation (Wayland).

No root privileges are required — everything installs under `~/.local`.

## 1. Prerequisites

- Fedora Workstation on **Wayland**
- GNOME Shell **50** (tested on 50.5)

## 2. Install (development, from this checkout)

Run these from the project root (the directory that contains
`memory-monitor@local/`):

```sh
# 2a. Compile the GSettings schema (strict)
glib-compile-schemas --strict memory-monitor@local/schemas/

# 2b. Link the extension into the per-user extensions directory
ln -s "$PWD/memory-monitor@local" \
    ~/.local/share/gnome-shell/extensions/memory-monitor@local

# 2c. Make the schema visible to the running session
mkdir -p ~/.local/share/glib-2.0/schemas
cp memory-monitor@local/schemas/org.gnome.shell.extensions.memory-monitor.gschema.xml \
    ~/.local/share/glib-2.0/schemas/
glib-compile-schemas ~/.local/share/glib-2.0/schemas/
```

> **Important:** GNOME Shell only scans the extensions directory **at
> startup**. If the extension was added while the Shell was already running,
> you must **log out and log back in** before it is discoverable. On Wayland
> there is no safe in-place reload (do not use Alt+F2 → `r`).

## 3. Enable and open preferences

After logging back in:

```sh
gnome-extensions enable memory-monitor@local
gnome-extensions prefs memory-monitor@local
```

Then configure Display, Hardware, Monitoring and Alerts pages to taste.

## 4. Install (packaged `.zip`, no dev checkout)

Build the bundle and install it:

```sh
./build.sh
gnome-extensions install memory-monitor@local.shell-extension.zip
```

`build.sh` runs the unit tests, compiles the schema, and packages the whole
extension directory into a zip. `gnome-extensions install` compiles the schema
on install.

Then log out/in and enable as in step 3.

## 5. Uninstall

```sh
gnome-extensions uninstall memory-monitor@local

# If you used the development install, also remove the symlink and schema:
rm -f ~/.local/share/gnome-shell/extensions/memory-monitor@local
rm -f ~/.local/share/glib-2.0/schemas/org.gnome.shell.extensions.memory-monitor.gschema.xml
glib-compile-schemas ~/.local/share/glib-2.0/schemas/
```

## 6. Troubleshooting

- **`gnome-extensions enable` says "does not exist"** — the running Shell
  started before the extension existed. Log out and log back in.
- **`gnome-extensions prefs` prints usage** — the command is `prefs`
  (not `pref`).
- **To verify it loaded** — `gnome-extensions info memory-monitor@local`
  should show `State: ACTIVE`.
- **To watch for errors** —
  `journalctl --user -f -o cat | grep -i memory-monitor`.
- **VRAM shows "N/A" or "unavailable"** — confirm the counters exist under
  `/sys/class/drm/card*/device/` (AMD), or that an NVIDIA helper is configured
  (Intel integrated GPUs intentionally report shared/unavailable).
