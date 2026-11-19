#!/bin/bash
# Regenerate the site icons from the SVG sources. Run from the repo root.
#   static/favicon.svg            small/tab-size design (zoomed tulips)
#   scripts/app-icon.svg          large design, rounded tile (Android/manifest)
#   scripts/apple-touch-icon.svg  large design, full-bleed square (iOS masks it)
# Requires: rsvg-convert (librsvg) and ImageMagick.
# After changing the icon, bump ?v= in layouts/partials/favicon.html and
# static/site.webmanifest so browsers refresh their cached copies.
set -euo pipefail

for cmd in rsvg-convert convert; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd (install librsvg2-bin / imagemagick)"; exit 1; }
done

S=static
SMALL="$S/favicon.svg"
APP=scripts/app-icon.svg
APPLE=scripts/apple-touch-icon.svg
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

rsvg-convert -w 16  -h 16  "$SMALL" -o "$S/favicon-16x16.png"
rsvg-convert -w 32  -h 32  "$SMALL" -o "$S/favicon-32x32.png"
rsvg-convert -w 48  -h 48  "$SMALL" -o "$TMP/48.png"
convert "$S/favicon-16x16.png" "$S/favicon-32x32.png" "$TMP/48.png" "$S/favicon.ico"

rsvg-convert -w 180 -h 180 "$APPLE" -o "$S/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 "$APP"   -o "$S/android-chrome-192x192.png"
rsvg-convert -w 512 -h 512 "$APP"   -o "$S/android-chrome-512x512.png"

echo "Icons regenerated in $S/"
