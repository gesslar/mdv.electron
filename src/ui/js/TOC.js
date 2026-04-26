import Base from "./Base.js"
import {HTML, Notify} from "./vendor/toolkit.esm.js"

/**
 * Builds and injects a table of contents derived from headings collected by Marked.
 * Each instance is identified by a random id to avoid collisions across renders.
 */
export default class TOC extends Base {
  static #contentPath = "toc.html"
  #tocId
  #tocAnchors = []

  /**
   * Construct a TOC object with the Markdown document object.
   *
   * @param {HTMLElement} toc - Prebuilt TOC root element to attach and manage.
   */
  constructor(toc) {
    super()

    this.#tocId = `MDV-TOC-${crypto.randomUUID()}`
    toc.id = this.#tocId

    this.element = toc
    this.#tocAnchors = toc.querySelectorAll(".toc-link")
    this.#wireScrollButtons(toc)
  }

  /**
   * Wires the sticky scroll-to-top / scroll-to-bottom buttons to the stage.
   *
   * @param {HTMLElement} container - TOC container holding the buttons.
   * @private
   */
  #wireScrollButtons(container) {
    const stage = document.querySelector("#stage")
    if(!stage)
      return

    const top = container.querySelector("[data-scroll='top']")
    const bottom = container.querySelector("[data-scroll='bottom']")

    if(top)
      this.registerOn("click", () => stage.scrollTo({top: 0, behavior: "smooth"}), top)

    if(bottom)
      this.registerOn("click", () => stage.scrollTo({top: stage.scrollHeight, behavior: "smooth"}), bottom)
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
    const container = await this.#createToc(mdElement, headingsMetadata)
    const instance = new TOC(container)

    return instance
  }

  /**
   * Builds the TOC DOM from the template.
   *
   * @async
   * @param {HTMLDivElement} mdElement - The Markdown document instance.
   * @param {Array<{id: string, text: string, depth: number}>} headingsMetadata - Heading metadata from markdown parsing
   * @returns {Promise<HTMLElement>} TOC container (with header/list/footer) ready for insertion into the DOM.
   * @private
   */
  static async #createToc(mdElement, headingsMetadata) {
    const tocHtml = await HTML.loadHTML(this.#contentPath)

    /** @type {HTMLDivElement} */
    const tocElement = document.createElement("div")

    HTML.setHTMLContent(tocElement, tocHtml)

    /** @type {HTMLElement} */
    const container = tocElement.querySelector("#toc-mdv-container")
    container.removeAttribute("id")

    /** @type {HTMLTemplateElement} */
    const template = tocElement.querySelector("#toc-item-template")

    /** @type {HTMLUListElement} */
    const tocRoot = tocElement.querySelector("#toc-mdv")

    headingsMetadata.forEach(headingMeta => {
      const title = headingMeta.text
      const depth = headingMeta.depth
      const id = headingMeta.id

      /** @type {HTMLHeadingElement} */
      const headingInDoc = mdElement.querySelector(`#${CSS.escape(id)}`)

      if(!headingInDoc)
        throw new Error(`What? Can't find heading with id="${id}"`)

      headingInDoc.setAttribute("headingDepth", depth)

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

    return container
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
