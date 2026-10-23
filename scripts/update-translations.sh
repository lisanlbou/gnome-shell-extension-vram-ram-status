#!/usr/bin/env bash
# update-translations.sh — extract translatable strings and refresh catalogs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/memory-monitor@work_in_progress"
DOMAIN="memory-monitor@work_in_progress"
PODIR="$EXT/po"

cd "$EXT"

# 1. Collect every JavaScript source (nested directories included).
find . -type f -name '*.js' -not -path './node_modules/*' | sort > /tmp/mm-js-sources.txt

# 2. Extract the POT (English source strings).
xgettext --language=JavaScript --from-code=UTF-8 \
    --keyword=_ --keyword=ngettext:1,2 --keyword=pgettext:1c,2 \
    -f /tmp/mm-js-sources.txt -o "$PODIR/$DOMAIN.pot"

# 3. Refresh existing catalogs against the new POT (keeps translations).
for lang in es pt_BR; do
    po="$PODIR/$lang.po"
    if [ -f "$po" ]; then
        msgmerge --backup=none --update "$po" "$PODIR/$DOMAIN.pot"
    else
        msginit --no-translator --locale="$lang" \
            --input="$PODIR/$DOMAIN.pot" --output="$po"
    fi
done

# 4. Validate every catalog (format specifiers included).
for po in "$PODIR"/*.po; do
    [ -e "$po" ] || continue
    msgfmt --check --check-format --output-file=/dev/null "$po"
done

echo "Translations up to date in $PODIR"
