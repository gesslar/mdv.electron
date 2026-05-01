# Changelog

## 1.4.0

### Added

- Custom highlight.js themes: `highlight-dark.css` (derived from gesslar's blackboard themepack, with diff colors pulled from the editor `colors` block rather than `tokenColors`) and a matching `highlight-light.css`. Both expand the hljs class vocabulary beyond what the stock `github.css` covered, with colors expressed in OKLCH.
- Link styling tokens — `--link-color`, `--link-underline-color`, `--link-underline-offset`, `--link-underline-style` — themed per mode so light mode uses `--color-pink-800` and dark uses `--color-pink-400` instead of one hard-coded shade.
- `.document-local-link` and `.browser-link` classes on rendered anchors. The link-icon hover/scale now triggers from `:hover` on the link itself (`.local-file-link:hover + &`, `.browser-link:hover + &`) rather than from hovering the icon.

### Changed

- Inline code background bumped from 10% to 20% pink-400 mix for better contrast against the page.
- `index.html` and `UI.js` now load `css/highlight-{dark,light}.css` instead of `css/github{,-dark}.css`.
- `.markdownlint.yaml` also disables MD024 (duplicate headings).

### Removed

- `src/ui/css/github.css` (one-line `@import` of the upstream highlight.js stylesheet); superseded by the custom themes above.

## 1.3.0

### Added

- Local-file link handling: clicking a relative or absolute path in a rendered document now opens the target in a new mdv window (or hands off to the OS via `shell.openPath` for non-markdown files), instead of failing with Chromium's "Not allowed to load local resource" error. Hrefs are resolved against the source document's directory using `@gesslar/toolkit`'s `FileObject`/`FileSystem`, so behavior is the same on Linux, macOS, and Windows.
- Notification center: a bell button at the right edge of the status bar opens a slide-in panel listing all notifications with per-item dismiss and a clear-all action; new notifications also appear as bottom-right toasts. Info toasts auto-dismiss after 5s; warn/error toasts persist until dismissed. Opening the panel marks everything read and clears any visible toasts.
- Toasts wired at previously silent failure points: file-load failure, file-dialog open failure, invalid drag-drop, dropped-file read failure, code-copy clipboard failure, and hot-reload set-up/reload failures.
- "Already open" feedback when the open dialog selects a file that's already showing in another window — the existing window is focused (via a new `window:focus-if-open` IPC) and an info toast notes the redirect.
- "File not found" and "Could not open" toasts surfaced from main when a clicked link target doesn't exist or the OS has no associated app for the file's extension.
- `toast(severity, message)` helper in `Logging.js` and a `mdv.notify.onPush` preload bridge so any module — and main, over IPC — can raise a notification with one call.
- Shared `HtmlEscape.js` module providing `escapeHtml` and `escapeAttr`; replaces duplicated copies that lived in `ld-select.js`.

### Changed

- Filename moved to the left of the status bar; the right edge now hosts a toolbutton group (currently the notification bell).
- `.toolbutton` and `.btn-action` styles lifted out of the titlebar scope so the same chrome (no-drag, hover tint, height) applies in the status bar, notification panel, and toasts. Disabled buttons drop to 40% opacity with the hover tint suppressed.
- Link-renderer output: `href` and `title` attributes are now HTML-attribute-encoded across all three render branches (anchor, external, local-file), so a literal `"` or `&` in markdown link metadata can no longer break out of the attribute.

## 1.2.0

### Added

- Floating TOC bar: the table of contents now lives as a top-right pill that collapses to a single FAB and expands to a row of [hide] [scroll-to-top] [heading select] [scroll-to-bottom]. Replaces the previous fixed-width sidebar list, freeing the stage to span full width.
- `ld-select`: a light-DOM custom element replacement for `<select>`, used as the heading picker in the TOC bar. Sizes itself to the longest option label (native-style auto-sizing); fully theme-able through `--ld-select-*` custom properties so it can be reused outside this app.
- TOC scrollspy: as the document scrolls, the heading select reflects the topmost heading whose top has crossed the stage edge. The select setter doesn't fire `change`, so there's no scroll-feedback loop.
- `PRIVACY.md` describing the app's data handling.

### Changed

- The first H1 is no longer stripped from the rendered document — it stays as both the window-title source and the first TOC entry.
- `--shadow-md` retuned to a tight palette-tinted inset+outset glow so dark-mode elevation reads as a soft pink halo instead of the previous white-on-dark drop shadow.
- Heading anchors are no longer rendered as inline `<li><a>` markup; the document keeps the headings themselves and the TOC routes via the heading-select component.

### Removed

- The old TOC flat-list (`toc.html` template, `.toc-link`/`.toc-item` markup, and the IntersectionObserver that drove the `[visible]` highlight). Superseded by the FAB + select + scrollspy combo.

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
