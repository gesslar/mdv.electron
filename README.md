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

Requires [Node.js](https://nodejs.org/) >= 22.

```bash
git clone https://github.com/gesslar/mdv.git
cd mdv
npm install
npm start
```

### Packaged distributables

```bash
npm run make                                               # all Linux targets
npx electron-forge make --targets @electron-forge/maker-deb     # just .deb
npx electron-forge make --targets @electron-forge/maker-rpm     # just .rpm
npx electron-forge make --targets @reforged/maker-appimage      # just .AppImage
```

Artifacts land in `out/make/`.

### Fedora (RPM)

```bash
npm run make
sudo dnf install -y out/make/rpm/x64/mdv-*.x86_64.rpm
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
- **Packaging**: [Electron Forge](https://www.electronforge.io/) with `maker-deb`, `maker-rpm`, and [`@reforged/maker-appimage`](https://github.com/SpacingBat3/ReForged)
- **Frontend**: Vanilla JS (ES6 modules), HTML5, CSS3
- **Markdown**: [marked](https://github.com/markedjs/marked) + [highlight.js](https://highlightjs.org/)
- **Sanitization**: [DOMPurify](https://github.com/cure53/DOMPurify)

## License

[0BSD](LICENSE)
