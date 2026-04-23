/**
 * Joins argument payloads into a loggable string, stringifying non-string items.
 *
 * @param {Array<unknown>} args - Values to be logged.
 * @returns {string} Concatenated log message.
 * @private
 */
function formatLogPayload(args) {
  return args
    .map(arg => typeof arg === "string" ? arg : JSON.stringify(arg))
    .join(" ")
}

/**
 * Logs through console and forwards to the main process when the bridge is available.
 *
 * @param {"trace"|"debug"|"info"|"warn"|"error"} method - Log severity.
 * @param {...unknown} args - Values to log.
 * @returns {void}
 * @private
 */
function logThroughConsole(method, ...args) {
  const consoleMethod = console?.[method] || console.log
  consoleMethod("[mdv]", ...args)

  try {
    window.mdv?.log?.[method]?.(formatLogPayload(args))
  } catch {
    // Ignore logging errors so we never crash the UI
  }
}

/**
 * Logs a warning message to the console and main process logger.
 *
 * @param {...unknown} args - Arguments to log as a warning.
 * @returns {void}
 */
function warn(...args) {
  logThroughConsole("warn", ...args)
}

/**
 * Logs a debug message to the console and main process logger.
 *
 * @param {...unknown} args - Arguments to log as debug information.
 * @returns {void}
 */
function debug(...args) {
  logThroughConsole("debug", ...args)
}

/**
 * Logs a trace message to the console and main process logger.
 *
 * @param {...unknown} args - Arguments to log as trace information.
 * @returns {void}
 */
function trace(...args) {
  logThroughConsole("trace", ...args)
}

/**
 * Logs an info message to the console and main process logger.
 *
 * @param {...unknown} args - Arguments to log as informational messages.
 * @returns {void}
 */
function info(...args) {
  logThroughConsole("info", ...args)
}

/**
 * Logs an error message to the console and main process logger.
 *
 * @param {...unknown} args - Arguments to log as errors.
 * @returns {void}
 */
function error(...args) {
  logThroughConsole("error", ...args)
}

export {debug, error, info, trace, warn}
