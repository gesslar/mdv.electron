# Building on Windows

Prerequisites for building mdv on Windows from a fresh clone.

## Prerequisites

### Toolchains

- **Node.js** (LTS, 18+)
- **Rust** — install via [rustup](https://rustup.rs/)
- **Tauri prerequisites for Windows** — see the Tauri documentation for
  the current required Visual Studio / WebView2 components.

### Bundler dependencies

mdv produces both MSI and NSIS installers, so both toolchains are needed:

- **.NET SDK 9** (required by WiX v4+)
- **NSIS** — for the `.exe` installer
- **WiX** — installed as a dotnet global tool

### One-liner install (as Administrator)

```powershell
Start-Process PowerShell -Verb RunAs -ArgumentList '-NoExit -Command "winget install Microsoft.DotNet.SDK.9 NSIS.NSIS ; dotnet tool install --global wix"'
```

Or step by step:

```powershell
# As Administrator
winget install Microsoft.DotNet.SDK.9 NSIS.NSIS
dotnet tool install --global wix
```

## Building

```powershell
npm install
npm run build
```

Newly created Windows installers land under `src-tauri/target/release/bundle/`.
