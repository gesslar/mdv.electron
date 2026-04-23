# Building on Linux

Prerequisites for building mdv on Linux from a fresh clone.

## Prerequisites

### Toolchains

- **Node.js** (LTS, 18+)
- **Rust** — install via [rustup](https://rustup.rs/)
- **Tauri system prerequisites** — `webkit2gtk`, `libgtk-3`, `librsvg2`,
  `pkg-config`, `build-essential` / `base-devel`, etc. See the Tauri
  documentation for the package names for your distribution.

### Bundler dependencies

- **linuxdeploy** — required for building AppImages. Install it once into
  the Tauri cache directory:

  ```bash
  ./scripts/setup-linuxdeploy.sh
  ```

  This fetches `linuxdeploy-x86_64.AppImage` into
  `$HOME/.cache/tauri/`, which is where Tauri expects to find it. Tauri
  does not download it on your behalf.

- **rpmrebuild** and **jq** — only required if you plan to build RPMs.
  They are used by `scripts/fix-rpm.sh` to post-process the RPM with
  vendor and desktop-file metadata.

## Building

### Native build

```bash
npm install
npm run build
```

Artifacts land under `src-tauri/target/release/bundle/`.

### Containerised builds

If you prefer to build Linux artifacts in Docker (useful on Windows or
macOS hosts, or to produce AppImages against a specific glibc):

```bash
npm run docker:appimage    # AppImage against Fedora 40 base
npm run docker:fedora      # RPM
npm run docker:debian      # DEB
```

These use named volumes so the Linux build's artifacts do not pollute
your host filesystem.

## After building an RPM

Tauri's RPM output is missing a `Vendor:` field and does not set
`InitialPreference` on the `.desktop` file. Run the post-processor:

```bash
./scripts/fix-rpm.sh
```

See `STUPID.md` for why this is necessary.
