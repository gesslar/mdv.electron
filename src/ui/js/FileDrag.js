import {Disposer, Notify} from "./vendor/toolkit.esm.js"

const dragStartEvents = ["dragenter","dragover"]
const dragStopEvents = ["dragleave","drop"]

/**
 * Global drag-and-drop coordinator that emits events for file interactions.
 * Adds/removes visual affordances and forwards dropped files to listeners.
 */
export default class FileDrag {
  /**
   * Registers window-level drag/drop listeners to capture files anywhere in the viewport.
   *
   * @returns {Promise<void>} Resolves after listeners are attached.
   */
  static async initializeFileDrag() {
    Disposer.register([
      ...dragStartEvents.map(e => Notify.on(e, this.#enter)),
      ...dragStopEvents.map(e => Notify.on(e, this.#leave)),
      Notify.on("drop", this.#handleFileDrop),
    ])
  }

  /**
   * Handles dragenter/dragover events by cancelling defaults and adding the
   * visual affordance. preventDefault on dragover is required for drop to fire.
   *
   * @param {DragEvent} evt - Drag event entering the drop zone.
   * @private
   */
  static async #enter(evt) {
    evt.preventDefault()
    Notify.emit("drag-in", evt)
  }

  /**
   * Removes the drag affordance shortly after the cursor leaves the drop zone.
   *
   * @param {DragEvent} evt - Drag event leaving the drop zone.
   */
  static #leave(evt) {
    evt.preventDefault()
    Notify.emit("drag-out", evt)
  }

  /**
   * Extracts a dropped file and renders its content through the UI.
   *
   * @param {DragEvent} evt - Drop event containing the files.
   * @returns {Promise<void>} Resolves after rendering or logging an error.
   * @private
   */
  static async #handleFileDrop(evt) {
    evt.preventDefault()
    Notify.emit("file-dropped", evt)
  }
}
