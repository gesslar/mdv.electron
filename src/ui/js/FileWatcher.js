import Base from "./Base.js"
import {error} from "./Logging.js"
import {DisposerClass, Notify} from "./vendor/toolkit.esm.js"

/**
 * Manages file watching for hot reload functionality.
 * This is a singleton that persists throughout the application lifetime.
 */
export default class FileWatcher extends Base {
  #currentFilePath = null
  #watchSession = new DisposerClass()
  #savedScrollOffset = null
  #tempScrollMarkerId = "__mdv_scroll_marker__"

  /**
   * Sets up file watching for the given path if hot reload is enabled.
   *
   * @param {string} filePath - Absolute path to the markdown file.
   */
  async watchFile(filePath) {
    // Store the current file path
    this.#currentFilePath = filePath

    // Set up file watching if hot reload is enabled
    await this.#setupFileWatcher()
  }

  /**
   * Sets up file watching based on user preference.
   *
   * @private
   */
  async #setupFileWatcher() {
    // Clean up existing watcher
    await this.#stopFileWatcher()

    // Check if hot reload is enabled (default is "on")
    const storedValue = localStorage.getItem("mdv-hot-reload") || "on"
    const hotReloadEnabled = storedValue === "on"

    if(!hotReloadEnabled || !this.#currentFilePath)
      return

    try {
      await window.mdv.watcher.watch(this.#currentFilePath)

      this.#watchSession.register([
        window.mdv.watcher.onChange(async() => {
          if(this.#currentFilePath) {
            try {
              this.#markScrollPosition()

              const content =
                await window.mdv.fs.readTextFile(this.#currentFilePath)
              Notify.emit("content-loaded", {content, hotReload: true})
            } catch(err) {
              error(`Failed to reload file: ${err.message}`)
            }
          }
        }),
        Notify.on("markdown-rendered", () => {
          if(this.#savedScrollOffset !== null) {
            this.#restoreScrollPosition()
          }
        }),
      ])
    } catch(err) {
      error(`Failed to set up file watcher: ${err}`)
    }
  }

  /**
   * Marks the current scroll position by finding the topmost visible element
   * and storing its offset from the viewport top.
   *
   * @private
   */
  #markScrollPosition() {
    const stage = document.querySelector("#stage")
    if(!stage)
      return

    const mainView = document.querySelector("#mainView")
    if(!mainView)
      return

    // Find all block-level elements in the stage
    const elements = Array.from(stage.querySelectorAll("p, h1, h2, h3, h4, h5, h6, pre, ul, ol, blockquote, table"))
    if(elements.length === 0)
      return

    const viewportTop = mainView.scrollTop

    // Find the first element that's at or above the viewport top
    let targetElement = null
    for(const el of elements) {
      if(el.offsetTop <= viewportTop) {
        targetElement = el
      } else {
        break
      }
    }

    // If no element above, use the first visible one
    if(!targetElement && elements.length > 0) {
      targetElement = elements[0]
    }

    if(targetElement) {
      // Store the offset from viewport top
      this.#savedScrollOffset = viewportTop - targetElement.offsetTop
      // Mark the element with a temporary ID
      targetElement.id = this.#tempScrollMarkerId
    }
  }

  /**
   * Restores scroll position by finding the marked element and scrolling to it
   * with the saved offset, then removes the temporary marker.
   *
   * @private
   */
  #restoreScrollPosition() {
    const markedElement = document.getElementById(this.#tempScrollMarkerId)
    if(!markedElement) {
      this.#savedScrollOffset = null

      return
    }

    const mainView = document.querySelector("#mainView")
    if(!mainView) {
      this.#savedScrollOffset = null

      return
    }

    // Scroll to the element's position plus the saved offset
    const targetScrollTop = markedElement.offsetTop + this.#savedScrollOffset
    mainView.scrollTop = targetScrollTop

    // Clean up: remove the temporary ID
    markedElement.removeAttribute("id")
    this.#savedScrollOffset = null
  }

  /**
   * Stops the file watcher.
   *
   * @private
   */
  async #stopFileWatcher() {
    this.#watchSession.dispose()

    try {
      await window.mdv.watcher.unwatch()
    } catch(_err) {
      // Ignore errors when stopping watcher
    }
  }

  /**
   * Handles hot reload preference changes.
   */
  async handleHotReloadChange() {
    await this.#setupFileWatcher()
  }

  /**
   * Removes the FileWatcher instance and cleans up.
   */
  remove() {
    this.#stopFileWatcher()
    super.remove()
  }
}
