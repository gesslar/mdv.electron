# STUPID.md

Load-bearing workarounds for problems we didn't cause. Remove at your own peril.

## Packaging

### RPM build fails on Fedora 41+ because `electron-installer-redhat` hasn't been updated for rpm 4.20

`patches/electron-installer-redhat+3.4.0.patch`

Starting in rpm 4.20 (Fedora 41, Sept 2024) `rpmbuild` `cd`s into
`BUILD/<name>-<version>-build/` before running `%install`. The spec template
shipped by `electron-installer-redhat@3.4.0` references payload files with the
relative path `usr/*`, which no longer resolves from the new CWD. Result:
`cp: cannot stat 'usr/*': No such file or directory`.

The upstream fix exists as PR #344 (open since Jan 2025, unmerged). The
project has had no releases since Feb 2023 and is effectively unmaintained.
`@electron-forge/maker-rpm` itself is current — it just depends on the
abandoned installer.

We apply the exact PR #344 diff locally via `patch-package`, invoked from the
`postinstall` script. When the PR eventually merges and ships as 3.5.0+, bump
the dep and delete the patch file.

See: [electron-userland/electron-installer-redhat#343](https://github.com/electron-userland/electron-installer-redhat/issues/343)
See: [electron-userland/electron-installer-redhat#344](https://github.com/electron-userland/electron-installer-redhat/pull/344)

### Flatpak build can't reuse a build dir or keep tmp dirs because `electron-installer-flatpak` drops `workingDir` / `cleanTmpdirs`

`patches/@malept+electron-installer-flatpak+0.11.4.patch`

`@malept/electron-installer-flatpak@0.11.4`'s `createBundle()` builds the options object passed to `@malept/flatpak-bundler`'s `bundle()` by hand and never forwards `workingDir` or `cleanTmpdirs` from `this.options`. The bundler supports both (a persistent `workingDir` is what makes incremental rebuilds and `--ccache` actually useful, and `cleanTmpdirs: false` keeps the build tree around for inspection), but with the installer in the way they're silently ignored — every build gets a fresh `tmp.dir({prefix: 'flatpak-bundler'})` that's nuked on exit.

We patch `installer.js` to forward both fields straight from `this.options` to the bundler. They're set at the top level of the maker config in `forge.config.cjs`; `electron-installer-common` merges `userSupplied` and `userSupplied.options` into `this.options` via `_.defaults`, so either placement reaches the patched code.

When upstream forwards these (or exposes its own equivalent), drop the patch.

See: [malept/flatpak-bundler#workingDir option](https://github.com/malept/flatpak-bundler#bundlemanifest-options-callback)
See: [malept/electron-installer-flatpak#131](https://github.com/malept/electron-installer-flatpak/issues/131) (filed)

### Flatpak build compiles `zypak` from source with `clang++`, which isn't in the freedesktop SDK

`forge.config.cjs`

`@malept/electron-installer-flatpak` (the engine behind `@electron-forge/maker-flatpak`) auto-injects a `zypak` module into the generated manifest and compiles it from source inside the sandbox on every flatpak build. zypak's `Makefile` in `v2021.02` (the installer's default) hardcodes `CXX := clang++`, but `org.freedesktop.Sdk//24.08` ships `g++`, not `clang++`. Default build fails with `make: clang++: No such file or directory` (verified empirically: comment out the override and `npm run make:flatpak` crashes in seconds).

We override the zypak module in the maker config: pin a newer tag (`v2024.01.17`, whose Makefile uses `CXX := g++`) and set `build-options.env.{CC,CXX}`. The version pin is the load-bearing fix; the `env` is belt-and-braces — `:=` is unconditional, so make ignores env overrides anyway, but the env block defends against any future upstream Makefile change that flips back to `?=` or `clang++`.

zypak itself fixed this years ago. The actual bug is that the installer pins a five-year-old tag.

When `@malept/electron-installer-flatpak` bumps its default zypak tag (or stops auto-injecting), the override can be dropped.

See: [refi64/zypak](https://github.com/refi64/zypak)
See: [malept/electron-installer-flatpak#132](https://github.com/malept/electron-installer-flatpak/issues/132) (filed)
See: [electron/forge#2805](https://github.com/electron/forge/issues/2805) (downstream symptom, open since 2022)

## Fixed

_Nothing yet._
