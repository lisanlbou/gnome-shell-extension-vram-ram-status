// lib/gettext.js — shared translation helpers for Shell-side modules.
//
// GNOME 45+ exposes gettext/ngettext/pgettext from the extension module, bound
// to the extension's own domain (metadata.json "gettext-domain", falling back
// to the UUID). This tiny module re-exports them so every Shell-side UI module
// can import `_`, `ngettext` and `pgettext` without importing the project's
// entry-point extension.js (which would create a circular dependency).
//
// Preferences use the equivalent helpers from
// resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js directly in
// prefs.js; do NOT import this Shell-only module from preferences code.

import {
    gettext,
    ngettext,
    pgettext,
} from 'resource:///org/gnome/shell/extensions/extension.js';

export { gettext as _, ngettext, pgettext };