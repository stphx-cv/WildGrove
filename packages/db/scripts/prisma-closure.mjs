#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Print the dependency closure of one or more packages, as paths relative to
// the workspace root.
//
// The migrator image needs the prisma CLI and nothing else, but "nothing else"
// is 130-odd modules once the schema engine's own dependencies are counted, and
// that list changes whenever prisma does. Writing it by hand guarantees a build
// that breaks on an upgrade with `Cannot find module`, so it is computed from
// the tree that npm actually installed.
//
//   node packages/db/scripts/prisma-closure.mjs /repo prisma dotenv
//
// Resolution walks up through parent `node_modules` the way Node does, so a
// hoisted dependency and a nested one both land in the right place.
// ══════════════════════════════════════════════════════════════════

import fs from "node:fs"
import path from "node:path"

const root = process.argv[2]
const entries = process.argv.slice(3)

if (!root || entries.length === 0) {
    console.error("usage: prisma-closure.mjs <workspace-root> <package>...")
    process.exit(1)
}

const found = new Set()
const visited = new Set()

function resolveDir(name, from) {
    let dir = from
    for (;;) {
        const candidate = path.join(dir, "node_modules", name)
        if (fs.existsSync(path.join(candidate, "package.json"))) return candidate
        const parent = path.dirname(dir)
        if (parent === dir) return null
        dir = parent
    }
}

function walk(name, from) {
    const dir = resolveDir(name, from)
    if (!dir || visited.has(dir)) return
    visited.add(dir)
    found.add(path.relative(root, dir))

    let manifest
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    } catch {
        // A directory without a readable manifest still ships; it just has no
        // dependencies to follow.
        return
    }

    // Optional dependencies are followed too: prisma's platform-specific engine
    // binaries arrive that way, and a missing one fails at run time, not here.
    for (const dep of Object.keys(manifest.dependencies ?? {})) walk(dep, dir)
    for (const dep of Object.keys(manifest.optionalDependencies ?? {})) walk(dep, dir)
}

for (const entry of entries) walk(entry, root)

if (found.size === 0) {
    console.error(`No packages resolved from ${root}. Was the install run?`)
    process.exit(1)
}

console.log([...found].sort().join("\n"))
