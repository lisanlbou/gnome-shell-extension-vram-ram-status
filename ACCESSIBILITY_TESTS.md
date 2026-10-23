# Accessibility tests — Memory Monitor

Manual steps to validate keyboard and screen-reader access. Run in a live GNOME
Shell session. **All items are currently NOT TESTED** (no Orca / interactive
session was available in this environment); tick each box after verifying.

## Setup

1. Install and enable the extension (see `INSTALL.md`).
2. Start Orca (Super+Alt+S, or `orca` in a terminal).
3. Optionally enable High Contrast from GNOME Settings → Accessibility.

## Panel indicator

- [ ] Tab / Super+Tab focus reaches the panel control; its accessible name is
      "Memory Monitor" (or the localized equivalent) and each metric (RAM/VRAM)
      is separately identifiable.
- [ ] When an alert is active, Orca announces "warning" or "critical" (a word),
      not just the ⚠/⛔ glyph.
- [ ] Values ("4.2/16G 26%") are read in full (no ellipsis/truncation).
- [ ] High-contrast and large-font modes keep the marker, values and colors legible.
- [ ] RTL layout (e.g. `ar`) renders the metrics without overlapping.

## Dropdown menu

- [ ] Opening the menu with the keyboard announces the first item.
- [ ] Tab / Shift+Tab move through menu items; Down/Up arrows navigate.
- [ ] The RAM/VRAM progress bars are announced as progress bars with a
      percentage (not as blank canvases).
- [ ] Enter / Space activates "Preferences".
- [ ] Escape closes the menu and returns focus to the panel control.
- [ ] While the menu is open and metrics refresh, focus is **not** lost and
      Orca does not re-announce the whole menu every sampling tick.

## Preferences

- [ ] Every page, group, row, combo and switch is reachable with the keyboard
      and has a readable label/description.
- [ ] Combo rows (GPU, format, order, unit, color target, panel box, refresh
      interval) can be changed with the keyboard.
- [ ] The About page values (version, author, GPU support) are readable.

## Results

| Check | Result |
| --- | --- |
| Panel indicator keyboard focus | Not tested |
| Panel indicator Orca announcements | Not tested |
| Progress bar role/value announcement | Not tested |
| Menu keyboard navigation | Not tested |
| Menu focus stability during refresh | Not tested |
| Preferences keyboard navigation | Not tested |
| High contrast / large font | Not tested |
| RTL layout | Not tested |
