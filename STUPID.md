# STUPID.md

Load-bearing workarounds for problems we didn't cause. Remove at your own peril.

## Packaging

_Nothing yet._

## Fixed

### RPM build fails on Fedora 41+ because `electron-installer-redhat` hasn't been updated for rpm 4.20

Resolved by migrating off Electron Forge to `electron-builder`, which ships
its own RPM spec generator and never touches the abandoned
`electron-installer-redhat`. The old `patches/electron-installer-redhat+3.4.0.patch`
and the `postinstall` `patch-package` invocation are gone.

Background: starting in rpm 4.20 (Fedora 41, Sept 2024) `rpmbuild` `cd`s into
`BUILD/<name>-<version>-build/` before running `%install`. The spec template
shipped by `electron-installer-redhat@3.4.0` referenced payload files with the
relative path `usr/*`, which no longer resolved from the new CWD. Upstream
fix existed as PR #344 (open since Jan 2025, still unmerged); the project has
had no releases since Feb 2023 and is effectively unmaintained. We carried
the PR diff locally via `patch-package`.

See: [electron-userland/electron-installer-redhat#343](https://github.com/electron-userland/electron-installer-redhat/issues/343)
See: [electron-userland/electron-installer-redhat#344](https://github.com/electron-userland/electron-installer-redhat/pull/344)
