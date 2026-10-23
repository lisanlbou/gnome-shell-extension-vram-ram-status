#!/usr/bin/env bash
# build.sh — test, compile the schema, validate translations, and package.
set -euo pipefail
cd "$(dirname "$0")"

EXT=memory-monitor@work_in_progress
DOMAIN=memory-monitor@work_in_progress
OUT="$EXT.shell-extension.zip"

echo "==> Running unit tests"
gjs -m tests/run-tests.js

echo "==> Compiling GSettings schema"
glib-compile-schemas --strict "$EXT/schemas/"

echo "==> Validating translations"
for po in "$EXT"/po/*.po; do
    [ -e "$po" ] || continue
    msgfmt --check --check-format --output-file=/dev/null "$po"
done

echo "==> Packaging $EXT"
rm -f "$OUT"
# gnome-extensions pack only auto-includes metadata.json, extension.js,
# prefs.js, stylesheet*.css and schemas/. Everything else must be listed via
# --extra-source (paths are relative to the SOURCE-DIRECTORY). Translations are
# compiled from po/ into locale/<lang>/LC_MESSAGES/$DOMAIN.mo.
gnome-extensions pack \
    --force \
    --podir=po \
    --gettext-domain="$DOMAIN" \
    --extra-source=lib \
    --extra-source=ui \
    --extra-source=LICENSE \
    --extra-source=README.md \
    --extra-source=CHANGELOG.md \
    "$EXT"

echo "==> Done: $OUT"
echo "    Install with: gnome-extensions install $OUT"
