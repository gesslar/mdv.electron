#!/usr/bin/env bash
# Called by npm's "version" lifecycle hook.
# Reads the new version from package.json and updates
# src-tauri/tauri.conf.json and src-tauri/Cargo.toml to match.

set -euo pipefail

VERSION="$npm_package_version"

# Update tauri.conf.json
TAURI_CONF="src-tauri/tauri.conf.json"
tmp=$(mktemp)
jq --arg v "$VERSION" '.version = $v' "$TAURI_CONF" > "$tmp" && mv "$tmp" "$TAURI_CONF"

# Update Cargo.toml
CARGO_TOML="src-tauri/Cargo.toml"
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" "$CARGO_TOML"

# Stage the updated files so they're included in npm's auto-commit
git add "$TAURI_CONF" "$CARGO_TOML"
