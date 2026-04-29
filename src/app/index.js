import * as TK from "@gesslar/toolkit"
import {app as electron, BrowserWindow, dialog, ipcMain, nativeImage, Menu, shell} from "electron"
import {readFile} from "node:fs/promises"
import {watch} from "node:fs"

const {Notify, Disposer, FileObject} = TK
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
// their argv via the second-instance event below.
if(!electron.requestSingleInstanceLock()) {
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
    ...(process.platform !== "darwin" ? {titleBarOverlay: true} : {}),
    titleBarOverlay: {
      color: "#abcdef00"
    },
    // frame: false,
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

    if(input.control && input.shift && key === "i")
      BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools()

    else if(input.control && key === "w")
      BrowserWindow.getFocusedWindow()?.close()
  })

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

ipcMain.handle("titlebar:set-overlay", (event, options) => {
  if(process.platform === "darwin")
    return

  const win = BrowserWindow.fromWebContents(event.sender)
  win?.setTitleBarOverlay(options)
})

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
