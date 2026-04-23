#!/bin/bash
# Post-process Tauri-built RPM to:
# 1. Set the Vendor field
# 2. Add InitialPreference to the desktop file

set -e

VENDOR="Gess, Daddy!"

VERSION=$(jq -r ".version" package.json)
NAME=$(jq -r ".name" package.json)
RPM_FILE="src-tauri/target/release/bundle/rpm/$NAME-$VERSION-1.$(arch).rpm"

if [[ ! -f "$RPM_FILE" ]]; then
  echo "No such file: $RPM_FILE"
  exit 1
fi

echo "=== Fixing RPM: $RPM_FILE ==="

# Create a temporary script for --change-files
CHANGE_FILES_SCRIPT=$(mktemp)
cat > "$CHANGE_FILES_SCRIPT" <<'SCRIPT'
#!/bin/bash
set -e

# Add InitialPreference to desktop file
DESKTOP=$(find $RPM_BUILD_ROOT -name 'mdv.desktop' -type f | head -1)
if [[ -n "$DESKTOP" ]] && grep -q '^MimeType=' "$DESKTOP" && ! grep -q '^InitialPreference=' "$DESKTOP"; then
  sed -i '/^MimeType=/a InitialPreference=80' "$DESKTOP"
  echo "Added InitialPreference=80"
fi
SCRIPT
chmod +x "$CHANGE_FILES_SCRIPT"

rpmrebuild --batch --notest-install --package \
  --change-spec-preamble='sed -e "/^Vendor:/d; /^Group:/a Vendor: '"$VENDOR"'"' \
  --change-files="$CHANGE_FILES_SCRIPT" \
  "$RPM_FILE"

rm -f "$CHANGE_FILES_SCRIPT"

# rpmrebuild outputs to ~/rpmbuild/RPMS/, move it back
REBUILT=$(find ~/rpmbuild/RPMS/ -name "$(basename "$RPM_FILE")" -type f | head -1)

if [[ -z "$REBUILT" ]]; then
  echo "Rebuilt RPM not found"
  exit 1
fi

mv "$REBUILT" "$RPM_FILE"
echo "=== Done: $RPM_FILE ==="
