import Base from "./Base.js"
import {warn} from "./Logging.js"
import {Notify} from "./vendor/toolkit.esm.js"

/**
 * @import {Markdown} from "./Markdown.js"
 * @import TOC from "./TOC.js"
 */

/**
 * Coordinates DOM lookups, event wiring, and display behavior for the UI.
 *
 * Responsibilities include:
 * - Resolving and caching UI widgets (regions, drag targets, action buttons)
 * - Wiring actions to buttons defined in {@link UI.#actions}
 * - Applying drag-and-drop affordances to drop targets
 * - Disabling browser defaults that conflict with the app (context menu, text selection)
 * - Toggling region visibility when switching between views
 * - Resetting the stage and rendering markdown with syntax highlighting and a TOC
 * - Enabling smooth anchor scrolling within rendered content
 * - Applying theme styles (light/dark mode) to the DOM
 */
export default class UI extends Base {
  #regionIds = Object.freeze(["#stage", "#watermark"])
  #dragTargetIds = Object.freeze(["#mainView", "#plusIcon"])
  #actionButtonIds = Object.freeze([
    "#action-config-button",
    "#action-open-button",
    "#action-minimize",
    "#action-maximize",
    "#action-restore",
    "#action-close",
  ])
  #actions = Object.freeze(new Map([
    ["#action-config-button", () => Notify.request("config-dialog-requested")],
    ["#action-open-button", () => Notify.emit("file-dialog-requested")],
    ["#action-minimize", () => window.mdv.window.minimize()],
    ["#action-maximize", () => window.mdv.window.toggleMaximize()],
    ["#action-restore", () => window.mdv.window.toggleMaximize()],
    ["#action-close", () => window.mdv.window.close()],
  ]))
  #shortcuts = Object.freeze(new Map([
    ["ctrl+o", "#action-open-button"],
    ["ctrl+w", "#action-close"],
  ]))
  #markdown
  #currentTheme = null
  #flashTimeout

  /**
   * Resolves configured widgets and attaches button actions.
   * Throws if a required element cannot be found; call once during startup.
   *
   * @returns {Promise<void>}
   */
  async initializeUI() {
    this.#regionIds.forEach(e => this.initialiseElement(e))
    this.#dragTargetIds.forEach(e => this.initialiseElement(e))
    this.#actionButtonIds.forEach(e => {
      const action = this.#actions.get(e)

      this.initialiseElement(
        e,
        () => Notify.on("click", action, document.querySelector(e))
      )
    })

    this.registerOn("keydown", evt => this.#handleShortcut(evt), document)
    this.registerOn("copy", evt => this.#handleCopy(evt), document)
    this.registerOn(
      "contextmenu",
      evt => this.#handleStageContextMenu(evt),
      document.querySelector("#stage")
    )

    this.registerOn("drag-in", evt => this.#dragIn(evt))
    this.registerOn("drag-out", evt => this.#dragOut(evt))
    this.registerOn("markdown-rendered", evt => this.#displayContent(evt))
    this.registerOn("object-removed", evt => this.#handleObjectRemoval(evt))
    this.registerOn("theme-changed", evt => this.#handleThemeChange(evt))

    this.initializeTheme()
    await this.#initializeWindowControls()
  }

  /**
   * Reflects the current maximized state on the titlebar buttons and keeps
   * them in sync with future window state changes.
   *
   * @private
   */
  async #initializeWindowControls() {
    this.#applyMaximizedState(await window.mdv.window.isMaximized())

    this.register(
      window.mdv.window.onMaximizedChanged(
        isMax => this.#applyMaximizedState(isMax)
      )
    )
  }

  /**
   * Shows the restore button when the window is maximized, otherwise the
   * maximize button. Other titlebar buttons are unaffected.
   *
   * @param {boolean} isMaximized - Whether the window is currently maximized.
   * @private
   */
  #applyMaximizedState(isMaximized) {
    const maximize = document.querySelector("#action-maximize")
    const restore = document.querySelector("#action-restore")

    if(maximize)
      maximize.style.display = isMaximized ? "none" : ""

    if(restore)
      restore.style.display = isMaximized ? "" : "none"
  }

  /**
   * Initializes the theme based on saved preference or system default.
   * Also wires a matchMedia listener so "auto" follows live OS theme changes.
   * Called once during app startup.
   *
   * @returns {void}
   */
  initializeTheme() {
    const savedPreference = localStorage.getItem("mdv-theme") || "auto"

    this.applyTheme(savedPreference)

    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        const current = localStorage.getItem("mdv-theme") || "auto"

        if(current === "auto")
          this.applyTheme("auto")
      })
  }

  /**
   * Applies the specified theme preference to the DOM.
   * Resolves "auto" to light/dark based on system preference.
   *
   * @param {"auto"|"light"|"dark"} themePreference - The theme preference to apply.
   * @returns {void}
   */
  applyTheme(themePreference) {
    const html = document.documentElement
    const hljsTheme = document.getElementById("hljs-theme")

    html.classList.remove("light", "dark")

    let resolvedTheme
    if(themePreference === "light" || themePreference === "dark") {
      resolvedTheme = themePreference
    } else {
      // Resolve "auto" based on system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      resolvedTheme = prefersDark ? "dark" : "light"
    }

    html.classList.add(resolvedTheme)
    hljsTheme.href = `css/highlight-${resolvedTheme === "dark" ? "dark" : "light"}.css`

    this.#currentTheme = resolvedTheme
  }

  /**
   * Returns the currently applied theme (light or dark).
   * This is the resolved theme, not the preference (auto is resolved to light/dark).
   *
   * @returns {"light"|"dark"} The currently active theme.
   */
  getCurrentTheme() {
    return this.#currentTheme
  }

  /**
   * Handles theme-changed events from ConfigDialog.
   *
   * @param {{detail: {theme: string}}} evt - Theme change event.
   * @private
   */
  #handleThemeChange({detail: {theme}}) {
    this.applyTheme(theme)
  }

  #disableMenu() {
    return function(event) {
      this.preventDefaults(event)

      return false
    }
  }

  /**
   * Returns the active document selection iff it carries copyable content,
   * otherwise null. Used by both Ctrl+C and the context menu copy path.
   *
   * @returns {Selection|null} Selection with non-empty content, or null.
   * @private
   */
  #copyableSelection() {
    const selection = window.getSelection()

    if(!selection || selection.isCollapsed || selection.toString().length === 0)
      return null

    return selection
  }

  /**
   * Serializes the given selection's first range into HTML.
   *
   * @param {Selection} selection - Source selection.
   * @returns {string} HTML markup of the selected range.
   * @private
   */
  #selectionAsHtml(selection) {
    const container = document.createElement("div")
    container.appendChild(selection.getRangeAt(0).cloneContents())

    return container.innerHTML
  }

  /**
   * Hijacks Ctrl+C so the default copy carries both rich (HTML) and plain
   * payloads. Falls through (lets the browser handle it) when there's no
   * document selection — that path covers `<input>`/`<textarea>` copies,
   * which use their own selection model.
   *
   * @param {ClipboardEvent} evt - The copy event.
   * @private
   */
  #handleCopy(evt) {
    const selection = this.#copyableSelection()

    if(!selection)
      return

    evt.clipboardData.setData("text/html", this.#selectionAsHtml(selection))
    evt.clipboardData.setData("text/plain", selection.toString())
    evt.preventDefault()
  }

  /**
   * Pops a context menu over the stage. The Copy action writes the same
   * rich (HTML + plain) payload as Ctrl+C.
   *
   * @param {MouseEvent} evt - The contextmenu event.
   * @private
   */
  async #handleStageContextMenu(evt) {
    this.preventDefaults(evt)

    const selection = this.#copyableSelection()
    const action = await window.mdv.contextMenu.stage({
      hasSelection: !!selection
    })

    if(action !== "copy" || !selection)
      return

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob(
          [this.#selectionAsHtml(selection)],
          {type: "text/html"}
        ),
        "text/plain": new Blob(
          [selection.toString()],
          {type: "text/plain"}
        ),
      })
    ])
  }

  /**
   * Dispatches keyboard shortcuts to the same actions wired to action buttons.
   *
   * @param {KeyboardEvent} evt - Keyboard event.
   * @private
   */
  #handleShortcut(evt) {
    const mod = evt.ctrlKey || evt.metaKey ? "ctrl+" : ""
    const key = `${mod}${evt.key.toLowerCase()}`
    const buttonId = this.#shortcuts.get(key)

    if(!buttonId)
      return

    const action = this.#actions.get(buttonId)

    if(!action)
      return

    this.preventDefaults(evt)
    action()
  }

  /**
   * Prevents default context menu and text selection inside the app window.
   */
  disableMenu() {
    this.registerOn("contextmenu", this.#disableMenu(), document, {capture: true})
    this.registerOn("selectstart", this.#disableMenu(), document, {capture: true})
  }

  /**
   * Toggles display state for all registered regions, hiding visible ones and showing hidden ones.
   * Used when switching between the main UI views.
   */
  swapVisibility() {
    document.querySelectorAll(this.#regionIds.map(e => `#${e}`)
      .join(" "))
      .forEach(e => e.style.display = e.style.display === "none" ? "block" : "none")
  }

  /**
   * Clears rendered markdown, hides the stage pane, and re-displays the watermark.
   *
   * @private
   */
  #resetStage() {
    this.#markdown?.remove()

    const stage = document.querySelector("#stage")
    const watermark = document.querySelector("#watermark")
    const main = document.querySelector("main")
    stage.replaceChildren()
    watermark.style.display = "block"
    stage.style.display = "none"
    main.classList.remove("has-content")
  }

  /**
   * Handles the markdown-rendered event by swapping the stage content with the
   * latest render, attaching the TOC, and re-enabling in-page scrolling hooks.
   *
   * @param {{detail: {markdown: Markdown, toc: TOC, hotReload: boolean}}} payload - Event payload containing the rendered markdown instance.
   * @returns {Promise<void>} Resolves after the stage is updated.
   */
  async #displayContent({detail: {markdown,toc,hotReload}}) {
    const stage = document.querySelector("#stage")
    const watermark = document.querySelector("#watermark")
    const main = document.querySelector("main")

    if(hotReload) {
      // During hot reload, clean up old markdown/TOC but preserve the stage structure
      if(this.#markdown) {
        this.#markdown.remove()
      }

      // Replace stage content
      const existingContent = stage.firstElementChild
      if(existingContent) {
        stage.replaceChild(markdown.element, existingContent)
      } else {
        stage.appendChild(markdown.element)
      }

      // Replace TOC
      const existingToc = main.querySelector("#toc")
      const tocElement = toc?.element
      if(existingToc) {
        if(tocElement)
          main.replaceChild(tocElement, existingToc)
        else
          existingToc.remove()
      } else if(tocElement) {
        main.appendChild(tocElement)
        main.classList.add("has-content")
      }

      this.#markdown = markdown
      this.setupScrolling()
    } else {
      // Normal load: full reset and fresh content
      this.#resetStage()
      this.#markdown = markdown
      const mdElement = markdown.element

      if(!mdElement)
        return

      stage.appendChild(mdElement)

      const tocElement = toc?.element
      if(tocElement) {
        main.appendChild(tocElement)
        main.classList.add("has-content")
      }

      watermark.style.display = "none"
      stage.style.display = "block"

      this.setupScrolling()
      stage.scrollTo({
        top: 0,
        behavior: "smooth"
      })

      this.#flashStage(stage)
    }
  }

  /**
   * Enables smooth in-page scrolling for anchors with hash hrefs within
   * rendered content.
   *
   * Adds click handlers to matching `<a>` tags that prevent the default jump
   * and call `scrollIntoView`.
   *
   * @returns {void}
   */
  setupScrolling() {
    return document.querySelectorAll("a[href^=\"#\"]")
      .forEach(anchor => {
        this.registerOn("click", evt => this.#scrollTo(evt, anchor), anchor)
      })
  }

  /**
   * Scroll handler
   *
   * @param {Event} evt - The click event.
   * @param {HTMLAnchorElement} anchor - The upon which we clicked thing
   * @returns {void}
   */
  #scrollTo(evt, anchor) {
    const target = document.querySelector(anchor.getAttribute("href"))

    if(!target)
      return

    this.preventDefaults(evt)

    if(target)
      target.scrollIntoView({behavior: "smooth"})
  }

  #dragTimeout

  #flashStage(stage) {
    if(!stage)
      return

    stage.classList.remove("flash-feedback")
    this.#flashTimeout && clearTimeout(this.#flashTimeout)

    // Force reflow so repeated renders retrigger the animation
    void stage.offsetWidth

    stage.classList.add("flash-feedback")
    this.#flashTimeout = setTimeout(() => stage.classList.remove("flash-feedback"), 450)
  }

  #dragIn(evt) {
    this.preventDefaults(evt)
    this.#addDragEffect()
    this.#dragTimeout && clearTimeout(this.#dragTimeout)
  }

  #dragOut(evt) {
    this.preventDefaults(evt)
    this.#dragTimeout = setTimeout(() => this.#removeDragEffect(), 50)
  }

  /**
   * Prevents default browser drag/drop behavior and stops propagation.
   *
   * @param {DragEvent} evt - Event to cancel.
   */
  preventDefaults(evt) {
    evt.preventDefault && evt.preventDefault()
    evt.stopPropagation && evt.stopPropagation()
  }

  /**
   * Flips the presence of the `dragging` CSS class on a widget.
   *
   * @param {HTMLElement} element - Element to toggle.
   * @private
   */
  #toggleDragEffect(element) {
    if(element.classList.contains("dragging"))
      element.classList.remove("dragging")
    else
      element.classList.add("dragging")
  }

  /** Adds the drag affordance class to all drop targets. */
  #addDragEffect() {
    document.querySelectorAll(
      this.#dragTargetIds
        .join(" ")
    )
      .forEach(e => !e.classList.contains("dragging") && this.#toggleDragEffect(e))
  }

  /** Removes the drag affordance class from all drop targets. */
  #removeDragEffect() {
    document.querySelectorAll(
      this.#dragTargetIds
        .join(" ")
    )
      .forEach(e => e.classList.contains("dragging") && this.#toggleDragEffect(e))
  }

  #handleObjectRemoval({detail: object}) {
    /** @type {HTMLElement} */
    const element = object?.element

    if(!element)
      return

    /** @type {HTMLElement} */
    const parent = element.parentElement
    if(!parent)
      return warn("Unable to determine parent for element.")

    parent.removeChild(element)
  }
}
