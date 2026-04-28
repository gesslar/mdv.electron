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

let activeWatcher = null
let activeWatcherPath = null

const stopWatcher = () => {
  if(activeWatcher) {
    activeWatcher.close()
    activeWatcher = null
    activeWatcherPath = null
  }
}

const appIcon = nativeImage.createFromPath(srcDir.getDirectory("assets/icons").getFile("android-chrome-512x512.png").path)
const createWindow = () => {
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

  return win
}

ipcMain.handle("cli:get-runtime-path", () => process.execPath)

// In dev (`electron .`) argv is [electron, ".", ...userArgs]; when packaged
// it's [app, ...userArgs]. Skip accordingly so callers see only user args.
ipcMain.handle("cli:get-args", () =>
  process.argv.slice(electron.isPackaged ? 1 : 2))

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
  stopWatcher()

  const sender = event.sender
  activeWatcherPath = path
  activeWatcher = watch(path, {persistent: false}, () => {
    if(!sender.isDestroyed())
      sender.send("watcher:changed", {path: activeWatcherPath})
  })
})

ipcMain.handle("watcher:unwatch", () => stopWatcher())

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
  const win = createWindow()

  win.webContents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase()

    if(input.control && input.shift && key === "i")
      BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools()

    else if(input.control && key === "w")
      BrowserWindow.getFocusedWindow()?.close()
  })

  Disposer.register(
    Notify.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow(), electron)
  )
})

Disposer.register(
  Notify.on("window-all-closed", () => {
    stopWatcher()

    if(process.platform !== "darwin")
      electron.quit()
  }, electron)
)
