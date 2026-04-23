// This is legitimately dumb, but, meh, you do what you gotta do,
// I guess. It makes checking easier that they're objects, though.
const MD = Object.seal({
  EXT: Object.freeze({
    "markdown": "markdown",
    "md": "md",
  }),
  MIME: Object.freeze({
    "text/markdown": "text/markdown",
    "application/x-markdown": "application/x-markdown"
  })
})

export default MD
