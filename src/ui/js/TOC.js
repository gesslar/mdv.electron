import Base from "./Base.js"
import Notify from "./Notify.js"
import Util from "./Util.js"

/**
 * Builds and injects a table of contents derived from headings collected by Marked.
 * Each instance is identified by a random id to avoid collisions across renders.
 */
export default class TOC extends Base {
  static #contentPath = "html/toc.html"
  #tocId
  #tocAnchors = []

  /**
   * Construct a TOC object with the Markdown document object.
   *
   * @param {HTMLUListElement} toc - Prebuilt TOC root element to attach and manage.
   */
  constructor(toc) {
    super()

    this.#tocId = `MDV-TOC-${crypto.randomUUID()}`
    toc.id = this.#tocId

    this.element = toc
    this.#tocAnchors = toc.querySelectorAll("a")
  }

  /**
   * Exposes the anchors collected from the rendered TOC element.
   *
   * @returns {NodeList} All TOC anchors currently managed.
   */
  get anchors() {
    return this.#tocAnchors
  }

  /**
   * Generate a new TOC instance with all of the whistles.
   *
   * @param {HTMLElement} mdElement - The markdown document
   * @param {Array<{id: string, text: string, depth: number}>} headingsMetadata - Heading metadata from markdown parsing
   * @returns {Promise<TOC>} An instance of TOC
   */
  static async new(mdElement, headingsMetadata) {
    const element = document.createElement("div")
    const toc = await this.#createToc(mdElement, headingsMetadata)
    element.appendChild(toc)
    const instance = new TOC(element)

    return instance
  }

  /**
   * Builds the TOC DOM from the template.
   *
   * @async
   * @param {HTMLDivElement} mdElement - The Markdown document instance.
   * @param {Array<{id: string, text: string, depth: number}>} headingsMetadata - Heading metadata from markdown parsing
   * @returns {Promise<HTMLUListElement>} Root TOC element ready for insertion into the DOM.
   * @private
   */
  static async #createToc(mdElement, headingsMetadata) {
    const tocHtml = await Util.loadHTML(this.#contentPath)

    /** @type {HTMLDivElement} */
    const tocElement = document.createElement("div")

    Util.setHTMLContent(tocElement, tocHtml)

    /** @type {HTMLTemplateElement} */
    const template = tocElement.querySelector("#toc-item-template")
    /** @type {HTMLUListElement} */
    const tocRoot = tocElement.querySelector("#toc-mdv")

    headingsMetadata.forEach(headingMeta => {
      const title = headingMeta.text
      const depth = headingMeta.depth
      const id = headingMeta.id

      /** @type {HTMLHeadingElement} */
      const headingInDoc = mdElement.querySelector(`[toc-reference]`)

      if(!headingInDoc)
        throw new Error(`What? Can't find an item with the toc-reference attribute`)

      headingInDoc.id = id
      headingInDoc.setAttribute("headingDepth", depth)
      headingInDoc.removeAttribute("toc-reference")

      /** @type {Node} */
      const fragment = template.content.cloneNode(true)
      const headingClass = `toc-depth-${depth}`

      /** @type {HTMLLIElement} */
      const item = fragment.querySelector(".toc-item")

      item.classList.add(headingClass)

      /** @type {HTMLAnchorElement} */
      const link = item.querySelector(".toc-link")

      link.text = title.replace(/^<p>|<\/p>$/g, "")
      link.href = `#${id}`
      link.title = title
      link["aria-label"] = link.title

      headingInDoc.tocItem = item
      item.headingInDoc = headingInDoc

      tocRoot.appendChild(fragment)
    })

    return tocRoot
    // const main = document.querySelector("main")
    // main.prepend(toc)
    // container.prepend(toc)
  }

  /**
   * Emits a teardown event and delegates cleanup to the Base implementation.
   *
   * @returns {void}
   */
  remove() {
    Notify.emit("toc-removed", this.#tocAnchors)
    super.remove()
  }
}
