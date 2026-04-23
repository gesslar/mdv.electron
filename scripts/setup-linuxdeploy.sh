#!/usr/bin/env bash
# Downloads linuxdeploy-x86_64.AppImage into the Tauri cache directory.
# Used in CI to ensure linuxdeploy is available for bundling.

set -euo pipefail

LINUXDEPLOY_URL="https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage"
CACHE_DIR="$HOME/.cache/tauri"
DEST="$CACHE_DIR/linuxdeploy-x86_64.AppImage"

mkdir -p "$CACHE_DIR"

echo "Downloading linuxdeploy-x86_64.AppImage..."
curl -fSL -o "$DEST" "$LINUXDEPLOY_URL"
chmod +x "$DEST"

echo "Installed linuxdeploy to $DEST"
"$DEST" --version 2>&1 || true
