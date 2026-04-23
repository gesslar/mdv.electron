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

### Flatpak build compiles `zypak` from source with `clang++`, which isn't in the freedesktop SDK

`forge.config.cjs`

`@malept/electron-installer-flatpak` (the engine behind `@electron-forge/maker-flatpak`) auto-injects a `zypak` module into the generated manifest and compiles it from source inside the sandbox on every flatpak build. zypak's Makefile hardcodes `CXX ?= clang++`, but `org.freedesktop.Sdk//24.08` ships `g++`, not `clang++`. Default build fails with `make: clang++: No such file or directory`.

We override the zypak module in the maker config to set `build-options.env.CXX = 'g++'`. The override also pins a newer zypak tag (`v2024.01.17`) than the installer's default (`v2021.02`).

When `@malept/electron-installer-flatpak` either stops auto-injecting zypak or picks a compiler the SDK ships, the override can be dropped.

See: [refi64/zypak](https://github.com/refi64/zypak)

## Fixed

_Nothing yet._
