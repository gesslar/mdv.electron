# Changelog

## 1.1.0

### Added

- Multi-window support: opening additional files spawns separate windows, each with its own file watcher and rendered view.
- Single-instance lock in packaged builds; subsequent launches forward their argv to the running process, which focuses an existing window if it already shows the requested file or opens a new one otherwise. Dev runs (`electron .`) skip the lock so the debugger can attach to its own child.
- Custom titlebar with Window Controls Overlay: minimize, maximize/restore, and close buttons rendered in-app on Windows/Linux; native traffic lights remain on macOS.
- Stage context menu with rich-text Copy. Both Ctrl+C and the menu write `text/html` and `text/plain` payloads so pasted content keeps formatting in rich-text targets.
- Keyboard shortcuts: Ctrl+O to open a file, Ctrl+W to close the window.

### Changed

- File watchers are now keyed per-window so closing one window cannot tear down another window's watcher.
- Replaced `cli:get-args` with `cli:get-file`; renderer now asks main for the file the window was launched with instead of parsing argv itself.
- Renderer reports the active file back to main via `window:set-current-file` so dedupe stays accurate after in-app file dialogs.
- Dev tools toggle (Ctrl+Shift+I) moved from a global shortcut to a per-window `before-input-event` handler.

## 1.0.2

### Added

- AppImage build pipeline: `electron-builder.cjs` AppImage configuration, an excludelist, and `scripts/appdir-lint.sh` to validate the produced AppDir.
- Dependabot configuration for the npm ecosystem.

### Fixed

- Stale filename in the title/UI after opening a different file from within the app.
- Release workflow regression.

### Changed

- `scripts/clean-out.mjs` updated to match the new build output layout.

## 1.0.1

### Added

- Flatpak packaging: manifest (`dev.gesslar.mdv.yml`), desktop entry, AppStream metainfo, wrapper script, and `scripts/build-flatpak.mjs` to drive the build.
- Release workflow step for Flatpak artefacts.
- Screenshots and an expanded `DEVELOPMENT.md`.

## 1.0.0

Initial release.
