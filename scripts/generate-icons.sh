#!/bin/bash
# Generate all Tauri-required icon sizes from icon.svg
# Requires: rsvg-convert (brew install librsvg), iconutil (macOS built-in)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_DIR/src-tauri/icons"
SVG_FILE="$ICONS_DIR/icon.svg"
ICONSET_DIR="$ICONS_DIR/icon.iconset"

echo "Generating icons from $SVG_FILE..."

# Generate PNGs at required sizes
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONS_DIR/icon.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONS_DIR/32x32.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ICONS_DIR/128x128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONS_DIR/128x128@2x.png"

echo "PNGs generated."

# Generate macOS .icns using iconutil
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

rsvg-convert -w 16   -h 16   "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16.png"
rsvg-convert -w 32   -h 32   "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16@2x.png"
rsvg-convert -w 32   -h 32   "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32.png"
rsvg-convert -w 64   -h 64   "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32@2x.png"
rsvg-convert -w 128  -h 128  "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128.png"
rsvg-convert -w 256  -h 256  "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128@2x.png"
rsvg-convert -w 256  -h 256  "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256.png"
rsvg-convert -w 512  -h 512  "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256@2x.png"
rsvg-convert -w 512  -h 512  "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512.png"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"
rm -rf "$ICONSET_DIR"

echo "macOS .icns generated."

# Generate Windows .ico
# ICO needs multiple sizes embedded. Use ImageMagick convert if available,
# otherwise create a simple ICO from the 256x256 PNG.
if command -v convert &>/dev/null; then
  # ImageMagick available
  rsvg-convert -w 256 -h 256 "$SVG_FILE" -o /tmp/panescale-ico-256.png
  rsvg-convert -w 64  -h 64  "$SVG_FILE" -o /tmp/panescale-ico-64.png
  rsvg-convert -w 48  -h 48  "$SVG_FILE" -o /tmp/panescale-ico-48.png
  rsvg-convert -w 32  -h 32  "$SVG_FILE" -o /tmp/panescale-ico-32.png
  rsvg-convert -w 16  -h 16  "$SVG_FILE" -o /tmp/panescale-ico-16.png
  convert /tmp/panescale-ico-16.png /tmp/panescale-ico-32.png /tmp/panescale-ico-48.png /tmp/panescale-ico-64.png /tmp/panescale-ico-256.png "$ICONS_DIR/icon.ico"
  rm -f /tmp/panescale-ico-*.png
  echo "Windows .ico generated (multi-size via ImageMagick)."
elif command -v magick &>/dev/null; then
  # ImageMagick v7
  rsvg-convert -w 256 -h 256 "$SVG_FILE" -o /tmp/panescale-ico-256.png
  rsvg-convert -w 64  -h 64  "$SVG_FILE" -o /tmp/panescale-ico-64.png
  rsvg-convert -w 48  -h 48  "$SVG_FILE" -o /tmp/panescale-ico-48.png
  rsvg-convert -w 32  -h 32  "$SVG_FILE" -o /tmp/panescale-ico-32.png
  rsvg-convert -w 16  -h 16  "$SVG_FILE" -o /tmp/panescale-ico-16.png
  magick /tmp/panescale-ico-16.png /tmp/panescale-ico-32.png /tmp/panescale-ico-48.png /tmp/panescale-ico-64.png /tmp/panescale-ico-256.png "$ICONS_DIR/icon.ico"
  rm -f /tmp/panescale-ico-*.png
  echo "Windows .ico generated (multi-size via magick)."
else
  # Fallback: use a node script to create ICO, or just use PNG renamed
  echo "WARNING: ImageMagick not found. Creating ICO with npm to-ico package..."
  cd "$PROJECT_DIR"
  npx --yes to-ico "$ICONS_DIR/32x32.png" "$ICONS_DIR/128x128.png" "$ICONS_DIR/128x128@2x.png" > "$ICONS_DIR/icon.ico" 2>/dev/null || {
    # Ultimate fallback: use sips to create a proper PNG and wrap as ICO manually
    echo "Falling back to node script for ICO generation..."
    node -e "
      const fs = require('fs');
      const png256 = fs.readFileSync('$ICONS_DIR/128x128@2x.png');
      const png32 = fs.readFileSync('$ICONS_DIR/32x32.png');
      // Simple ICO: just embed the 256x256 PNG
      const images = [png32, png256];
      const headerSize = 6 + images.length * 16;
      let offset = headerSize;
      const header = Buffer.alloc(headerSize);
      header.writeUInt16LE(0, 0);      // reserved
      header.writeUInt16LE(1, 2);      // ICO type
      header.writeUInt16LE(images.length, 4); // image count
      for (let i = 0; i < images.length; i++) {
        const size = i === 0 ? 32 : 0; // 0 means 256
        const entryOffset = 6 + i * 16;
        header.writeUInt8(size, entryOffset);      // width
        header.writeUInt8(size, entryOffset + 1);  // height
        header.writeUInt8(0, entryOffset + 2);     // palette
        header.writeUInt8(0, entryOffset + 3);     // reserved
        header.writeUInt16LE(1, entryOffset + 4);  // planes
        header.writeUInt16LE(32, entryOffset + 6); // bpp
        header.writeUInt32LE(images[i].length, entryOffset + 8); // size
        header.writeUInt32LE(offset, entryOffset + 12); // offset
        offset += images[i].length;
      }
      fs.writeFileSync('$ICONS_DIR/icon.ico', Buffer.concat([header, ...images]));
      console.log('ICO created with node fallback.');
    "
  }
fi

echo ""
echo "Icon generation complete. Files:"
ls -la "$ICONS_DIR/"
