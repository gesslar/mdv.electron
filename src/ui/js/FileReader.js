import Base from "./Base.js"
import {error, warn} from "./Logging.js"
import MD from "./MD.js"
import Notify from "./Notify.js"

/**
 * Handles loading markdown from disk or drag-and-drop and hands content to the UI.
 * Initialization wires global drag/drop listeners; other helpers validate and read files.
 */
export default class MarkdownFile extends Base {
  /**
   * Attempts to resolve a CLI-provided markdown file path at launch.
   *
   * @returns {Promise<string|null>} File path when detected; null otherwise.
   */
  async identifyCliFilename() {
    const [arg] = await window.mdv.cli.getArgs()

    return this.#isLikelyMarkdownFile(arg)
      ? arg
      : null
  }

  /**
   * Simple extension check to decide if a token likely refers to a markdown
   * file.
   *
   * @param {string} filename - Candidate CLI token.
   * @returns {boolean} True when the token ends with a known extension.
   */
  #isLikelyMarkdownFile(filename) {
    if(!filename)
      return false

    const {ext} = /.*\.(?<ext>.*)$/.exec(filename)?.groups ?? {}

    return ext && ext.toLocaleLowerCase() in MD.EXT
  }

  #validMimeTypes = Object.freeze(["text/markdown", "application/x-markdown"])
  /**
   * Supported markdown MIME types.
   *
   * @returns {Array<string>} Immutable list of MIME types.
   */
  get validMimeTypes() {
    return this.#validMimeTypes
  }

  #validExtensions = Object.freeze(["md", "markdown", "mkd"])
  /**
   * Supported markdown file extensions.
   *
   * @returns {Array<string>} Immutable list of file extensions.
   */
  get validExtensions() {
    return this.#validExtensions
  }

  /**
   * Ensures a candidate File has a markdown MIME type or extension.
   *
   * @param {File} file - Candidate file to validate.
   * @returns {boolean} True when the file appears to be markdown.
   */
  #validFileType(file) {
    if(!file || !file.type || !file.name)
      return false

    const mimeType = file.type.toLowerCase()
    const ext = file.name.split(".").pop().toLowerCase()

    return this.validMimeTypes.includes(mimeType)
        || this.validExtensions.includes(ext)
  }

  /**
   * Opens a file picker and loads the selected markdown onto the stage.
   */
  async browseFile() {
    try {
      const selection = await this.#promptForFileSelection()

      if(!selection)
        Notify.emit("file-not-selected")
      else
        Notify.emit("file-selected", selection)
    } catch(e) {
      throw new Error(`Could not read selected file: ${e}`)
    }
  }

  /**
   * Prompts the user to select a markdown file.
   *
   * @returns {Promise<string?>} Absolute file path or null when cancelled.
   * @private
   */
  async #promptForFileSelection() {
    try {
      const selected = await window.mdv.dialog.openFile({
        title: "Open Markdown File",
        filters: [{
          name: "Markdown Files",
          extensions: this.validExtensions,
        }],
        multiple: false,
        directory: false,
      })

      return selected || null
    } catch(err) {
      error(`Failed to open file dialog: ${err}`)

      return null
    }
  }

  /**
   * Extracts the dropped markdown file and returns its text contents.
   *
   * @param {DragEvent} e - Drop event containing potential files.
   * @returns {Promise<string?>} File contents or null when invalid/unreadable.
   * @private
   */
  async loadFromDrop(e) {
    const collection = []

    if(e.dataTransfer.files)
      collection.push(...e.dataTransfer.files)
    else if(e.dataTransfer.items)
      collection.push(...(
        Array.from(e.dataTransfer.items)
          .filter(item => item.kind === "file")
          .map(item => item.getAsFile())
      ))

    const valid = collection.filter(item => this.#validFileType(item))

    if(valid.length !== 1)
      return warn("Please drop a single markdown file.")

    const file = valid[0]
    const content = await file?.text()

    if(!content)
      return error("Could not read dropped file.")

    return content
  }

  /**
   * Reads markdown from a file path.
   *
   * @param {string} filePath - Absolute path to the markdown file.
   * @returns {Promise<string?>} File contents or null when missing/unreadable.
   */
  async loadFileFromPath(filePath) {
    if(!filePath)
      throw new Error("No file path provided.")

    try {
      const content = await window.mdv.fs.readTextFile(filePath)

      if(!content)
        throw new Error("Could not read selected file.")

      Notify.emit("content-loaded", content)
      Notify.emit("file-loaded", filePath)
    } catch(err) {
      throw new Error(`Could not read selected file: ${err}`)
    }
  }
}
