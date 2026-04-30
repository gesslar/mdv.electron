// ld-select.js — light-DOM custom element replacement for <select>.
//
// Usage:
//   <ld-select value="foo">
//     <option value="foo">Foo</option>
//     <option value="bar">Bar</option>
//   </ld-select>
//
// Mirrors the bits of the native <select> API that we actually use:
//   .value (get/set — setter does NOT fire change, matches native)
//   .selectedIndex (get/set)
//   "change" event on user-driven selection

import {escapeAttr, escapeHtml} from "./HtmlEscape.js"

let instanceCounter = 0

export default class LDSelect extends HTMLElement {
  #options = []
  #value = ""
  #button
  #values
  #listbox
  #activeIndex = -1
  #typeaheadBuffer = ""
  #typeaheadTimer = null
  #id

  connectedCallback() {
    if(this.#button)
      return

    this.#id = `ld-select-${++instanceCounter}`
    this.#harvestOptions()
    this.#render()
    this.#bindEvents()
    this.#syncAria()
    this.#syncInitialValue()
  }

  disconnectedCallback() {
    clearTimeout(this.#typeaheadTimer)
  }

  #harvestOptions() {
    const optionEls = [...this.querySelectorAll(":scope > option")]
    this.#options = optionEls.map(o => ({
      value: o.value,
      label: o.textContent.trim(),
      disabled: o.disabled,
    }))
    optionEls.forEach(o => o.remove())
  }

  #render() {
    const listboxId = `${this.#id}-list`
    const anchorName = `--${this.#id}-anchor`

    this.innerHTML = `
      <button
        type="button"
        class="ld-select__button"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="${listboxId}"
        popovertarget="${listboxId}"
        style="anchor-name: ${anchorName}"
      ><span class="ld-select__values"></span><span class="ld-select__chevron" aria-hidden="true"><svg viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <ul
        id="${listboxId}"
        class="ld-select__listbox"
        role="listbox"
        popover="auto"
        tabindex="-1"
        style="position-anchor: ${anchorName}"
      ></ul>
    `

    this.#button = this.querySelector(":scope > .ld-select__button")
    this.#values = this.#button.querySelector(".ld-select__values")
    this.#listbox = this.querySelector(":scope > .ld-select__listbox")

    this.#renderValues()
    this.#renderOptions()
  }

  /**
   * Renders one span per option stacked in a single grid cell. Only the
   * current value is `visibility: visible`; the rest contribute to intrinsic
   * width so the button sizes to the longest option.
   */
  #renderValues() {
    this.#values.innerHTML = this.#options.map(opt => `
      <span
        class="ld-select__value"
        data-value="${escapeAttr(opt.value)}"
      >${escapeHtml(opt.label)}</span>
    `).join("")
  }

  #renderOptions() {
    this.#listbox.innerHTML = this.#options.map((opt, i) => `
      <li
        role="option"
        id="${this.#id}-opt-${i}"
        class="ld-select__option"
        data-value="${escapeAttr(opt.value)}"
        aria-selected="false"
        ${opt.disabled ? "aria-disabled=\"true\"" : ""}
      >${escapeHtml(opt.label)}</li>
    `).join("")
  }

  #bindEvents() {
    this.#button.addEventListener("keydown", e => this.#onButtonKey(e))
    this.#listbox.addEventListener("click", e => this.#onOptionClick(e))
    this.#listbox.addEventListener("keydown", e => this.#onListboxKey(e))
    this.#listbox.addEventListener("toggle", e => this.#onListboxToggle(e))
  }

  #syncAria() {
    const label = this.getAttribute("aria-label")
    const labelledby = this.getAttribute("aria-labelledby")

    if(label)
      this.#button.setAttribute("aria-label", label)

    if(labelledby)
      this.#button.setAttribute("aria-labelledby", labelledby)
  }

  #onButtonKey(e) {
    if(["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault()
      this.#open()
    }
  }

  #onListboxToggle(e) {
    const open = e.newState === "open"
    this.#button.setAttribute("aria-expanded", open ? "true" : "false")

    if(open) {
      const sel = this.#options.findIndex(o => o.value === this.#value)
      this.#setActive(sel >= 0 ? sel : this.#firstEnabled())
      this.#listbox.focus()
    } else {
      this.#activeIndex = -1
      this.#listbox.removeAttribute("aria-activedescendant")
    }
  }

  #onListboxKey(e) {
    switch(e.key) {
      case "ArrowDown":
        e.preventDefault()
        this.#moveActive(1)
        break
      case "ArrowUp":
        e.preventDefault()
        this.#moveActive(-1)
        break
      case "Home":
        e.preventDefault()
        this.#setActive(this.#firstEnabled())
        break
      case "End":
        e.preventDefault()
        this.#setActive(this.#lastEnabled())
        break
      case "Enter":
      case " ":
        e.preventDefault()
        this.#commitActive()
        break
      case "Escape":
        e.preventDefault()
        this.#close()
        break
      case "Tab":
        this.#close()
        break
      default:
        if(e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
          this.#typeahead(e.key)
    }
  }

  #onOptionClick(e) {
    const li = e.target.closest("[role=option]")

    if(!li || li.getAttribute("aria-disabled") === "true")
      return

    this.#commit(li.dataset.value)
  }

  #open() {
    this.#listbox.showPopover()
  }

  #close() {
    if(this.#listbox.matches(":popover-open"))
      this.#listbox.hidePopover()

    this.#button.focus()
  }

  #firstEnabled() {
    return this.#options.findIndex(o => !o.disabled)
  }

  #lastEnabled() {
    for(let i = this.#options.length - 1; i >= 0; i--) {
      if(!this.#options[i].disabled)
        return i
    }

    return -1
  }

  #moveActive(delta) {
    const n = this.#options.length
    if(n === 0)
      return

    let i = this.#activeIndex

    for(let step = 0; step < n; step++) {
      i += delta

      if(i < 0)
        i = n - 1
      else if(i >= n)
        i = 0

      if(!this.#options[i].disabled) {
        this.#setActive(i)

        return
      }
    }
  }

  #setActive(index) {
    const items = this.#listbox.querySelectorAll("[role=option]")

    items.forEach((el, i) => {
      el.classList.toggle("is-active", i === index)
    })

    this.#activeIndex = index

    if(index >= 0) {
      this.#listbox.setAttribute("aria-activedescendant", items[index].id)
      items[index].scrollIntoView({block: "nearest"})
    }
  }

  #commitActive() {
    if(this.#activeIndex < 0)
      return

    const opt = this.#options[this.#activeIndex]

    if(opt.disabled)
      return

    this.#commit(opt.value)
  }

  #commit(val) {
    this.#selectValue(val, true)
    this.#close()
  }

  #typeahead(ch) {
    this.#typeaheadBuffer += ch.toLowerCase()
    clearTimeout(this.#typeaheadTimer)
    this.#typeaheadTimer = setTimeout(() => this.#typeaheadBuffer = "", 500)

    const start = Math.max(this.#activeIndex, 0)

    for(let i = 1; i <= this.#options.length; i++) {
      const idx = (start + i) % this.#options.length
      const opt = this.#options[idx]

      if(!opt.disabled
         && opt.label.toLowerCase().startsWith(this.#typeaheadBuffer)
      ) {
        this.#setActive(idx)

        return
      }
    }
  }

  #selectValue(val, fireChange) {
    const opt = this.#options.find(o => o.value === val)

    if(!opt)
      return

    const changed = val !== this.#value

    this.#value = val
    this.setAttribute("value", val)

    this.#values.querySelectorAll(".ld-select__value").forEach(v => {
      v.classList.toggle("is-current", v.dataset.value === val)
    })

    this.#listbox.querySelectorAll("[role=option]").forEach(li => {
      li.setAttribute("aria-selected", li.dataset.value === val ? "true" : "false")
    })

    if(changed && fireChange)
      this.dispatchEvent(new Event("change", {bubbles: true}))
  }

  #syncInitialValue() {
    const attrVal = this.getAttribute("value")
    const start = attrVal !== null
      ? attrVal
      : (this.#options[0]?.value ?? "")

    if(start !== "")
      this.#selectValue(start, false)
  }

  get value() {
    return this.#value
  }

  set value(v) {
    this.#selectValue(v, false)
  }

  get selectedIndex() {
    return this.#options.findIndex(o => o.value === this.#value)
  }

  set selectedIndex(i) {
    const opt = this.#options[i]

    if(opt)
      this.#selectValue(opt.value, false)
  }

  static get observedAttributes() {
    return ["value"]
  }

  attributeChangedCallback(name, _old, val) {
    if(name === "value" && this.#button && val !== this.#value)
      this.#selectValue(val, false)
  }
}

customElements.define("ld-select", LDSelect)
