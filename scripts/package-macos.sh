#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/dist/Eve.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
ICON_SRC="$ROOT/frontend/public/eve.svg"
ICONSET="$RESOURCES/Eve.iconset"
ICON_PNG_DIR="$ROOT/tmp/macos-icon"

rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RESOURCES"

npm run build --prefix "$ROOT/frontend"
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o "$RESOURCES/EveServer" "$ROOT"
swiftc "$ROOT/macos/EveLauncher.swift" -o "$MACOS/Eve" -framework Cocoa -framework WebKit

cp "$ICON_SRC" "$RESOURCES/eve.svg"
rm -rf "$ICONSET" "$ICON_PNG_DIR"
mkdir -p "$ICONSET" "$ICON_PNG_DIR"
qlmanage -t -s 1024 -o "$ICON_PNG_DIR" "$ICON_SRC" >/dev/null 2>&1
ICON_BASE="$(find "$ICON_PNG_DIR" -type f -name '*.png' | head -1)"
if [ -n "$ICON_BASE" ]; then
  sips -z 16 16     "$ICON_BASE" --out "$ICONSET/icon_16x16.png" >/dev/null
  sips -z 32 32     "$ICON_BASE" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32     "$ICON_BASE" --out "$ICONSET/icon_32x32.png" >/dev/null
  sips -z 64 64     "$ICON_BASE" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128   "$ICON_BASE" --out "$ICONSET/icon_128x128.png" >/dev/null
  sips -z 256 256   "$ICON_BASE" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256   "$ICON_BASE" --out "$ICONSET/icon_256x256.png" >/dev/null
  sips -z 512 512   "$ICON_BASE" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512   "$ICON_BASE" --out "$ICONSET/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "$ICON_BASE" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
  iconutil -c icns "$ICONSET" -o "$RESOURCES/Eve.icns"
fi

cat > "$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Eve</string>
  <key>CFBundleIdentifier</key>
  <string>local.eve.container-dashboard</string>
  <key>CFBundleName</key>
  <string>Eve</string>
  <key>CFBundleDisplayName</key>
  <string>Eve</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>Eve</string>
  <key>CFBundleShortVersionString</key>
  <string>0.3.0</string>
  <key>CFBundleVersion</key>
  <string>0.3.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

chmod +x "$MACOS/Eve" "$RESOURCES/EveServer"
echo "Built $APP_DIR"
