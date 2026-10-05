#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// `prisma migrate deploy` with retries — but only for connection contention.
//
// The Prisma schema engine opens its own connection outside the app's pg pool,
// so when the database is near its connection limit it can be refused instantly
// with
//
//     Error: Schema engine error:
//     FATAL: sorry, too many clients already
//
// That is contention, not a bad migration, and it is worth waiting out:
// otherwise a deploy carrying no migrations at all fails on a step that had
// nothing to do.
//
// Anything that is NOT a connection error fails on the first attempt, so a
// genuinely broken migration still stops the deploy immediately.
// ══════════════════════════════════════════════════════════════════

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
const packagesDb = path.join(here, "..")
const repoRoot = path.join(packagesDb, "..", "..")
const configPath = path.join(packagesDb, "prisma.config.ts")

/**
 * Locate the prisma CLI without relying on PATH or on npm hoisting: the CLI is
 * declared in wildgrove-web (where the build runs), but npm may dedupe it to
 * the workspace root. Check both, then packages/db, then fall back to PATH.
 */
function resolvePrismaBin() {
  const candidates = [
    path.join(repoRoot, "wildgrove-web", "node_modules", ".bin", "prisma"),
    path.join(repoRoot, "node_modules", ".bin", "prisma"),
    path.join(packagesDb, "node_modules", ".bin", "prisma"),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? "prisma"
}

const prismaBin = resolvePrismaBin()

/** Lowercased substrings that mean "the database would not give us a slot". */
const RETRYABLE = [
  "too many clients already",
  "remaining connection slots are reserved",
  "timed out fetching a new connection",
  "can't reach database server",
  "connection terminated",
  "connection refused",
  "econnreset",
  "etimedout",
]

/** Cumulative wait ≈ 2.5 min across 6 attempts. */
const DELAYS_MS = [5_000, 15_000, 30_000, 45_000, 60_000]

function runOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn(prismaBin, ["migrate", "deploy", "--config", configPath], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let combined = ""
    child.stdout.on("data", (chunk) => {
      combined += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on("data", (chunk) => {
      combined += chunk
      process.stderr.write(chunk)
    })

    child.on("error", reject)
    child.on("close", (code) => resolve({ code: code ?? 1, combined }))
  })
}

for (let attempt = 0; ; attempt++) {
  let result
  try {
    result = await runOnce()
  } catch (err) {
    console.error(
      `[migrate] could not spawn the prisma CLI: ${err.message}\n` +
        "[migrate] it must be resolvable on PATH from the workspace running this script.",
    )
    process.exit(1)
  }

  if (result.code === 0) process.exit(0)

  const haystack = result.combined.toLowerCase()
  const isContention = RETRYABLE.some((needle) => haystack.includes(needle))
  const delay = DELAYS_MS[attempt]

  if (!isContention) {
    console.error("\n[migrate] failed for a reason retrying will not fix — stopping.")
    process.exit(result.code)
  }

  if (delay === undefined) {
    console.error(
      `\n[migrate] the database still had no free connection slot after ${attempt + 1} attempts.`,
    )
    process.exit(result.code)
  }

  console.warn(
    `\n[migrate] database refused the connection (attempt ${attempt + 1}/${
      DELAYS_MS.length + 1
    }); retrying in ${delay / 1000}s…`,
  )
  await new Promise((resolve) => setTimeout(resolve, delay))
}
