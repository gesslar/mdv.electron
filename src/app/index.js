import * as TK from "@gesslar/toolkit"
import {app as electron, BrowserWindow, dialog, ipcMain, nativeImage, Menu, shell} from "electron"
import {readFile} from "node:fs/promises"
import {existsSync, watch} from "node:fs"

const {Notify, Disposer, FileObject, FileSystem} = TK
const appDir = FileObject.fromCwf().parent
const srcDir = appDir.parent
const preloadPath = appDir.getFile("preload.cjs").path
const ui = appDir.parent.getDirectory("ui")

// Done before anything so that the menu doesn't get created.
Menu.setApplicationMenu(null)

// Sets the X11 WM_CLASS / Wayland app_id Linux uses to group taskbar
// windows; without it, the launcher binary name ("electron") leaks through.
electron.commandLine.appendSwitch("class", "mdv")

// One process owns the userData dir to avoid Chromium SQLite contention
// (localStorage/cookies/IndexedDB locks); subsequent launches forward
// their argv via the second-instance event below. Skipped in dev so the
// debugger can attach to its own child without losing the lock race to
// another running mdv.
if(electron.isPackaged && !electron.requestSingleInstanceLock()) {
  electron.quit()
  process.exit(0)
}

const MD_EXTENSIONS = new Set(["md", "markdown", "mkd"])

// Tracks the file each window currently displays. Used to dedupe OS-level
// opens (double-click an already-open file → focus its window) and to
// answer the renderer's cli:get-file query.
const windowFiles = new Map()

// Per-window file watchers. Keyed by webContents.id so closing one window
// can't tear down another window's watcher.
const watchers = new Map()

const stopWatcher = wcId => {
  const entry = watchers.get(wcId)
  if(!entry)
    return

  entry.watcher.close()
  watchers.delete(wcId)
}

const findMarkdownArgs = argv => argv.filter(arg => {
  if(!arg || arg.startsWith("-"))
    return false

  const ext = /\.([^.]+)$/.exec(arg)?.[1]?.toLowerCase()

  return ext && MD_EXTENSIONS.has(ext)
})

// In dev (`electron .`) argv is [electron, ".", ...userArgs]; when packaged
// it's [app, ...userArgs]. Skip accordingly so the parser sees only user args.
const parseLaunchArgs = argv =>
  findMarkdownArgs(argv.slice(electron.isPackaged ? 1 : 2))

const findWindowForFile = filePath => {
  for(const [win, path] of windowFiles)
    if(path === filePath)
      return win

  return null
}

const focusWindow = win => {
  if(win.isMinimized())
    win.restore()

  win.focus()
}

const appIcon = nativeImage.createFromPath(srcDir.getDirectory("assets/icons").getFile("android-chrome-512x512.png").path)
const createWindow = (filePath = null) => {
  const win = new BrowserWindow({
    fullscreenable: true,
    icon: appIcon,
    titleBarStyle: "hidden",
    type: "desktop",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  windowFiles.set(win, filePath)

  // Capture the id now — webContents is gone by the time `closed` fires.
  const wcId = win.webContents.id

  win.on("closed", () => {
    stopWatcher(wcId)
    windowFiles.delete(win)
  })

  win.loadFile(`${ui}/index.html`)

  win.webContents.setWindowOpenHandler(({url}) => {
    if(/^https?:|^mailto:/i.test(url))
      shell.openExternal(url)

    return {action: "deny"}
  })

  win.webContents.on("will-navigate", (event, url) => {
    const current = win.webContents.getURL()
    if(url === current)
      return

    if(/^https?:|^mailto:/i.test(url)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  win.webContents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase()

    if(input.control && input.shift && key === "i") {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  const sendMaximized = () => {
    if(!win.webContents.isDestroyed())
      win.webContents.send("window:maximized-changed", win.isMaximized())
  }

  win.on("maximize", sendMaximized)
  win.on("unmaximize", sendMaximized)

  return win
}

// Routes any "open this file" request through one place: dedupe to an
// existing window if it already shows that file, otherwise spawn a new
// window. Used by both initial launch and second-instance forwarding.
const openFile = filePath => {
  if(filePath) {
    const existing = findWindowForFile(filePath)
    if(existing) {
      focusWindow(existing)

      return existing
    }
  }

  return createWindow(filePath)
}

// Opens one window per launch path (deduping each), or a single empty
// window when no markdown paths were provided.
const openLaunchPaths = paths => {
  if(paths.length === 0) {
    openFile(null)

    return
  }

  for(const path of paths)
    openFile(path)
}

ipcMain.handle("cli:get-runtime-path", () => process.execPath)

// Returns the file path this window was launched with (or null). Replaces
// the old cli:get-args handler — argv parsing now lives in main.
ipcMain.handle("cli:get-file", event => {
  const win = BrowserWindow.fromWebContents(event.sender)

  return windowFiles.get(win) ?? null
})

// Renderer reports the file it's currently displaying so dedupe stays
// accurate after the user opens a different file via the in-app dialog.
ipcMain.handle("window:set-current-file", (event, filePath) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if(win)
    windowFiles.set(win, filePath ?? null)
})

ipcMain.handle("window:minimize", event =>
  BrowserWindow.fromWebContents(event.sender)?.minimize())

ipcMain.handle("window:toggle-maximize", event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if(!win)
    return

  if(win.isMaximized())
    win.unmaximize()
  else
    win.maximize()
})

ipcMain.handle("window:close", event =>
  BrowserWindow.fromWebContents(event.sender)?.close())

ipcMain.handle("window:is-maximized", event =>
  BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false)

// Builds and pops a stage context menu, returning the chosen action id (or
// null if dismissed). Items are disabled when there's no selection — we
// still show the menu so the user gets feedback that the menu exists.
ipcMain.handle("context-menu:stage", (event, {hasSelection}) =>
  new Promise(resolve => {
    let chosen = null
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = Menu.buildFromTemplate([
      {
        label: "Copy",
        enabled: hasSelection,
        click: () => {
          chosen = "copy"
        },
      },
    ])

    menu.popup({
      window: win,
      callback: () => resolve(chosen),
    })
  }))

ipcMain.handle("dialog:open-file", async(event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    title: options.title ?? "Open File",
    filters: options.filters ?? [],
    properties: [
      options.directory ? "openDirectory" : "openFile",
      ...(options.multiple ? ["multiSelections"] : [])
    ]
  })

  if(result.canceled || result.filePaths.length === 0)
    return null

  return options.multiple ? result.filePaths : result.filePaths[0]
})

ipcMain.handle("fs:read-text-file", (_event, path) => readFile(path, "utf8"))

// Resolves a link href clicked in a rendered document. Markdown targets
// open in an mdv window (deduped via openFile); anything else is handed
// to the OS so plain `<a href="image.png">` links don't dead-end.
ipcMain.handle("link:open", (_event, {href, baseFilePath} = {}) => {
  if(typeof href !== "string" || href === "")
    return

  let target = /^file:/i.test(href) ? FileSystem.urlToPath(href) : href

  const hashIdx = target.indexOf("#")
  if(hashIdx >= 0)
    target = target.slice(0, hashIdx)

  if(!target)
    return

  let resolved
  try {
    resolved = baseFilePath
      ? new FileObject(target, new FileObject(baseFilePath).parent).path
      : new FileObject(target).path
  } catch(err) {
    console.error("[mdv] failed to resolve link target:", err.message)

    return
  }

  // TODO: when toast tech lands, surface a "file not found" message
  // (probably in the new instance) instead of swallowing silently.
  if(!existsSync(resolved))
    return

  const ext = /\.([^.]+)$/.exec(resolved)?.[1]?.toLowerCase()

  if(ext && MD_EXTENSIONS.has(ext))
    openFile(resolved)
  else
    shell.openPath(resolved)
})

ipcMain.handle("watcher:watch", (event, path) => {
  const sender = event.sender
  const wcId = sender.id

  stopWatcher(wcId)

  const watcher = watch(path, {persistent: false}, () => {
    if(!sender.isDestroyed())
      sender.send("watcher:changed", {path})
  })

  watchers.set(wcId, {watcher, path})
})

ipcMain.handle("watcher:unwatch", event => stopWatcher(event.sender.id))

ipcMain.on("log", (_event, level, message) => {
  const method = console[level] ?? console.log
  method.call(console, "[mdv]", message)
})

electron.whenReady().then(() => {
  openLaunchPaths(parseLaunchArgs(process.argv))

  Disposer.register(
    Notify.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow(), electron)
  )
})

Disposer.register(
  Notify.on("second-instance", (_event, argv) => {
    openLaunchPaths(parseLaunchArgs(argv))
  }, electron)
)

Disposer.register(
  Notify.on("window-all-closed", () => {
    for(const wcId of watchers.keys())
      stopWatcher(wcId)

    if(process.platform !== "darwin")
      electron.quit()
  }, electron)
)
