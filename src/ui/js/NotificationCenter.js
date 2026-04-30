import Base from "./Base.js"
import {Time} from "./vendor/toolkit.esm.js"

const SEVERITY_ICONS = {
  info: "codicon-info",
  warn: "codicon-warning",
  error: "codicon-error"
}

const TOAST_AUTO_DISMISS_MS = 5000

/**
 * Per-window notification center: bell button + badge in the statusbar,
 * a slide-in panel listing all notifications, and bottom-right toasts.
 *
 * Anyone can push by emitting `notify` with `{severity, message}` (or
 * by calling `push()` directly). Info toasts auto-dismiss; warn/error
 * persist until the user closes them. The panel keeps the full history
 * regardless.
 */
export default class NotificationCenter extends Base {
  #items = []
  #nextId = 1

  /**
   * Wires the bell button, panel, and the global `notify` event channel.
   */
  initialize() {
    this.#initialiseBell()
    this.#initialisePanel()

    this.registerOn("notify", evt => {
      const {severity, message} = evt.detail ?? {}
      this.push({severity, message})
    })
  }

  /**
   * Adds a notification, shows a toast for it, and updates the bell badge.
   *
   * @param {{severity?: "info"|"warn"|"error", message: string}} payload - Notification fields.
   * @returns {number?} The created notification id, or null when the message is empty.
   */
  push({severity = "info", message} = {}) {
    if(typeof message !== "string" || message === "")
      return null

    const normalizedSeverity = SEVERITY_ICONS[severity] ? severity : "info"
    const panelHidden = this.#panel.classList.contains("hidden")
    const id = this.#nextId++
    const item = {
      id,
      severity: normalizedSeverity,
      message,
      timestamp: new Date(),
      // Items pushed while the panel is open are seen on arrival, so
      // they don't contribute to the bell badge.
      unread: panelHidden
    }

    this.#items.unshift(item)

    // When the panel is already open the user is looking at the list;
    // a toast on top would just overlap it, and the badge would be
    // immediately stale.
    if(panelHidden) {
      this.#renderBadge()
      this.#renderToast(item)
    } else {
      this.#renderPanelItem(item, {prepend: true})
    }

    this.#updateClearButton()

    return id
  }

  /**
   * Removes a notification from the history and from any visible UI.
   *
   * @param {number} id - Identifier returned by `push()`.
   */
  dismiss(id) {
    const idx = this.#items.findIndex(item => item.id === id)
    if(idx < 0)
      return

    const [removed] = this.#items.splice(idx, 1)

    const listEntry = this.#panel?.querySelector(`.notif-item[data-id="${id}"]`)
    listEntry?.remove()

    const toastNode = this.#toastStack?.querySelector(`.notif-toast[data-id="${id}"]`)
    if(toastNode)
      this.#removeToast(toastNode)

    if(removed?.unread)
      this.#renderBadge()

    this.#updateClearButton()
  }

  /**
   * Empties the notification history and clears the panel list.
   */
  clearAll() {
    this.#items = []
    this.#renderBadge()
    this.#panelList.replaceChildren()
    this.#updateClearButton()
  }

  // -- internals --

  get #bellButton() {
    return document.querySelector("#action-notifications-button")
  }

  get #badge() {
    return this.#bellButton?.querySelector(".notif-badge")
  }

  get #panel() {
    return document.querySelector("#notification-panel")
  }

  get #panelList() {
    return this.#panel?.querySelector(".notif-panel-list")
  }

  get #toastStack() {
    return document.querySelector("#toast-stack")
  }

  #initialiseBell() {
    const button = this.#bellButton
    if(!button)
      return

    this.registerOn("click", () => this.#togglePanel(), button)
  }

  #initialisePanel() {
    const panel = this.#panel
    if(!panel)
      return

    const closeBtn = panel.querySelector(".notif-panel-close")
    const clearBtn = panel.querySelector(".notif-panel-clear")

    this.registerOn("click", () => this.#togglePanel(false), closeBtn)
    this.registerOn("click", () => this.clearAll(), clearBtn)

    this.#updateClearButton()
  }

  #updateClearButton() {
    const clearBtn = this.#panel?.querySelector(".notif-panel-clear")
    if(!clearBtn)
      return

    clearBtn.disabled = this.#items.length === 0
  }

  #togglePanel(force) {
    const panel = this.#panel
    if(!panel)
      return

    const shouldShow = typeof force === "boolean" ? force : panel.classList.contains("hidden")

    if(shouldShow) {
      this.#renderPanelList()
      panel.classList.remove("hidden")
      panel.setAttribute("aria-hidden", "false")
      this.#bellButton?.setAttribute("aria-expanded", "true")
      // Opening the panel acknowledges everything — mark items read,
      // drop the badge, and clear any visible toasts since the panel
      // now shows the same list.
      this.#items.forEach(item => {
        item.unread = false
      })
      this.#renderBadge()
      this.#toastStack?.replaceChildren()
    } else {
      panel.classList.add("hidden")
      panel.setAttribute("aria-hidden", "true")
      this.#bellButton?.setAttribute("aria-expanded", "false")
    }
  }

  #renderBadge() {
    const badge = this.#badge
    const bellIcon = this.#bellButton?.querySelector(".codicon")
    if(!badge || !bellIcon)
      return

    const hasUnread = this.#items.some(item => item.unread)

    if(hasUnread) {
      badge.classList.remove("hidden")
      bellIcon.classList.remove("codicon-bell")
      bellIcon.classList.add("codicon-bell-dot")
    } else {
      badge.classList.add("hidden")
      bellIcon.classList.remove("codicon-bell-dot")
      bellIcon.classList.add("codicon-bell")
    }
  }

  #renderToast(item) {
    const stack = this.#toastStack
    const template = document.querySelector("#notif-toast-template")
    if(!stack || !template)
      return

    const node = template.content.firstElementChild.cloneNode(true)
    node.dataset.severity = item.severity
    node.dataset.id = String(item.id)

    const icon = node.querySelector(".notif-icon")
    icon.classList.add(SEVERITY_ICONS[item.severity])

    node.querySelector(".notif-message").textContent = item.message

    const closeBtn = node.querySelector(".notif-close")

    // Manual X = full dismiss (drops it from the history too). The
    // auto-dismiss timer only hides the toast; the item stays in the
    // panel/history until the user explicitly clears it.
    closeBtn.addEventListener("click", () => this.dismiss(item.id))
    stack.appendChild(node)

    if(item.severity === "info") {
      const pending = Time.after(
        TOAST_AUTO_DISMISS_MS,
        () => this.#removeToast(node)
      )
      this.register(() => Time.cancel(pending))
    }
  }

  #removeToast(node) {
    if(!node || node.classList.contains("leaving"))
      return

    node.classList.add("leaving")
    node.addEventListener("animationend", () => node.remove(), {once: true})
  }

  #renderPanelList() {
    const list = this.#panelList
    if(!list)
      return

    list.replaceChildren()
    for(const item of this.#items)
      this.#renderPanelItem(item)
  }

  #renderPanelItem(item, {prepend = false} = {}) {
    const list = this.#panelList
    const template = document.querySelector("#notif-list-item-template")
    if(!list || !template)
      return

    const node = template.content.firstElementChild.cloneNode(true)
    node.dataset.severity = item.severity
    node.dataset.id = String(item.id)

    const icon = node.querySelector(".notif-icon")
    icon.classList.add(SEVERITY_ICONS[item.severity])

    node.querySelector(".notif-message").textContent = item.message

    const time = node.querySelector(".notif-time")
    time.dateTime = item.timestamp.toISOString()
    time.textContent = item.timestamp.toLocaleTimeString()

    node.querySelector(".notif-close").addEventListener("click", () => this.dismiss(item.id))

    if(prepend)
      list.prepend(node)
    else
      list.appendChild(node)
  }

  /**
   * Tears down the bell/panel listeners and removes any visible UI.
   */
  remove() {
    this.#toastStack?.replaceChildren()
    this.#panelList?.replaceChildren()
    super.remove()
  }
}
