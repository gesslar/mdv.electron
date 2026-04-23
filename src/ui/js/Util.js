import {error} from "./Logging.js"
import DOMPurify from "./vendor/dompurify.esm.js"

/**
 * Utility helpers for sanitization and DOM manipulation.
 */
export default class Util {
  /**
   * Fetches an HTML fragment and returns the contents inside the <body> tag when present.
   *
   * @param {string} url - Location of the HTML resource to load.
   * @returns {Promise<string|undefined>} Sanitized HTML string or undefined on failure.
   */
  static async loadHTML(url) {
    try {
      const response = await fetch(url)
      const html = await response?.text()

      if(!html)
        throw new Error(`Failed to load HTML from ${url}`)

      const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)

      return match ? match[1] : html
    } catch(e) {
      error(e)
    }
  }

  /**
   * Sanitizes arbitrary HTML using DOMPurify.
   *
   * @param {string} text - HTML string to sanitize.
   * @returns {string} Sanitized HTML.
   */
  static sanitise(text) {
    return DOMPurify.sanitize(text)
  }

  /**
   * Sanitizes an HTML string and replaces the element's children with the result.
   *
   * @param {Element} element - Target element to replace content within.
   * @param {string} htmlString - HTML string to sanitize and insert.
   */
  static setHTMLContent(element, htmlString) {
    // const sanitised = this.sanitise(htmlString)
    const sanitised = htmlString
    const range = document.createRange()
    const fragment = range.createContextualFragment(sanitised)

    element.replaceChildren(fragment)
  }

  /**
   * Removes all child nodes from the given element.
   *
   * @param {Element} element - Element to clear.
   */
  static clearHTMLContent(element) {
    element.replaceChildren()
  }

  /**
   * Checks if a value is a plain object - created with object literals {},
   * new Object(), or Object.create(null).
   *
   * Distinguishes plain objects from objects created by custom constructors, built-ins,
   * or primitives. Plain objects only have Object.prototype or null in their prototype chain.
   *
   * @param {unknown} value - The value to check
   * @returns {boolean} True if the value is a plain object, false otherwise
   *
   * @example
   * isPlainObject({}) // true
   * isPlainObject(new Object()) // true
   * isPlainObject(Object.create(null)) // true
   * isPlainObject([]) // false
   * isPlainObject(new Date()) // false
   * isPlainObject(null) // false
   * isPlainObject("string") // false
   * isPlainObject(class Person{}) // false
   */
  static isPlainObject(value) {
    // First, check if it's an object and not null
    if(typeof value !== "object" || value === null)
      return false

    // If it has no prototype, it's plain (created with Object.create(null))
    const proto = Object.getPrototypeOf(value)

    if(proto === null)
      return true

    // Check if the prototype chain ends at Object.prototype
    // This handles objects created with {} or new Object()
    let current = proto

    while(Object.getPrototypeOf(current) !== null)
      current = Object.getPrototypeOf(current)

    return proto === current
  }
}
