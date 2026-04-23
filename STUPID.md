# STUPID.md

A catalogue of the stupid things that must be done to compile, bundle, and
ship this application. Every entry represents time that was once spent and
can never be reclaimed. New indignities welcome — please file in the correct
wing of the museum.

Most of this is upstream tools being obtuse. Some of it may turn out to be
me not reading the manual closely enough. The name `STUPID` is deliberately
non-committal about whose stupidity is on display in any given entry —
sometimes it's the framework, sometimes it's the bundler, sometimes it's
the person typing.

Corrections welcome. "Hey dumdum, there's a flag for that" is a perfectly
valid contribution and earns the entry a one-way ticket to the `FIXED`
section at the bottom.

> For normal "what do I need installed to build this" guidance, see
> [`BUILD.linux.md`](./BUILD.linux.md) and [`BUILD.windows.md`](./BUILD.windows.md).
> This file is specifically for the workarounds, patches, and indignities
> that exist because upstream tools don't cooperate.

---

## Part I — Getting it to build and run across desktops

### 1. Blanket-disable WebKit's DMABUF renderer on Linux

`src-tauri/src/lib.rs:71-83`

The WebKit DMABUF renderer crashes on X11 + NVIDIA. We set
`WEBKIT_DISABLE_DMABUF_RENDERER=1` before Tauri spawns any threads, because
`std::env::set_var` is `unsafe` for exactly that reason.

The commented-out `WAYLAND_DISPLAY` / `XDG_SESSION_TYPE` probes are the
tombstones of two earlier attempts to be clever about this. We are no
longer being clever about this.

### 2. Force GDK to X11 inside the AppImage

`dist/appimage/squashfs-root/apprun-hooks/linuxdeploy-plugin-gtk.sh:10`

`GDK_BACKEND=x11`. Because Wayland crashes. See Tauri <https://github.com/tauri-apps/tauri/issues/8541>. No, we did not
fix it. Yes, we tried.

### 3. Custom GTK themes are broken in AppImages

Same file, lines 3-4.

We `gsettings get org.gnome.desktop.interface gtk-theme` just enough to
decide between Adwaita and Adwaita-dark. Anything else is a coin flip
between "looks fine" and "renders as raw XML".

### 4. Rebuild GTK's entire runtime worldview via env vars

Same file, lines 11-18.

`XDG_DATA_DIRS`, `GSETTINGS_SCHEMA_DIR`, `GTK_EXE_PREFIX`, `GTK_PATH`,
`GTK_IM_MODULE_FILE`, `GDK_PIXBUF_MODULE_FILE`, `GIO_EXTRA_MODULES`. GLib's
`g_get_system_data_dirs()` is apparently not up to the job of "look inside
the thing you were launched from".

### 5. `mdv_lib`, not `mdv`

`src-tauri/Cargo.toml:10-14`

> The `_lib` suffix may seem redundant but it is necessary to make the lib
> name unique and wouldn't conflict with the bin name. This seems to be
> only an issue on Windows, see rust-lang/cargo#8519.

The comment is in the file. The issue is from 2020. It is still open.

---

## Part II — Getting it into a bundle that actually works

### 6. `NO_STRIP=true` for AppImage or linuxdeploy loses its mind

`docker/Dockerfile.appimage:12,46-48`

Tauri strips binaries. linuxdeploy needs them unstripped to patch ELF
headers for bundle-type detection. The two tools are not speaking. We are
the divorce counsellor.

### 7. `APPIMAGE_EXTRACT_AND_RUN=1` for the AppImage that makes the AppImage

`docker/Dockerfile.appimage:11`

Running linuxdeploy (an AppImage) inside the Docker build container (which
may itself be involved with AppImages) to produce an AppImage requires
`APPIMAGE_EXTRACT_AND_RUN=1` or linuxdeploy refuses to cooperate. It's
AppImages all the way down.

### 8. Patch linuxdeploy's own hook because it forgot `LD_LIBRARY_PATH`

`docker/Dockerfile.appimage:73-80`

linuxdeploy-plugin-gtk bundles the gdk-pixbuf loaders but does not put the
loaders directory on `LD_LIBRARY_PATH`. `loaders.cache` references bare
filenames. `dlopen` therefore fails. We `awk` a new line into
`apprun-hooks/linuxdeploy-plugin-gtk.sh` after the fact:

```sh
export LD_LIBRARY_PATH="$APPDIR/usr/lib64/gdk-pixbuf-2.0/2.10.0/loaders:${LD_LIBRARY_PATH:-}"
```

### 9. Repack the AppImage after patching the hook

`docker/Dockerfile.appimage:82-85`

linuxdeploy has no "post-process" extension point, so every fix-up above
happens after it's already produced an AppImage. We delete that AppImage
and re-run `appimagetool` against the modified AppDir. The first AppImage
existed for approximately four seconds.

### 10. The `.DirIcon` symlink bakes in an absolute build-container path

`docker/Dockerfile.appimage:56-59`

linuxdeploy writes `.DirIcon` as an absolute symlink to something inside
the Docker container, which is spectacularly useless on a user's machine.
We replace it with `ln -sf mdv.png .DirIcon`. It is always `mdv.png`.

Surfaced by `scripts/appdir-lint.sh`, which checks for `.DirIcon`
presence and PNG mimetype. That lint is vendored from AppImage upstream
(see "The AppImage lint import" below).

### 11. AppStream metainfo: hand-authored, then manually installed

`src-tauri/dev.gesslar.mdv.metainfo.xml`, `docker/Dockerfile.appimage:52-54`

RPMs, DEBs, and AppImages on modern Linux want an AppStream metainfo XML
file (`<component type="desktop-application">`, `<id>`, `<summary>`,
`<content_rating>`, etc.) so the app shows up correctly in GNOME Software,
Discover, and friends. Tauri's bundler does not generate one. There is no
config option to populate one from `tauri.conf.json`, even though half the
required fields (id, summary, homepage, categories) are already there.

So you hand-author the XML yourself, against the freedesktop AppStream
spec, and check it into `src-tauri/`.

Then, after all that, `linuxdeploy` refuses to install it into the AppDir
during bundling — so the Dockerfile manually copies the file into
`usr/share/metainfo/` after the fact.

Two tools, one XML file, zero automation. Surfaced (again) by
`scripts/appdir-lint.sh` — the build itself doesn't care, but AppImage's
upstream PR process won't accept a submission that fails the lint.

### 12. The AppImage lint import (borrowed stupidity)

`scripts/appdir-lint.sh`, `scripts/excludelist`

Both files are vendored from AppImage upstream — they are the same lint
and library-exclusion list that AppImageHub runs against PR submissions.
mdv ships them in-tree so CI can pre-flight an AppDir with upstream's own
rules before we cut a release.

Which means the 240-line `excludelist` isn't *our* stupid — it's AppImage's
catalogue of cross-distro ABI hell, inherited wholesale. Highlights:

- `libstdc++.so.6` — "version 'GLIBCXX_3.4.21' not found"
- `libxcb.so.1` — "Symbol lookup error: xcb_send_fd"
- `libjack.so.0` — "Must match ABI of JACK server installed in base system"
- `libfontconfig.so.1` — "Application stalls when loading fonts during launch"
- `libpipewire-0.3.so.0` — same energy as JACK, different decade

Every entry is someone else's grave. We just visit.

Running `appdir-lint.sh` against our AppDir is how entries #10 (`.DirIcon`)
and #11 (AppStream metainfo) came to light. The lint is load-bearing, even
if the pain is second-hand.

### 13. Enforce the excludelist one file at a time

`docker/Dockerfile.appimage:61-71`

linuxdeploy has no flag for "honour this excludelist during bundling."
Neither does Tauri. So after bundling, we loop over the excludelist and
`find ... -delete` each entry. No bulk operation. The list gets longer;
the loop stays the same.

### 14. Rebuild the RPM because Tauri doesn't populate Vendor consistently

`scripts/fix-rpm.sh`

Tauri's DEB output gets a Maintainer. Its MSI output gets a Manufacturer.
Its RPM output gets no `Vendor:` at all, and no way to set
`InitialPreference` on the desktop file so mdv can win MIME fights against
other markdown viewers.

We run `rpmrebuild` with `--change-spec-preamble` to inject the Vendor
field (`Gess, Daddy!` — the name of the RPM repo), plus a temporary bash
script passed to `--change-files` to `sed` `InitialPreference=80` into the
desktop file. `rpmrebuild` writes the result to `~/rpmbuild/RPMS/` with no
way to redirect it, so we `find` it and `mv` it back.

The real stupidity is that one bundler parameter should populate the
equivalent field in every output format. It does not.

### 15. Different Docker plumbing for Windows vs POSIX hosts

`docker/build.mjs:42-55`, `docker/build.sh:27-39`

On Linux/macOS, `docker run --user $(id -u):$(id -g) -e HOME=/tmp` so the
artifacts aren't owned by root. On Windows, skip that entirely because
Docker Desktop does its own UID translation and passing `--user` makes
things worse. Named volumes for `target/`, `node_modules/`, and the cargo
registry so Linux build detritus doesn't leak onto a Windows host. Two
scripts, one soul.

---

## Contributing to STUPID.md

New entries should include:

1. A file and line reference so the next person can verify the stupidity is
   still load-bearing.
2. What upstream tool caused the stupidity. (Blame is healing.)
3. Enough detail that a future maintainer does not "clean it up" and
   rediscover the original problem at 2am before a release.

If an entry is really just a "you need this installed" prerequisite, it
belongs in `BUILD.linux.md` or `BUILD.windows.md` instead. This file is
for patches, not package lists.

If you remove a workaround because the upstream tool finally fixed itself:
move the entry to a `FIXED` section with the date. We deserve to celebrate.
