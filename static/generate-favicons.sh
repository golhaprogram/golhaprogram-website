#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &>/dev/null; then
  echo "This script requires ImageMagick. Please install it first."
  echo "For Ubuntu/Debian: sudo apt-get install imagemagick"
  echo "For macOS: brew install imagemagick"
  exit 1
fi

# Base directory
BASE_DIR="$(pwd)/static"
SVG_FILE="$BASE_DIR/favicon.svg"

# Create required favicon sizes
convert -background none -size 16x16 "$SVG_FILE" "$BASE_DIR/favicon-16x16.png"
convert -background none -size 32x32 "$SVG_FILE" "$BASE_DIR/favicon-32x32.png"
convert -background none -size 180x180 "$SVG_FILE" "$BASE_DIR/apple-touch-icon.png"
convert -background none -size 192x192 "$SVG_FILE" "$BASE_DIR/android-chrome-192x192.png"
convert -background none -size 512x512 "$SVG_FILE" "$BASE_DIR/android-chrome-512x512.png"

## Create a basic OG image with some text
#convert -size 1200x630 xc:white \
#    -gravity center \
#    -pointsize 72 \
#    -font Arial \
#    -draw "text 0,0 'برنامه‌های گلها'" \
#    -pointsize 36 \
#    -draw "text 0,100 'آرشیو موسیقی و شعر ایران'" \
#    -draw "image over 540,265 120,120 '$SVG_FILE'" \
#    "$BASE_DIR/images/golha-og-image.jpg"

echo "All favicon images have been generated in the static directory"
echo "Remember to customize the OG image with proper branding later"

