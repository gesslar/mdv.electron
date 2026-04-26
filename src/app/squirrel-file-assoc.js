import {spawnSync} from "node:child_process"

const PROGID = "MDV.MarkdownFile"
const FRIENDLY_NAME = "Markdown Document"
const APP_KEY = "mdv.exe"
const EXTENSIONS = [".md", ".markdown", ".mkd"]

const reg = (...args) =>
  spawnSync("reg.exe", args, {windowsHide: true, stdio: "ignore"})

const installFileAssoc = () => {
  // Versioned exe path; refreshed on each --squirrel-updated event so the
  // registry tracks the current install. There's a small race window during
  // update when the old path is briefly stale — acceptable for v1; the
  // alternative is Update.exe --processStart indirection.
  const exePath = process.execPath
  const openCommand = `"${exePath}" "%1"`

  reg("add", `HKCU\\Software\\Classes\\${PROGID}`,
    "/ve", "/d", FRIENDLY_NAME, "/f")
  reg("add", `HKCU\\Software\\Classes\\${PROGID}\\DefaultIcon`,
    "/ve", "/d", `${exePath},0`, "/f")
  reg("add", `HKCU\\Software\\Classes\\${PROGID}\\shell\\open\\command`,
    "/ve", "/d", openCommand, "/f")

  for(const ext of EXTENSIONS)
    reg("add", `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`,
      "/v", PROGID, "/t", "REG_SZ", "/d", "", "/f")

  reg("add", `HKCU\\Software\\Classes\\Applications\\${APP_KEY}\\shell\\open\\command`,
    "/ve", "/d", openCommand, "/f")

  for(const ext of EXTENSIONS)
    reg("add", `HKCU\\Software\\Classes\\Applications\\${APP_KEY}\\SupportedTypes`,
      "/v", ext, "/t", "REG_SZ", "/d", "", "/f")
}

const uninstallFileAssoc = () => {
  reg("delete", `HKCU\\Software\\Classes\\${PROGID}`, "/f")

  // Only remove our value from each extension's OpenWithProgids list — leave
  // entries from other apps alone.
  for(const ext of EXTENSIONS)
    reg("delete", `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`,
      "/v", PROGID, "/f")

  reg("delete", `HKCU\\Software\\Classes\\Applications\\${APP_KEY}`, "/f")
}

export const handleSquirrelFileAssoc = () => {
  if(process.platform !== "win32")
    return false

  switch(process.argv[1]) {
    case "--squirrel-install":
    case "--squirrel-updated":
      installFileAssoc()

      return true
    case "--squirrel-uninstall":
      uninstallFileAssoc()

      return true
    default:
      return false
  }
}
