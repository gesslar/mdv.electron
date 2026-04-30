import Base from "./Base.js"

/**
 * Builds and injects a table of contents derived from headings collected by Marked.
 * Each instance is identified by a random id to avoid collisions across renders.
 */
export default class TOC extends Base {
  #tocId
  #select
  #container
  #headings = []
  #rafId = null

  /**
   * Construct a TOC against the rendered markdown element and its heading
   * metadata. The DOM is built synchronously inside `#new` and wired up here.
   *
   * @param {HTMLElement} mdElement - The rendered markdown root element.
   * @param {Array<{id: string, text: string, depth: number}>} headingsMetadata - Heading metadata from markdown parsing.
   */
  constructor(mdElement, headingsMetadata) {
    super()

    const {container, headings} = TOC.#new(mdElement, headingsMetadata)

    this.#tocId = `MDV-TOC-${crypto.randomUUID()}`
    container.id = this.#tocId

    this.element = container
    this.#container = container
    this.#select = container.querySelector("ld-select")
    this.#headings = headings

    this.#wireFabToggle(container)
    this.#wireScrollButtons(container)
    this.#wireSelectJump()
    this.#wireScrollSpy()
  }

  /**
   * Wires the show/hide FAB toggle. The container's `data-state` flips between
   * `collapsed` and `expanded` so CSS can drive the visual transition.
   *
   * @param {HTMLElement} container - TOC container.
   * @private
   */
  #wireFabToggle(container) {
    const showBtn = container.querySelector("[data-toc-action='show']")
    const hideBtn = container.querySelector("[data-toc-action='hide']")

    if(showBtn)
      this.registerOn("click", () => this.#setState("expanded"), showBtn)

    if(hideBtn)
      this.registerOn("click", () => this.#setState("collapsed"), hideBtn)
  }

  /**
   * Updates the container state and reflects it on the show button's
   * aria-expanded for assistive tech.
   *
   * @param {"collapsed"|"expanded"} state - Target state.
   * @private
   */
  #setState(state) {
    this.#container.dataset.state = state

    const showBtn = this.#container.querySelector("[data-toc-action='show']")
    if(showBtn)
      showBtn.setAttribute("aria-expanded", state === "expanded" ? "true" : "false")
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
   * Wires the ld-select change handler so picking a heading scrolls the stage
   * to that anchor. Option values are `#heading-id`, ready for querySelector.
   *
   * @private
   */
  #wireSelectJump() {
    if(!this.#select)
      return

    this.registerOn("change", () => {
      const href = this.#select.value
      if(!href)
        return

      const target = document.querySelector(href)
      if(target)
        target.scrollIntoView({behavior: "smooth", block: "start"})
    }, this.#select)
  }

  /**
   * Tracks the topmost heading whose top has crossed the stage's top edge as
   * the user scrolls and reflects it in the select via the no-fire value
   * setter (so we don't loop back into a scroll).
   *
   * @private
   */
  #wireScrollSpy() {
    const stage = document.querySelector("#stage")
    if(!stage || !this.#select || this.#headings.length === 0)
      return

    const onScroll = () => {
      if(this.#rafId !== null)
        return

      this.#rafId = requestAnimationFrame(() => {
        this.#rafId = null
        this.#updateActiveHeading(stage)
      })
    }

    this.registerOn("scroll", onScroll, stage, {passive: true})
    this.register(() => {
      if(this.#rafId !== null) {
        cancelAnimationFrame(this.#rafId)
        this.#rafId = null
      }
    })

    requestAnimationFrame(() => this.#updateActiveHeading(stage))
  }

  /**
   * Finds the last heading whose top has crossed the stage's top edge and
   * pushes its id into the select. Falls back to the first heading when
   * scrolled above all of them.
   *
   * @param {HTMLElement} stage - The scroll container.
   * @private
   */
  #updateActiveHeading(stage) {
    if(!this.#select)
      return

    const trigger = stage.getBoundingClientRect().top + 1
    let active = null

    for(const heading of this.#headings) {
      if(heading.getBoundingClientRect().top <= trigger)
        active = heading
      else
        break
    }

    active = active ?? this.#headings[0]
    if(!active)
      return

    const target = `#${active.id}`
    if(this.#select.value !== target)
      this.#select.value = target
  }

  /**
   * Builds the TOC DOM from the template and collects the heading elements
   * in document order so the scrollspy can iterate them later.
   *
   * @param {HTMLElement} mdElement - The rendered markdown root element.
   * @param {Array<{id: string, text: string, depth: number}>} headingsMetadata - Heading metadata from markdown parsing.
   * @returns {{container: HTMLElement, headings: HTMLElement[]}} TOC container and ordered heading elements.
   * @private
   */
  static #new(mdElement, headingsMetadata) {
    const tocTemplate = document.querySelector("#toc-template")
    const tocClone = tocTemplate.content.cloneNode(true)
    const container = tocClone.querySelector("#toc-mdv-container")
    container.removeAttribute("id")

    /** @type {HTMLElement} */
    const tocRoot = container.querySelector("#toc-mdv")

    const headings = []

    headingsMetadata.forEach(({id, text, depth}) => {
      /** @type {HTMLHeadingElement} */
      const headingInDoc = mdElement.querySelector(`#${CSS.escape(id)}`)

      if(!headingInDoc)
        throw new Error(`What? Can't find heading with id="${id}"`)

      /** @type {HTMLOptionElement} */
      const option = document.createElement("option")
      option.value = `#${id}`
      option.textContent = text
      option.classList.add(`toc-depth-${depth}`)

      tocRoot.appendChild(option)
      headings.push(headingInDoc)
    })

    return {container, headings}
  }
}
