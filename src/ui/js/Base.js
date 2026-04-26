import {DisposerClass, HTML, Notify} from "./vendor/toolkit.esm.js"

/**
 * Base helper for UI classes that want centralized event lifecycles.
 * Tracks disposer callbacks and registered DOM elements so subclasses
 * can easily tear down on removal.
 */
export default class Base {
  #disposer = new DisposerClass()
  #elements = new Map()
  #element = null

  /**
   * Constructs the base lifecycle helper and signals creation for subclasses.
   */
  constructor() {
    if(this.constructor.name !== "Base")
      Notify.emit("object-created", this)
  }

  /**
   * Assigns an HTMLElement to this object.
   *
   * @throws {Error} If there is already one assigned.
   */
  set element(element) {
    // I'm a safety girl!
    if(this.#element)
      throw new Error("Gonna need more martini to put more of those in me.")

    this.#element = element
  }

  /**
   * Returns the HTMLElement associated with this object.
   *
   * @returns {HTMLElement} The HTMLElement associated with this object.
   */
  get element() {
    return this.#element
  }

  /**
   * Cleans up registered disposers and emits a removal event for subscribers.
   *
   * @returns {void}
   */
  remove() {
    Notify.emit("object-removed", this)

    this.#disposer.dispose()

    this.element && HTML.clearHTMLContent(this.element)
  }

  /**
   * Registers a Notify listener and tracks its disposer for later cleanup.
   *
   * @param {string} eventName - Event to subscribe to.
   * @param {(evt: Event) => void} func - Handler to invoke.
   * @param {HTMLElement | Window} [element] - Target element; defaults to window.
   * @param {boolean | object} [options] - addEventListener options.
   * @returns {() => void} Unregister function that detaches the listener and drops it from the disposer registry.
   */
  registerOn(eventName, func, element=undefined, options=undefined) {
    return this.#disposer.register(Notify.on(eventName, func, element, options))
  }

  /**
   * Registers one or more disposer callbacks on this object's lifecycle.
   *
   * @param {...(() => void)|Array<() => void>} disposers - Cleanup callbacks.
   * @returns {(() => void)|Array<() => void>} Unregister function(s).
   */
  register(...disposers) {
    return this.#disposer.register(...disposers)
  }

  /**
   * Exposes registered disposer callbacks for cleanup orchestration.
   *
   * @returns {Array<() => void>} Frozen list of disposer callbacks.
   */
  get disposers() {
    return this.#disposer.disposers
  }

  /**
   * Resolves a DOM element and optionally registers listener functions on it.
   * Each listener's return value, when a function, is registered as a disposer.
   *
   * @param {string} elementId - Selector passed to querySelector.
   * @param {((element: Element) => (void | (() => void))) | Array<(element: Element) => (void | (() => void))>} [listenerFunctions] - One or more listener initializers.
   */
  initialiseElement(elementId, listenerFunctions=[]) {
    const element = document.querySelector(elementId)
    if(!element)
      throw new Error(`Unable to load element '${elementId}'`)

    this.#elements.set(element, element)

    const listeners = Array.isArray(listenerFunctions)
      ? listenerFunctions
      : [listenerFunctions]

    if(listeners.length === 0)
      return

    if(!listeners.every(f => typeof f === "function"))
      throw new Error(`Listener functions must be a single function or an array of functions.`)

    const errors = []

    listeners.forEach(f => {
      try {
        const disposer = f.call(element, element)

        if(typeof disposer === "function")
          this.#disposer.register(disposer)
      } catch(e) {
        errors.push(e)
      }
    })

    if(errors.length > 0)
      throw new AggregateError(errors, `Error(s) registering listeners for ${elementId}.`)
  }
}
