const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// Shared across all three Linux makers (deb, rpm, AppImage).
const unixMeta = {
  productName: 'MDV',
  genericName: 'Markdown Viewer',
  icon: 'src/assets/icons/android-chrome-512x512.png',
  categories: ['Office', 'Utility'],
  mimeType: ['text/markdown', 'application/x-markdown'],
};

// Additional fields supported by deb + rpm (not by reforged or flatpak).
const packageMeta = {
  ...unixMeta,
  description: 'A fast, minimal desktop markdown viewer',
  productDescription: 'A fast, minimal desktop markdown viewer with hot reload, syntax highlighting, drag-and-drop, and file association for .md / .markdown / .mkd.',
  homepage: 'https://github.com/gesslar/mdv',
};

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'mdv',
    // Packager appends .ico on Windows and .icns on Mac; ignored on Linux.
    icon: 'src/assets/icons/app',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mdv',
        authors: 'gesslar',
        description: packageMeta.description,
        title: 'MDV',
        setupIcon: 'src/assets/icons/app.ico',
        noMsi: true,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          ...packageMeta,
          maintainer: 'gesslar <karahd@gmail.com>',
          section: 'text',
          priority: 'optional',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          ...packageMeta,
          license: '0BSD',
        },
      },
    },
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      config: {
        options: {
          ...unixMeta,
          actions: {
            NewEmptyWindow: {
              Name: 'New Empty Window',
              Exec: 'mdv',
            },
          },
        },
      },
    },
    {
      name: '@electron-forge/maker-flatpak',
      platforms: ['linux'],
      config: {
        options: {
          ...packageMeta,
          id: 'dev.gesslar.mdv',
          runtimeVersion: '24.08',
          base: 'org.electronjs.Electron2.BaseApp',
          baseVersion: '24.08',
          finishArgs: [
            '--share=ipc',
            '--socket=x11',
            '--socket=wayland',
            '--device=dri',
            '--filesystem=home:ro',
          ],
          // Override the default zypak module to use g++ — the freedesktop
          // SDK doesn't ship clang++ by default, which zypak's Makefile
          // assumes. See STUPID.md.
          modules: [
            {
              name: 'zypak',
              'build-options': {
                env: {CXX: 'g++'},
              },
              sources: [
                {
                  type: 'git',
                  url: 'https://github.com/refi64/zypak',
                  tag: 'v2024.01.17',
                },
              ],
            },
          ],
          files: [],
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
