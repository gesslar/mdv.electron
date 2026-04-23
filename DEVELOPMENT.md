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

### Linux targets with extra prereqs

#### Flatpak

Needs the flatpak toolchain and the Electron base runtime installed system-wide before `electron-forge make` can produce the artifact.

```bash
# Fedora
sudo dnf install flatpak flatpak-builder

# Debian/Ubuntu
sudo apt install flatpak flatpak-builder

# One-time runtime + SDK + base app pulls (run as your user)
flatpak remote-add --if-not-exists --user flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.electronjs.Electron2.BaseApp//24.08
```

Then: `npx electron-forge make --targets @electron-forge/maker-flatpak`

Bump the `24.08` version in `forge.config.cjs` and here if you move to a newer freedesktop runtime.

**SELinux gotcha (Fedora, RHEL).** On `Enforcing` systems, flatpak's final `build-bundle` step fails with `open(O_TMPFILE): Operation not permitted` when writing the `.flatpak` artifact into a directory with the `default_t` SELinux label (which is what `/projects/...` and other non-standard locations get by default). Symptom appears only after a full, successful compile — right at the end.

Workaround: keep `out/` on a `user_home_t`-labeled filesystem by symlinking to somewhere under `$HOME`:

```bash
rm -rf out
ln -s ~/mdv-out out
mkdir -p ~/mdv-out
```

`out/` is gitignored, so the symlink is purely local. Apply once and rebuild normally.

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
