# mdv

A fast, minimal desktop markdown viewer built with Electron and vanilla JavaScript.

## Features

- **Markdown rendering** with full CommonMark support via [marked](https://github.com/markedjs/marked)
- **Syntax highlighting** for code blocks using highlight.js with GitHub themes
- **Copy-to-clipboard** on code blocks with visual feedback
- **Table of contents** auto-generated from headings with scroll tracking
- **Hot reload** — watches the file for changes and re-renders automatically
- **Themes** — light, dark, or auto (follows system preference)
- **File associations** — register as default viewer for `.md`, `.markdown`, `.mkd`
- **Drag-and-drop** — drop a markdown file onto the window to open it
- **CLI support** — pass a file path as an argument: `mdv /path/to/file.md`

## Build from source

Requires [Node.js](https://nodejs.org/) >= 24.

```bash
git clone https://github.com/gesslar/mdv.electron.git
cd mdv.electron
npm install
npm start
```

### Packaged distributables

```bash
npm run dist           # all targets your host can produce
npm run dist:deb       # .deb (x64 + arm64)
npm run dist:rpm       # .rpm (x64 + arm64)
npm run dist:appimage  # .AppImage (x64 + arm64)
npm run dist:flatpak   # .flatpak (x64 + arm64)
```

Artifacts land in `out/`.

Windows (NSIS) and macOS targets — see [DEVELOPMENT.md](DEVELOPMENT.md).

### Fedora (RPM)

```bash
npm run dist:rpm
sudo dnf install -y out/mdv-*.x86_64.rpm
```

## Usage

```bash
# Launch with a file
mdv README.md

# Launch without a file and use the open button or drag-and-drop
mdv
```

## Configuration

Click the gear icon to open the config panel:

| Setting    | Options            | Default |
|------------|--------------------|---------|
| Theme      | Auto, Light, Dark  | Auto    |
| Hot Reload | On, Off            | On      |

Settings are persisted across sessions.

## Tech stack

- **Runtime**: [Electron](https://www.electronjs.org/) (main + sandboxed preload + renderer)
- **Packaging**: [electron-builder](https://www.electron.build/) (deb, rpm, AppImage, NSIS, mac zip) + [flatpak-builder](https://docs.flatpak.org/en/latest/flatpak-builder.html) wrapper for `.flatpak`
- **Frontend**: Vanilla JS (ES6 modules), HTML5, CSS3
- **Markdown**: [marked](https://github.com/markedjs/marked) + [marked-highlight](https://github.com/markedjs/marked-highlight) + [highlight.js](https://highlightjs.org/)
- **Sanitization**: [DOMPurify](https://github.com/cure53/DOMPurify)

## License

`mdv` is released under the [0BSD](LICENSE.txt).

This package includes or depends on third-party components under their own
licenses:

| Dependency | License |
| --- | --- |
| [@gesslar/toolkit](https://github.com/gesslar/toolkit) | 0BSD |
| [@highlightjs/cdn-assets](https://github.com/highlightjs/highlight.js) | BSD-3-Clause |
| [@vscode/codicons](https://github.com/microsoft/vscode-codicons) | CC-BY-4.0 |
| [dompurify](https://github.com/cure53/DOMPurify) | (MPL-2.0 OR Apache-2.0) |
| [marked](https://github.com/markedjs/marked) | MIT |
| [marked-highlight](https://github.com/markedjs/marked-highlight) | MIT |
