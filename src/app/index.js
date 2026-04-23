import * as TK from "@gesslar/toolkit"
import {app as electron, BrowserWindow, globalShortcut, Menu} from "electron"

const {Notify, Disposer} = TK
// const app = new TK.DirectoryObject("src/app")
const ui = new TK.DirectoryObject("src/ui")

// Done before anything so that the menu doesn't get created.
Menu.setApplicationMenu(null)

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadFile(`${ui.path}/index.html`)
}

electron.whenReady().then(() => {
  createWindow()

  globalShortcut.register("CommandOrControl+Shift+I", () => {
    BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools()
  })

  Disposer.register(
    Notify.on("activate", () => BrowserWindow.getAllWindows.length === 0 && createWindow(), electron)
  )
})

Disposer.register(
  Notify.on("window-all-closed", () => process.platform !== "darwin" && electron.quit(), electron)
)
