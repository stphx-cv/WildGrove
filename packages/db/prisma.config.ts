// ══════════════════════════════════════════════════════════════════
// Prisma v7 config — datasource URLs configured here, not in schema.prisma
//
// This package is invoked from several working directories (repo root via
// turbo, `packages/db` via the prisma CLI, `wildgrove-web` during its build),
// so every path below is resolved from THIS FILE, never from `process.cwd()`.
// ══════════════════════════════════════════════════════════════════
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import dotenv from "dotenv"
import { defineConfig } from "prisma/config"

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageDir, "..", "..")

// Next.js uses .env.local — dotenv/config only loads .env.
// First existing candidate wins; `wildgrove-web` owns the migration credentials
// (it is the only app that runs `prisma migrate deploy`).
const envCandidates = [
  path.join(packageDir, ".env.local"),
  path.join(packageDir, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, "wildgrove-web", ".env.local"),
]

const envFile = envCandidates.find(existsSync)
if (envFile) {
  dotenv.config({ path: envFile })
} else if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  // Fail loud rather than silently migrating against `undefined`.
  throw new Error(
    `[@wildgrove/db] No env file found and no DATABASE_URL/DIRECT_URL in the environment.\n` +
      `Looked for:\n  ${envCandidates.join("\n  ")}`,
  )
}

const prismaDir = path.join(packageDir, "prisma")

/**
 * The schema engine resolves `sslcert` / `sslidentity` against its *cwd*, which
 * differs between `turbo`, the prisma CLI and the deploy step that migrates.
 * Anchor relative paths to `packages/db/prisma/` so one DIRECT_URL works
 * everywhere, including the form that pins the server certificate with
 * `?sslmode=require&sslcert=<file>&sslaccept=strict`.
 */
function withAbsoluteSslPaths(raw: string): string {
  try {
    const url = new URL(raw)
    for (const key of ["sslcert", "sslidentity"]) {
      const value = url.searchParams.get(key)
      if (value && !path.isAbsolute(value)) {
        url.searchParams.set(key, path.resolve(prismaDir, value))
      }
    }
    return url.toString()
  } catch {
    return raw
  }
}

export default defineConfig({
  schema: path.join(prismaDir, "schema.prisma"),
  migrations: {
    path: path.join(prismaDir, "migrations"),
    seed: `npx tsx ${path.join(prismaDir, "seed.ts")}`,
  },
  datasource: {
    url: withAbsoluteSslPaths(process.env.DIRECT_URL || process.env.DATABASE_URL!),
  },
})
