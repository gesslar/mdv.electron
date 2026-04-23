import Base from "./Base.js"
import Notify from "./Notify.js"

const dragStartEvents = ["dragenter","dragover"]
const dragStopEvents = ["dragleave","drop"]
const disposers = []

/**
 * Global drag-and-drop coordinator that emits events for file interactions.
 * Adds/removes visual affordances and forwards dropped files to listeners.
 */
export default class FileDrag extends Base {
  /**
   * Registers window-level drag/drop listeners to capture files anywhere in the viewport.
   *
   * @returns {Promise<void>} Resolves after listeners are attached.
   */
  static async initializeFileDrag() {
    dragStartEvents.forEach(
      e => disposers.push(Notify.on(e, evt => this.#enter(evt)))
    )

    dragStopEvents.forEach(
      e => disposers.push(Notify.on(e, evt => this.#leave(evt)))
    )

    disposers.push(Notify.on(
      "drop", evt => this.#handleFileDrop(evt))
    )
  }

  /**
   * Handles dragenter/dragover events by cancelling defaults and adding the
   * visual affordance.
   *
   * @param {DragEvent} evt - Drag event entering the drop zone.
   * @private
   */
  static async #enter(evt) {
    Notify.emit("drag-in", evt)
  }

  /**
   * Removes the drag affordance shortly after the cursor leaves the drop zone.
   *
   * @param {DragEvent} evt - Drag event leaving the drop zone.
   */
  static #leave(evt) {
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
    Notify.emit("file-dropped", evt)
  }
}
