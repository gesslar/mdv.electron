import hljs from "./vendor/highlight.esm.js"
import {markedHighlight} from "./vendor/marked-highlight.esm.js"
import {HTML, Notify} from "./vendor/toolkit.esm.js"
import TOC from "./TOC.js"
import Base from "./Base.js"

/**
 * Configures marked/hljs and tracks heading metadata during parsing.
 * Designed to be initialized once at startup; headings collected via
 * the token walker are later consumed by the TOC builder.
 */
export class Markdown extends Base {
  #raw
  #parsed
  #marked

  /** @type {TOC} */
  #toc

  /**
   * Creates a Markdown renderer with optional initial content.
   *
   * @param {string} [content] - Markdown source to render.
   */
  constructor(content) {
    super()

    // Don't sanitize markdown input - it's not HTML yet
    // Sanitization should happen on the HTML output after rendering, not on markdown source
    this.#raw = content ?? ""
  }

  /**
   * Parses the current markdown source and emits a render event.
   *
   * @param {boolean} [hotReload=false] - Whether this is a hot reload.
   * @returns {Promise<void>} Resolves when rendering completes.
   */
  async render(content, hotReload = false) {
    this.#headings = []

    const marked = await this.#initializeMarked()
    const parsed = await marked.parse(content)
    const element = document.createElement("div")

    HTML.setHTMLContent(element, parsed)

    this.#applyDocumentTitle(element)

    // Inject copy buttons into code blocks
    this.#injectCopyButtons(element)

    if(this.headings.length > 0)
      this.#toc = await TOC.new(element, this.headings)

    this.#parsed = parsed
    this.element = element

    Notify.emit("markdown-rendered", {markdown: this, toc: this.#toc, hotReload})
  }

  /**
   * Returns the Table of Contents (TOC) generated from the most recent render, if available.
   *
   * @returns {TOC?} The TOC instance or undefined if not generated.
   */
  get toc() {
    return this.#toc
  }

  /**
   * Last rendered HTML output.
   *
   * @returns {string} Rendered HTML from the last parse.
   */
  get text() {
    return this.#parsed
  }

  /** Collected heading metadata from the most recent render. */
  #headings = []
  /**
   * Exposes collected headings for TOC building.
   *
   * @returns {Array<{depth: number, raw: string, text: string, id: string}>} Headings captured during the last render.
   */
  get headings() {
    return this.#headings
  }

  /**
   * Initializes marked with highlighting and custom renderers for links/headings.
   * Must be called before rendering markdown.
   *
   * @returns {Promise<boolean>} True when initialization completes; false when marked is unavailable.
   */
  async #initializeMarked() {
    const module = await import("./vendor/marked.esm.js")
    const {Marked} = module
    const marked = new Marked(
      markedHighlight({
        async: true,
        emptyLangClass: "hljs",
        langPrefix: "hljs language-",
        highlight(code, lang) {
          // Determine the language; default to 'plaintext' if not found
          const language = hljs.getLanguage(lang) ? lang : "plaintext"

          return hljs.highlight(code, {language}).value
        }
      })
    )

    // Custom link renderer with external link icons
    marked.use({
      gfm: true,
      async: true,
      renderer: {
        link: arg => this.#renderLink(arg),
        heading: arg => this.#renderHeadingAnchor(arg)
      },
      walkTokens: async arg => await this.#processHeading(arg)
    })

    return marked

    // if(typeof marked === "undefined") {
    //   error("marked.js not loaded. Cannot render markdown.")

    //   return false
    // }

    // // Configure marked to auto-highlight
    // marked.setOptions({
    //   highlight(code, language) {
    //     if(language && hljs.getLanguage(language))
    //       return hljs.highlight(code, {language}).value

    //     return hljs.highlightAuto(code).value
    //   },
    // })

    // // Custom link renderer with external link icons
    // marked.use({
    //   renderer: {
    //     link: arg => this.#renderLink(arg),
    //     heading: arg => this.#renderHeadingAnchor(arg)
    //   },
    // })
    // marked.use({
    //   walkTokens: arg => this.#processHeading(arg)
    // })

    // return true
  }

  /**
   * Sets the window title from the document's first H1, and removes that H1
   * inline when nothing precedes it (the title bar already shows it).
   *
   * @param {Element} element - The rendered markdown element.
   * @private
   */
  #applyDocumentTitle(element) {
    const firstH1 = element.querySelector("h1")
    const title = firstH1?.textContent?.trim() || null

    if(title)
      Notify.emit("title-change", {title})

    if(element.firstElementChild !== firstH1)
      return

    const id = firstH1.id
    firstH1.remove()

    const idx = this.#headings.findIndex(h => h.id === id)
    if(idx !== -1)
      this.#headings.splice(idx, 1)
  }

  /**
   * Injects copy buttons into all code blocks in the rendered element.
   *
   * @param {Element} element - The rendered markdown element.
   * @private
   */
  #injectCopyButtons(element) {
    const codeBlocks = element.querySelectorAll("pre:has(> code)")

    codeBlocks.forEach(pre => {
      const code = pre.querySelector("code")
      if(!code)
        return

      const button = document.createElement("button")
      button.className = "code-copy-btn"
      button.setAttribute("aria-label", "Copy code to clipboard")
      button.innerHTML = `<i class="codicon codicon-copy" aria-hidden="true"></i>`

      // Store the text content for copying
      button.addEventListener("click", async e => {
        e.preventDefault()
        const textToCopy = code.textContent || ""

        try {
          await navigator.clipboard.writeText(textToCopy)

          // Visual feedback on the code block
          const originalBg = pre.style.backgroundColor
          const originalOutline = pre.style.outline
          const originalShadow = pre.style.boxShadow

          // Flash bright pink
          pre.style.backgroundColor = "color-mix(in oklab, var(--color-pink-400) 35%, transparent)"
          pre.style.outline = "2px solid var(--color-pink-400)"
          pre.style.boxShadow = "0 0 16px color-mix(in oklab, var(--color-pink-500) 40%, transparent)"

          setTimeout(() => {
            // Back to original with transition
            pre.style.transition = "all 50ms ease-out"
            pre.style.backgroundColor = originalBg
            pre.style.outline = originalOutline
            pre.style.boxShadow = originalShadow

            setTimeout(() => {
              pre.style.transition = ""
            }, 100)
          }, 100)

          button.classList.add("copied")
          setTimeout(() => {
            button.classList.remove("copied")
          }, 500)
        } catch(err) {
          console.error("Failed to copy code:", err)
        }
      })

      pre.appendChild(button)
    })
  }

  /**
   * Renders external links with a trailing icon and safety attributes.
   * Internal links (starting with #) are rendered as normal links without the icon.
   *
   * @param {{text: string, href: string, title?: string}} data - Link metadata supplied by marked.
   * @returns {string} Rendered HTML for the link with icon.
   * @private
   */
  #renderLink(data) {
    const {text,href,title} = data
    const isInternal = href.startsWith("#")

    if(isInternal) {
      // Normalize the anchor href to match generated heading IDs
      // If the ID starts with a digit or dash, it gets prefixed with '_'
      const anchorId = href.slice(1) // Remove the '#'
      const normalizedId = this.#generateAnchorId(anchorId)
      const normalizedHref = `#${normalizedId}`

      return `<a href="${normalizedHref}" title="${title ?? ""}">${text}</a>`
    }

    return `<span>`+
        `<a `+
          `href="${href}" `+
          `target="_blank" `+
          `rel="noopener noreferrer" `+
          `title="${title ?? ""}"`+
        `>`+
          `${text}`+
        `</a>` +
        `<i class="external-link-icon" aria-hidden="true"></i>`+
      `</span>`
  }

  /**
   * Produces heading HTML with deterministic ids derived from the text.
   *
   * @param {{text: string, depth: number}} data - Heading token data.
   * @returns {string} Rendered heading HTML with id attribute.
   * @private
   */
  #renderHeadingAnchor({text, depth}) {
    const id = this.#generateAnchorId(text)
    const headingAnchor = `<h${depth} id="${id}">${text}</h${depth}>`

    return headingAnchor
  }

  /**
   * Collects heading data during parsing for later TOC construction.
   *
   * @param {{type: string, depth?: number, raw?: string, text?: string}} data - Token data emitted by marked.
   * @private
   */
  async #processHeading({type, raw, text, depth}) {
    if(type === "heading") {
      const id = this.#generateAnchorId(text)

      this.#headings.push({depth,raw,text,id})
    }
  }

  /**
   * Normalizes heading text into a URL-safe anchor id.
   *
   * @param {string} title - Raw heading text.
   * @returns {string} Slugified id suitable for use in the DOM.
   * @private
   */
  #generateAnchorId(title) {
    const newTitle = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")

    return (/^[\d-]/.test(newTitle))
      ? `_${newTitle}`
      : newTitle
  }

  /**
   * Removes the associated TOC and delegates to parent cleanup.
   */
  remove() {
    this.#toc?.remove()
    super.remove()
  }
}
