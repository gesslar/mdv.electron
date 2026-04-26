const {contextBridge, ipcRenderer, webUtils} = require("electron")

// Narrow bridge surface for the renderer. Anything the UI touches goes
// through here — no direct ipcRenderer exposure, no node globals.
contextBridge.exposeInMainWorld("mdv", {
  cli: {
    getRuntimePath: () => ipcRenderer.invoke("cli:get-runtime-path"),
    getArgs: () => ipcRenderer.invoke("cli:get-args")
  },

  dialog: {
    openFile: options => ipcRenderer.invoke("dialog:open-file", options)
  },

  fs: {
    readTextFile: path => ipcRenderer.invoke("fs:read-text-file", path),
    getPathForFile: file => webUtils.getPathForFile(file)
  },

  watcher: {
    watch: path => ipcRenderer.invoke("watcher:watch", path),
    unwatch: () => ipcRenderer.invoke("watcher:unwatch"),
    onChange: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on("watcher:changed", listener)

      return () => ipcRenderer.removeListener("watcher:changed", listener)
    }
  },

  log: {
    trace: message => ipcRenderer.send("log", "trace", message),
    debug: message => ipcRenderer.send("log", "debug", message),
    info: message => ipcRenderer.send("log", "info", message),
    warn: message => ipcRenderer.send("log", "warn", message),
    error: message => ipcRenderer.send("log", "error", message)
  }
})
