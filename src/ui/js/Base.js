import Notify from "./Notify.js"
import Util from "./Util.js"

/**
 * Base helper for UI classes that want centralized event lifecycles.
 * Tracks listener disposer functions and registered DOM elements so subclasses
 * can easily tear down on removal.
 */
export default class Base {
  #disposers = new Array()
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

    this.#disposers.toReversed().forEach(disposer => disposer())
    this.#disposers.length = 0

    this.element && Util.clearHTMLContent(this.element)
  }

  /**
   * Registers a Notify listener and tracks its disposer for later cleanup.
   *
   * @param {string} eventName - Event to subscribe to.
   * @param {(evt: Event) => void} func - Handler to invoke.
   * @param {HTMLElement | Window} [element] - Target element; defaults to window.
   * @param {boolean | object} [options] - addEventListener options.
   */
  registerOn(eventName, func, element=undefined, options=undefined) {
    const disposer = Notify.on(eventName, func, element, options)

    this.#disposers.push(disposer)
  }

  /**
   * Exposes registered disposer callbacks for cleanup orchestration.
   *
   * @returns {Array<() => void>} Frozen list of disposer callbacks.
   */
  get disposers() {
    return Object.freeze(...this.#disposers)
  }

  /**
   * Resolves a DOM element and optionally registers listener functions on it.
   * Each listener's return value is treated as a disposer and tracked.
   *
   * @param {string} elementId - Selector passed to querySelector.
   * @param {((element: Element) => (void | (() => void))) | Array<(element: Element) => (void | (() => void))>} [listenerFunctions] - One or more listener initializers.
   */
  initialiseElement(elementId, listenerFunctions=[]) {
    const functionp = f => typeof f === "function"

    const element = document.querySelector(elementId)
    if(!element)
      throw new Error(`Unable to load element '${elementId}'`)

    this.#elements.set(element, element)

    listenerFunctions = Array.isArray(listenerFunctions)
      ? listenerFunctions
      : [listenerFunctions]

    if(listenerFunctions.length > 0 && !listenerFunctions.every(functionp))
      throw new Error(`Listener functions must be a single function or an array of functions.`)

    const errors = []
    listenerFunctions.forEach(f => {
      try {
        const disposer = f.call(element, element)
        this.#disposers.push(disposer)
      } catch(e) {
        errors.push(e)
      }
    })

    if(errors.length > 0)
      throw new AggregateError(errors, `Error(s) registering listeners for ${elementId}.`)
  }
}
