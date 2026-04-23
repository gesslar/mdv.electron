import ConfigDialog from "./ConfigDialog.js"
import {error} from "./Logging.js"
import FileWatcher from "./FileWatcher.js"
import Markdown from "./Markdown.js"
import MarkdownFile from "./FileReader.js"
import Notify from "./Notify.js"
import UI from "./UI.js"

document.addEventListener("DOMContentLoaded", main.bind(this))

const app = {
  register: function(module) {
    const name = module.name || module.constructor.name
    this[name] = module
  },

  unregister: function(module) {
    delete this[module.constructor.name]
  },
}

function registerObject({detail: object}) {
  app.register(object)
}

function unregisterObject({detail: object}) {
  app.unregister(object)
}

async function main() {
  try {
    Notify.on("object-created", ob => registerObject(ob))
    Notify.on("object-removed", ob => unregisterObject(ob))
    Notify.on("config-dialog-requested", async evt => await getConfigDialog(evt))
    Notify.on("file-dialog-requested", async evt => await openFileDialog(evt))
    Notify.on("file-selected", async evt => await loadContent(evt))
    Notify.on("content-loaded", async evt => await displayContent(evt))
    Notify.on("file-loaded", async evt => await handleFileLoaded(evt))
    Notify.on("hot-reload-changed", async evt => await handleHotReloadChange(evt))

    const ui = new UI()
    await ui.initializeUI()

    // Initialize file watcher
    const fileWatcher = new FileWatcher()
    app.register(fileWatcher)

    // Check if a file was passed via CLI arguments (e.g., double-click)
    const markdownFile = new MarkdownFile()
    const cliFilePath = await markdownFile.identifyCliFilename()

    if(cliFilePath) {
      Notify.emit("file-selected", cliFilePath)
    } else {
      setTimeout(() => {
        // Notify.emit("file-selected", "/projects/git/mdv/work/fedora-machine-sync-guide.md")
        // Notify.emit("file-selected", "/projects/git/mdv/work/README.md")
        // Notify.emit("file-selected", "/home/gesslar/Downloads/README (2).md")
      }, 100)
    }

    markdownFile.remove()

  } catch(e) {
    error(`${e.message}\n${e.stack}`)
  }
}

async function getConfigDialog(evt) {
  const dialog = app[ConfigDialog.name] ?? new ConfigDialog()

  Object.assign(evt.detail, dialog)

  await dialog.toggleConfigurationPanel()
}

async function openFileDialog() {
  const markdownFile = new MarkdownFile()
  await markdownFile.browseFile()

  markdownFile.remove()
}

async function loadContent({detail: path}) {
  const markdownFile = new MarkdownFile()
  await markdownFile.loadFileFromPath(path)

  markdownFile.remove()
}

async function displayContent({detail}) {
  const content = typeof detail === "string" ? detail : detail.content
  const hotReload = detail?.hotReload || false

  const markdown = new Markdown(content)
  await markdown.render(hotReload)
}

async function handleFileLoaded({detail: filePath}) {
  const fileWatcher = app[FileWatcher.name]
  if(fileWatcher)
    await fileWatcher.watchFile(filePath)
}

async function handleHotReloadChange() {
  const fileWatcher = app[FileWatcher.name]
  if(fileWatcher)
    await fileWatcher.handleHotReloadChange()
}

// /** Loads a bundled debug file into the stage; intended for local development. */
// async function loadDebugFile() {
//   // const debugFile = "/projects/git/mdv/work/fedora-machine-sync-guide.md"
//   const debugFile = "/projects/git/mdv/work/README.md"
//   const content = await MarkdownFile.loadFileFromPath(debugFile)

//   if(content)
//     await app.UI.displayContent(content)
//   else
//     error(`Could not read file from source: ${debugFile}`)
// }

/*
  this should go in Document

  const marked = new Marked()
  await marked.initializeMarked()
*/
