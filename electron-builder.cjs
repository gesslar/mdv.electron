const description = 'A fast, minimal desktop markdown viewer'
const productDescription = 'A fast, minimal desktop markdown viewer with hot reload, syntax highlighting, drag-and-drop, and file association for .md / .markdown / .mkd.'

module.exports = {
  appId: 'dev.gesslar.mdv',
  productName: 'MDV',
  copyright: 'Copyright © gesslar',
  directories: {
    output: 'out'
  },
  // Allowlist what ships in the asar. node_modules is included automatically
  // (electron-builder strips devDependencies). Mirrors the intent of the old
  // forge.config.cjs ignore filter.
  files: [
    'src/**/*',
    'package.json'
  ],
  asar: true,
  // Same fuse posture the old @electron-forge/plugin-fuses block enforced.
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true
  },
  win: {
    target: [{target: 'squirrel', arch: ['x64']}],
    icon: 'src/assets/icons/app.ico'
  },
  squirrelWindows: {
    name: 'mdv'
  },
  mac: {
    target: [{target: 'zip', arch: ['x64', 'arm64']}],
    icon: 'src/assets/icons/app.icns',
    category: 'public.app-category.productivity'
  },
  linux: {
    target: [
      {target: 'deb', arch: ['x64']},
      {target: 'rpm', arch: ['x64']},
      {target: 'AppImage', arch: ['x64']}
    ],
    executableName: 'mdv',
    icon: 'src/assets/icons/android-chrome-512x512.png',
    category: 'Office',
    description: description,
    // StartupWMClass=mdv pairs with --class=mdv set in src/app/index.js so
    // Wayland/GNOME match the running window's app_id to the launcher.
    desktop: {
      entry: {
        Name: 'MDV',
        GenericName: 'Markdown Viewer',
        Comment: description,
        Categories: 'Office;Utility;',
        MimeType: 'text/markdown;',
        StartupWMClass: 'mdv',
        StartupNotify: 'true'
      }
    }
  },
  deb: {
    priority: 'optional',
    synopsis: description,
    description: productDescription
  },
  rpm: {
    synopsis: description,
    description: productDescription
  }
}
