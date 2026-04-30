/**
 * Encodes a string for safe use as text inside an HTML element.
 *
 * @param {unknown} value - Raw value; coerced to string.
 * @returns {string} Encoded value.
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c]))
}

/**
 * Encodes a string for safe use inside a double- or single-quoted HTML
 * attribute value.
 *
 * @param {unknown} value - Raw value; coerced to string.
 * @returns {string} Encoded value.
 */
export function escapeAttr(value) {
  return String(value).replace(/["'&<>]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c]))
}
