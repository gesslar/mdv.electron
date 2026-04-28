# Development

## Everyday work

```bash
npm install       # once
npm start         # dev run via electron .
npm run lint      # eslint over src/
npm run lint:fix  # autofix
npm run clean     # wipe out/ and other build leftovers
```

## Building distributables

```bash
npm run dist             # all targets your host can produce
npm run dist:linux       # all Linux targets (deb + rpm + AppImage)
npm run dist:deb         # just .deb
npm run dist:rpm         # just .rpm
npm run dist:appimage    # just AppImage
npm run dist:flatpak     # flatpak bundle (x64 + arm64)
npm run dist:win         # Squirrel.Windows installer
npm run dist:mac         # macOS .zip (run on macOS)
npm run package          # unpacked app dir, no installer
```

Artifacts land in `out/`.

### Linux targets

| Target    | Output                                  |
|-----------|------------------------------------------|
| `.deb`    | `out/mdv_*_amd64.deb`                    |
| `.deb`    | `out/mdv_*_arm64.deb`                    |
| `.rpm`    | `out/mdv-*.aarch64.rpm`                   |
| `.rpm`    | `out/mdv-*.x86_64.rpm`                   |
| `.AppImage` | `out/mdv-*-arm64.AppImage`               |
| `.AppImage` | `out/mdv-*.AppImage`                     |
| `.flatpak`  | `out/mdv-*-arm64.flatpak`                |
| `.flatpak`  | `out/mdv-*-x64.flatpak`                  |

AppImage builds with just Node.js. The `.deb` and `.rpm` targets go through
`fpm`, which electron-builder downloads on first use; `fpm` is bundled Ruby
that links against `libcrypt.so.1`. Fedora 41+ ships `libcrypt.so.2` only,
so on Fedora hosts you need the compat library once:

```bash
sudo dnf install libxcrypt-compat
```

Debian/Ubuntu hosts already provide `libcrypt.so.1` and need nothing extra.

### Flatpak target

Flatpak doesn't go through electron-builder — it wraps the unpacked tree
electron-builder produces with `--dir`. Manifest lives at
`build/flatpak/dev.gesslar.mdv.yml`; orchestration lives at
`scripts/build-flatpak.mjs`.

Host packages:

```bash
# Fedora
sudo dnf install flatpak flatpak-builder

# Debian/Ubuntu
sudo apt install -y flatpak flatpak-builder
```

One-time runtime install (per arch you intend to build for):

```bash
flatpak remote-add --user --if-not-exists flathub \
  https://flathub.org/repo/flathub.flatpakrepo

flatpak install --user flathub \
  org.freedesktop.Platform//24.08 \
  org.freedesktop.Sdk//24.08 \
  org.electronjs.Electron2.BaseApp//24.08

# repeat with --arch=aarch64 for arm64 builds
flatpak install --user --arch=aarch64 flathub \
  org.freedesktop.Platform//24.08 \
  org.freedesktop.Sdk//24.08 \
  org.electronjs.Electron2.BaseApp//24.08
```

Cross-arch builds (e.g. arm64 on x86_64) additionally need
`qemu-user-static` so flatpak-builder can run the foreign-arch SDK
inside its bwrap sandbox:

```bash
# Fedora
sudo dnf install qemu-user-static

# Debian/Ubuntu
sudo apt install -y qemu-user-static binfmt-support
```

Then nudge systemd to load the binfmt configs the package shipped:

```bash
sudo systemctl restart systemd-binfmt
ls /proc/sys/fs/binfmt_misc/ | grep -i aarch64    # should list qemu-aarch64
```

If the entry still isn't there, force-register from the shipped configs:

```bash
sudo systemd-binfmt --unregister 2>/dev/null; sudo systemd-binfmt
```

Without this, flatpak-builder fails inside the foreign-arch sandbox with
`bwrap: execvp /bin/sh: Exec format error` (and openh264's `apply_extra`
script logs a similar warning during dep install).

Bumping the runtime: edit `runtime-version` and `base-version` together
in `build/flatpak/dev.gesslar.mdv.yml`, then re-run the install lines
above with the new pin.

Outputs are single-file `.flatpak` bundles installable with
`flatpak install --user out/mdv-<version>-x64.flatpak`. The intermediate
`out/flatpak-{repo,build-*,ccache-*}` dirs are scratch space and safe
to delete.

### Windows target from Linux

```bash
# Fedora
sudo dnf install wine

# Debian/Ubuntu
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install -y wine wine32

npm run dist:win
```

Output: `out/mdv.Setup *.exe` (NSIS installer, x64 + arm64).

NSIS itself runs native — `makensis` ships as a Linux ELF binary — but
electron-builder uses `winCodeSign` under wine to write the asar integrity
hash, apply `electronFuses` settings, and update icon resources on the
bundled `mdv.exe`. That happens for every Windows build, signed or not, so
wine is required even though we don't sign and don't use Squirrel. Mono is
not needed (that was a Squirrel-only requirement).

The installer registers the `.md` / `.markdown` / `.mkd` file associations
from the `fileAssociations` block in `electron-builder.cjs`; uninstalling
cleans them up.

### macOS target

Build on macOS. Cross-building a signed/notarised `.app` from Linux isn't
practical; the mac target is a `.zip` of the unsigned `.app`, which mac users
unpack and drag into `/Applications`.

## Under the hood

### Packaging stack

`electron-builder` reads `electron-builder.cjs` at the repo root.
That single file replaces what used to be `forge.config.cjs` plus the
`@electron-forge/*` and `@reforged/maker-appimage` makers. See
`STUPID.md` for the migration backstory (RPM bug on Fedora 41+).

The Linux `.desktop` entry — including `StartupWMClass=mdv` so Wayland/GNOME
match the running window's app_id (set via `--class=mdv` in
`src/app/index.js`) to the installed launcher — is declared inline in
`electron-builder.cjs` under `linux.desktop`.

### Preload / IPC boundary

The renderer never touches `ipcRenderer` directly. All host APIs are exposed
via `src/app/preload.cjs` under `window.mdv.*`:

- `mdv.cli.getRuntimePath()`, `mdv.cli.getArgs()`
- `mdv.dialog.openFile(opts)`
- `mdv.fs.readTextFile(path)`
- `mdv.watcher.watch(path)` / `unwatch()` / `onChange(cb)` — `onChange` returns
  an unsubscribe function
- `mdv.log.{trace,debug,info,warn,error}(message)`

Main-process handlers for each channel live in `src/app/index.js`.
