# Development

## Everyday work

```bash
npm install       # once
npm start         # dev run via electron-forge
npm run lint      # eslint over src/
npm run lint:fix  # autofix
```

## Building distributables

```bash
npm run make                                                  # every maker your host supports
npx electron-forge make --targets <maker-id>                  # just one
```

Artifacts land in `out/make/`.

### Linux targets that work with just Node.js

No extra tooling needed — these build on any modern Linux host:

| Target    | Maker                              | Output                                |
|-----------|------------------------------------|---------------------------------------|
| `.deb`    | `@electron-forge/maker-deb`        | `out/make/deb/x64/mdv_*.deb`          |
| `.rpm`    | `@electron-forge/maker-rpm`        | `out/make/rpm/x64/mdv-*.rpm`          |
| AppImage  | `@reforged/maker-appimage`         | `out/make/AppImage/x64/MDV-*.AppImage` |

### Windows target from Linux

Building the Squirrel `.exe` installer cross-platform from Linux needs Mono and Wine — the Squirrel tooling itself is .NET and runs the installer generator under Wine.

```bash
# Fedora
sudo dnf install mono-devel wine

# Debian/Ubuntu
sudo apt install mono-devel wine

npx electron-forge make --targets @electron-forge/maker-squirrel --platform win32
```

Output: `out/make/squirrel.windows/x64/MDV-*.Setup.exe`

Building on Windows itself needs none of this — just Node.js + npm + `npm run make`.

### macOS target

Build on macOS. Cross-building a signed/notarised `.app` from Linux isn't supported by Forge; the `.zip` maker is configured for `platforms: ['darwin']`.

## Under the hood

### Patched dependency

`electron-installer-redhat` has a known bug on Fedora 41+ (rpm 4.20+). We carry the exact pending upstream fix ([PR #344](https://github.com/electron-userland/electron-installer-redhat/pull/344)) locally via [`patch-package`](https://github.com/ds300/patch-package). The patch lives in `patches/electron-installer-redhat+3.4.0.patch` and is reapplied automatically via the `postinstall` script. See `STUPID.md` for the full story and removal path.

### Preload / IPC boundary

The renderer never touches `ipcRenderer` directly. All host APIs are exposed via `src/app/preload.cjs` under `window.mdv.*`:

- `mdv.cli.getRuntimePath()`, `mdv.cli.getArgs()`
- `mdv.dialog.openFile(opts)`
- `mdv.fs.readTextFile(path)`
- `mdv.watcher.watch(path)` / `unwatch()` / `onChange(cb)` — `onChange` returns an unsubscribe function
- `mdv.log.{trace,debug,info,warn,error}(message)`

Main-process handlers for each channel live in `src/app/index.js`.
