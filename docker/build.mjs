#!/usr/bin/env node
// Cross-platform wrapper around `docker build` + `docker run`.
// Works from Windows (cmd, PowerShell, Git Bash) and Linux/macOS because node
// + docker are available the same way on all of them.
//
//   node docker/build.mjs fedora4
//   node docker/build.mjs debian
//   node docker/build.mjs appimage
//
// Or via npm:
//   npm run docker:fedora
//   npm run docker:debian
//   npm run docker:appimage

import {spawnSync} from "node:child_process"
import {mkdirSync, readdirSync, statSync} from "node:fs"
import {dirname, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = resolve(SCRIPT_DIR, "..")

const targets = new Map([
  ["appimage", "appimage"],
  ["fedora", "fedora"],
  ["debian", "debian"],
])

const target = process.argv[2]
if (!targets.has(target)) {
  console.error("usage: node docker/build.mjs {appimage|fedora|debian}")
  process.exit(2)
}

const image = `mdv-build-${targets.get(target)}:latest`
const dockerfile = resolve(SCRIPT_DIR, `Dockerfile.${target}`)
const outDir = resolve(PROJECT_DIR, "dist", target)
mkdirSync(outDir, {recursive: true})

// Docker Desktop on Windows accepts either forward- or back-slash host paths
// in -v mounts; resolve() gives the native form and Docker handles the rest.
const mounts = [
  ["-v", `${PROJECT_DIR}:/build`],
  ["-v", `mdv-${target}-target:/build/src-tauri/target`],
  ["-v", `mdv-${target}-node_modules:/build/node_modules`],
  ["-v", `mdv-${target}-cargo-registry:/opt/cargo/registry`],
].flat()

// Run as the host user on POSIX so bind-mounted outputs (dist/, target/)
// aren't root-owned. On Windows, Docker Desktop maps uids differently and
// process.getuid doesn't exist, so skip.
const userArgs = process.platform === "win32"
  ? []
  : ["--user", `${process.getuid()}:${process.getgid()}`,
     "-e", "HOME=/tmp"]

function run(cmd, args, label) {
  console.log(`==> ${label}`)
  const result = spawnSync(cmd, args, {stdio: "inherit", shell: false})
  if (result.error) {
    console.error(`failed to spawn ${cmd}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run("docker", ["build", "-f", dockerfile, "-t", image, PROJECT_DIR],
    `building image ${image}`)
run("docker", ["run", "--rm", ...userArgs, ...mounts, image],
    `running ${image}`)

console.log(`==> done. Artefacts in dist/${target}/`)
for (const entry of readdirSync(outDir)) {
  const p = resolve(outDir, entry)
  const size = statSync(p).size
  console.log(`  ${entry}  (${(size / 1024 / 1024).toFixed(1)} MiB)`)
}
