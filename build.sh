#!/usr/bin/env bash
# build.sh — test, compile the schema, and package the extension.
set -euo pipefail
cd "$(dirname "$0")"

EXT=memory-monitor@local

echo "==> Running unit tests"
gjs -m tests/run-tests.js

echo "==> Compiling GSettings schema"
glib-compile-schemas --strict "$EXT/schemas/"

echo "==> Packaging $EXT"
rm -f "$EXT.shell-extension.zip"
(cd "$EXT" && zip -qr "../$EXT.shell-extension.zip" . -x 'schemas/gschemas.compiled')

echo "==> Done: $EXT.shell-extension.zip"
echo "    Install with: gnome-extensions install $EXT.shell-extension.zip"
