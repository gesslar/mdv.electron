/** @type {import("@gesslar/uglier").UglierOptions} */

import uglify from "@gesslar/uglier"

export default [
  {ignores: ["**/vendor/**"]},
...uglify({
    with: [
      "lints-js",
      "lints-jsdoc",
      "node",
      "web",
    ],
  })
]
