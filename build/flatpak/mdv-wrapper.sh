#!/bin/bash
# zypak-wrapper from org.electronjs.Electron2.BaseApp adapts Chromium's
# sandbox to flatpak's bubblewrap so the renderer can sandbox without
# the setuid chrome-sandbox helper.
exec zypak-wrapper /app/mdv/mdv "$@"
