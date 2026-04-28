#!/usr/bin/env node

/**
 * Removes all files from a target directory. Intended as a pre-build  step so
 * publish commands that glob the directory only pick up the freshly built
 * package.
 *
 * Usage:
 *   node scripts/clean-out.mjs
 */

import {readdir, rm, mkdir} from "node:fs/promises"
import {join, resolve} from "node:path"

const dirName = "out"
const target = resolve(dirName)

const exists = async path => {
  try {
    await readdir(path)
    return true
  } catch(e) {
    if(e.code === "ENOENT")
      return false
    throw e
  }
}

const rmdir = async(dir, depth=0) => {
  const indent = "  ".repeat(depth)
  const entries = await readdir(dir, {withFileTypes: true})

  for(const entry of entries) {
    const entryPath = join(dir, entry.name)

    if(entry.isDirectory()) {
      await rmdir(entryPath, depth + 1)
    } else {
      await rm(entryPath)
    }
  }

  await rm(dir, {recursive: true, force: true})
}

try {
  if(await exists(target))
    await rmdir(target)

  await mkdir(target, {recursive: true})
} catch(e) {
  console.error(e.message)
  process.exit(1)
}
