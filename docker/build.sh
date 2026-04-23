#!/usr/bin/env bash
# Build mdv bundles inside a Linux container.
#
#   docker/build.sh fedora    # -> dist/fedora/*.rpm
#   docker/build.sh debian      # -> dist/debian/*.deb
#   docker/build.sh appimage    # -> dist/appimage/*.AppImage
#
# Named volumes are used for src-tauri/target and node_modules so the host
# project tree isn't polluted with Linux build artefacts (and Windows-side
# target/ stays untouched).

set -euo pipefail

DISTRO="${1:-}"
case "$DISTRO" in
  fedora|debian|appimage) ;;
  *)
    echo "usage: $0 {fedora|debian|appimage}" >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKERFILE="$SCRIPT_DIR/Dockerfile.$DISTRO"
IMAGE="mdv-build-$DISTRO:latest"
TARGET_VOL="mdv-$DISTRO-target"
NODE_VOL="mdv-$DISTRO-node_modules"
CARGO_VOL="mdv-$DISTRO-cargo-registry"

mkdir -p "$PROJECT_DIR/dist/$DISTRO"

echo "==> building image $IMAGE"
docker build -f "$DOCKERFILE" -t "$IMAGE" "$PROJECT_DIR"

echo "==> running $IMAGE"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "$PROJECT_DIR":/build \
  -v "$TARGET_VOL":/build/src-tauri/target \
  -v "$NODE_VOL":/build/node_modules \
  -v "$CARGO_VOL":/opt/cargo/registry \
  "$IMAGE"

echo "==> done. Artefacts in dist/$DISTRO/"
ls -lh "$PROJECT_DIR/dist/$DISTRO/"
