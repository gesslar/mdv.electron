#!/usr/bin/env node

/**
 * Builds flatpak bundles for mdv. Chains:
 *   1. electron-builder --linux --dir for each requested arch
 *   2. for each arch: stage the unpacked tree to out/flatpak-app, run
 *      flatpak-builder against build/flatpak/dev.gesslar.mdv.yml, and
 *      build-bundle to out/mdv-<arch>.flatpak
 *
 * Requires on the host: flatpak, flatpak-builder, and the runtime/SDK/base-app
 * pinned in the manifest. Cross-arch builds also need qemu-user-static with
 * binfmt registered so flatpak-builder can run the foreign-arch SDK.
 *
 * Usage:
 *   node scripts/build-flatpak.mjs            # both x64 and arm64
 *   node scripts/build-flatpak.mjs --x64      # x64 only
 *   node scripts/build-flatpak.mjs --arm64    # arm64 only
 */
import {DirectoryObject, FileObject} from "@gesslar/toolkit"
import {spawn} from "node:child_process"
import {cp, rm} from "node:fs/promises"

const projectRoot = FileObject.fromCwf().parent.parent
const manifest = projectRoot.getDirectory("build/flatpak").getFile("dev.gesslar.mdv.yml")
const outDir = projectRoot.getDirectory("out")
const pkg = await projectRoot.getFile("package.json").loadData()
const version = pkg.version

const archConfig = {
  x64: {builderFlag: "--x64", flatpakArch: "x86_64", unpackedName: "linux-unpacked"},
  arm64: {builderFlag: "--arm64", flatpakArch: "aarch64", unpackedName: "linux-arm64-unpacked"},
}

const requestedArches = (() => {
  const wanted = ["x64", "arm64"].filter(a => process.argv.includes(`--${a}`))

  return wanted.length > 0 ? wanted : ["x64", "arm64"]
})()

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, {stdio: "inherit", cwd: projectRoot.path, ...opts})

  child.on("error", reject)
  child.on("exit", code => {
    if(code === 0)
      resolve()
    else
      reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))
  })
})

const buildArch = async arch => {
  const cfg = archConfig[arch]
  const unpacked = outDir.getDirectory(cfg.unpackedName)

  if(!(await unpacked.exists))
    throw new Error(`expected ${unpacked.path} after electron-builder run`)

  const staged = outDir.getDirectory("flatpak-app")

  console.log(`\n==> [${arch}] staging ${cfg.unpackedName} -> ${staged.path}`)
  await rm(staged.path, {recursive: true, force: true})
  await cp(unpacked.path, staged.path, {recursive: true})

  const buildDir = outDir.getDirectory(`flatpak-build-${arch}`)
  const repoDir = outDir.getDirectory("flatpak-repo")
  const ccacheDir = outDir.getDirectory(`flatpak-ccache-${arch}`)

  await rm(buildDir.path, {recursive: true, force: true})

  console.log(`==> [${arch}] flatpak-builder`)
  await run("flatpak-builder", [
    "--force-clean",
    "--user",
    "--install-deps-from=flathub",
    `--arch=${cfg.flatpakArch}`,
    "--ccache",
    `--state-dir=${ccacheDir.path}`,
    `--repo=${repoDir.path}`,
    buildDir.path,
    manifest.path,
  ])

  const bundle = outDir.getFile(`mdv-${version}-${arch}.flatpak`)

  console.log(`==> [${arch}] flatpak build-bundle -> ${bundle.path}`)
  await run("flatpak", [
    "build-bundle",
    `--arch=${cfg.flatpakArch}`,
    repoDir.path,
    bundle.path,
    "dev.gesslar.mdv",
  ])
}

const main = async() => {
  if(!(await manifest.exists))
    throw new Error(`manifest missing: ${manifest.path}`)

  const builderFlags = requestedArches.map(a => archConfig[a].builderFlag)

  console.log(`==> electron-builder --linux --dir ${builderFlags.join(" ")}`)
  await run("npx", ["electron-builder", "--linux", "--dir", ...builderFlags])

  for(const arch of requestedArches)
    await buildArch(arch)

  console.log("\nbuilt:")
  for(const arch of requestedArches)
    console.log(`  out/mdv-${version}-${arch}.flatpak`)

  console.log(`\ninstall: flatpak install --user out/mdv-${version}-<arch>.flatpak`)
  console.log("run:     flatpak run dev.gesslar.mdv [path/to/file.md]")
}

try {
  await main()
} catch(e) {
  console.error(e.message)
  process.exit(1)
}
