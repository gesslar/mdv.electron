import Base from "./Base.js"
import {error} from "./Logging.js"
import {HTML, Notify} from "./vendor/toolkit.esm.js"

/**
 * Manages the on-demand configuration panel and theme selection.
 * Responsible for creating/removing the dialog, saving user theme preferences,
 * and wiring theme toggle buttons. Theme application to the DOM is handled by UI.
 */
export default class ConfigDialog extends Base {
  #contentPath = "config-panel.html"
  #themes = ["auto", "light", "dark"]
  #hotReloadOptions = ["on", "off"]

  /**
   * Resolves the active configuration dialog element.
   *
   * @returns {HTMLDialogElement?} Currently active configuration dialog.
   */
  get element() {
    return document.querySelector("#config-panel")
  }

  /**
   * Resolves the backdrop element behind the dialog when present.
   *
   * @returns {HTMLElement?} Backdrop element attached behind the dialog.
   */
  get backdrop() {
    return document.querySelector("#config-backdrop")
  }

  /**
   * Opens the configuration panel when absent; closes and removes it when
   * present.
   *
   * @returns {Promise<void>}
   */
  async toggleConfigurationPanel() {
    return this.element
      ? this.#remove()
      : this.#new()
  }

  /**
   * Builds and displays the configuration dialog and its backdrop.
   *
   * @returns {Promise<void>}
   * @private
   */
  async #new() {
    if(this.element)
      return

    const configContent = await HTML.loadHTML(this.#contentPath)
    if(!configContent)
      return error("Unable to load configuration content.")

    // Create custom backdrop
    const backdrop = document.createElement("div")
    backdrop.id = "config-backdrop"
    document.body.appendChild(backdrop)

    const panel = document.createElement("dialog")
    panel.id = "config-panel"
    panel.role = "dialog"

    HTML.setHTMLContent(panel, configContent)
    document.body.appendChild(panel)

    this.#restoreThemeSettings()
    this.#restoreHotReloadSettings()
    this.#initialiseActions()

    this.element.showModal()
  }

  /**
   * Closes and removes the configuration dialog and backdrop.
   *
   * @private
   */
  #remove() {
    if(!this.element)
      return

    this.element.close()

    document.body.removeChild(this.element)

    if(this.backdrop)
      document.body.removeChild(this.backdrop)

    this.remove()
  }

  // Theme handling
  /**
   * Saves the theme preference and emits a theme-changed event for UI to apply.
   *
   * @param {"auto"|"light"|"dark"} themePreference - User's theme preference.
   * @private
   */
  #saveThemePreference(themePreference) {
    if(themePreference === "light" || themePreference === "dark") {
      localStorage.setItem("mdv-theme", themePreference)
    } else {
      // "auto" means no preference, use system default
      localStorage.removeItem("mdv-theme")
    }

    // Notify UI to apply the theme
    Notify.emit("theme-changed", {theme: themePreference})
  }

  /**
   * Returns the currently saved theme preference.
   *
   * @returns {"auto"|"light"|"dark"} The saved preference or "auto" if none.
   */
  getThemePreference() {
    return localStorage.getItem("mdv-theme") || "auto"
  }

  /**
   * Toggles the active class on a button. Has the side effect of
   * toggling the other buttons in the same group in the opposite direction if active===true
   *
   * @param {HTMLElement} button - Button to toggle.
   * @param {boolean} [active] - True when setting the active state.
   * @param {Array<HTMLElement>} [buttonGroup] - The button group to toggle within.
   * @private
   */
  #toggleButton(button, active=true, buttonGroup=null) {
    if(typeof active !== "boolean")
      throw new TypeError("Active must be true or false.")

    if(active === true && buttonGroup) {
      buttonGroup.forEach(e =>
        e.id === button.id
          ? e.classList.add("active")
          : e.classList.remove("active")
      )
    } else if(active === true) {
      // Fallback for backwards compatibility with theme buttons
      this.#themeButtons.forEach(e =>
        e.id === button.id
          ? e.classList.add("active")
          : e.classList.remove("active")
      )
    } else {
      button.classList.remove("active")
    }
  }

  get #currentThemePreference() {
    return this.getThemePreference()
  }

  get #themeButtons() {
    return this.#themes
      .map(e => `#btn-${e}`)
      .map(e => document.querySelector(e))
      .filter(Boolean)
  }

  get #hotReloadButtons() {
    return this.#hotReloadOptions
      .map(e => `#btn-reload-${e}`)
      .map(e => document.querySelector(e))
      .filter(Boolean)
  }

  /**
   * Restores theme preference from localStorage into the toggle UI.
   *
   * @returns {void}
   */
  #restoreThemeSettings() {
    const themePreference = this.#currentThemePreference
    const button = document.querySelector(`#btn-${themePreference}`)

    this.#toggleButton(button, true)
  }

  /**
   * Handles theme button click events and saves the theme preference.
   *
   * @param {MouseEvent} event - Click originating from a theme button.
   * @private
   */
  #themeButtonClick(event) {
    const button = event.currentTarget
    const themePreference = button.id.replace("btn-", "")

    this.#saveThemePreference(themePreference)
    this.#toggleButton(button, true)
  }

  // Hot reload handling
  /**
   * Saves the hot reload preference and emits a hot-reload-changed event.
   *
   * @param {"on"|"off"} hotReloadPreference - User's hot reload preference.
   * @private
   */
  #saveHotReloadPreference(hotReloadPreference) {
    localStorage.setItem("mdv-hot-reload", hotReloadPreference)
    Notify.emit("hot-reload-changed", {enabled: hotReloadPreference === "on"})
  }

  /**
   * Returns the currently saved hot reload preference.
   *
   * @returns {"on"|"off"} The saved preference or "on" if none (default is on).
   */
  getHotReloadPreference() {
    return localStorage.getItem("mdv-hot-reload") || "on"
  }

  get #currentHotReloadPreference() {
    return this.getHotReloadPreference()
  }

  /**
   * Restores hot reload preference from localStorage into the toggle UI.
   *
   * @returns {void}
   */
  #restoreHotReloadSettings() {
    const hotReloadPreference = this.#currentHotReloadPreference
    const button = document.querySelector(`#btn-reload-${hotReloadPreference}`)

    this.#toggleButton(button, true, this.#hotReloadButtons)
  }

  /**
   * Handles hot reload button click events and saves the preference.
   *
   * @param {MouseEvent} event - Click originating from a hot reload button.
   * @private
   */
  #hotReloadButtonClick(event) {
    const button = event.currentTarget
    const hotReloadPreference = button.id.replace("btn-reload-", "")

    this.#saveHotReloadPreference(hotReloadPreference)
    this.#toggleButton(button, true, this.#hotReloadButtons)
  }

  #initialiseActions() {
    const close = document.querySelector("#close-config")
    const panel = this.element

    this.registerOn("click", () => this.#closeButtonClick(), close, {once: true})
    this.registerOn("close", () => this.#closeButtonClick(), panel, {once: true})

    this.#themeButtons.forEach(button => this.initialiseElement(
      `#${button.id}`,
      () => Notify.on("click", evt => this.#themeButtonClick(evt), button)
    ))

    this.#hotReloadButtons.forEach(button => this.initialiseElement(
      `#${button.id}`,
      () => Notify.on("click", evt => this.#hotReloadButtonClick(evt), button)
    ))

  }

  /**
   * Handles the dialog close button and performs cleanup.
   *
   * @private
   */
  #closeButtonClick() {
    this.#remove()
  }
}
