import { isIP } from 'node:net'
import type { ConnectionOptions } from 'node:tls'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client'
import { isPrismaConnectionExhausted } from './errors'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

/**
 * pg v8 treats sslmode=require as verify-full and warns that future versions
 * will change that. Prefer an explicit verify-full so the warning stays gone
 * and TLS verification remains strict against InsForge Postgres.
 *
 * Only a URL that already asks for TLS is upgraded. A URL with no `sslmode` is
 * passed through untouched, because a freshly installed Postgres does not
 * answer over TLS and promoting it would fail every connection with
 * TlsConnectionError before the first query.
 */
function postgresConnectionString(raw: string): string {
  try {
    const url = new URL(raw)
    const mode = url.searchParams.get('sslmode')
    if (mode === 'require' || mode === 'prefer' || mode === 'verify-ca') {
      url.searchParams.set('sslmode', 'verify-full')
    }
    return url.toString()
  } catch {
    return raw
  }
}

/**
 * Optional PEM that pins the Postgres server certificate (`DATABASE_SSL_CA`).
 *
 * A Postgres that presents a self-signed certificate is vouched for by no
 * public CA. Pinning it here gives verify-full semantics, both encryption and
 * server identity, by checking the certificate against this PEM instead of
 * against the authorities the system already trusts. Dashboards
 * often flatten multi-line secrets, so escaped "\n" is accepted; a bare base64
 * blob (no PEM header) is decoded too.
 */
function sslCaFromEnv(): string | undefined {
  const raw = process.env.DATABASE_SSL_CA?.trim()
  if (!raw) return undefined
  if (raw.includes('-----BEGIN')) return raw.replace(/\\n/g, '\n')
  return Buffer.from(raw, 'base64').toString('utf8')
}

/**
 * pg merges the *parsed connection string over* the explicit config, so any
 * `sslmode` / `ssl*` query param would replace the pinned `ssl` object with a
 * bare `{}` (public-CA verification, which a self-signed cert fails). Strip
 * them when a CA is pinned so the explicit object wins.
 */
function stripSslParams(raw: string): string {
  try {
    const url = new URL(raw)
    for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
      url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return raw
  }
}

/**
 * TLS options for a pinned certificate. When the URL host is a bare IP, pg
 * sends no SNI and Node then checks the certificate against "localhost"; passing
 * `host` makes Node verify the IP SAN instead (a hostname is verified as-is).
 */
function pinnedSslOptions(rawUrl: string, ca: string): ConnectionOptions {
  const options: ConnectionOptions = { ca, rejectUnauthorized: true }
  try {
    const host = new URL(rawUrl).hostname
    if (isIP(host)) options.host = host
  } catch {
    // Unparseable URL — pg will surface the real error on connect.
  }
  return options
}

function positiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

// ── Pool shape ───────────────────────────────────────────────────
// The three numbers below are read from the environment and set per app,
// because the right value depends on how long the process lives. A container
// that stays up for weeks wants a bigger pool and a longer idle wait than a
// process that answers one request and exits: it pays the TLS handshake once
// and then keeps the connection warm.
//
// The defaults here stay conservative on purpose. This package cannot know how
// many connections the database can spare, so a caller that wants more says so
// in its own environment rather than raising the floor for everyone.

function defaultPoolMax(): number {
  return positiveInt(process.env.DATABASE_POOL_MAX, 2)
}

function poolIdleTimeoutMs(): number {
  return positiveInt(process.env.DATABASE_POOL_IDLE_MS, 10_000)
}

/**
 * How long a single connection may live before the pool recycles it. A
 * connection that is never retired outlives credential rotations and any
 * server-side state that accumulates on it.
 */
function poolMaxLifetimeSeconds(): number {
  return positiveInt(process.env.DATABASE_POOL_MAX_LIFETIME_S, 60)
}

/** Delays before re-attempting to acquire a connection, in ms. */
const CONNECT_RETRY_DELAYS_MS = [120, 320, 700, 1_400]

/** Spread concurrent retries so competing isolates do not all come back at once. */
function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.5)
}

/**
 * Wait out `too many clients already` instead of surfacing it as P2037.
 *
 * The retry sits at connection *acquisition*, before any SQL is sent, so a
 * transaction that never started is simply started a moment later — atomicity
 * is untouched. Retrying around queries instead would be unsafe: a statement
 * belonging to an interactive transaction (orders, wallet) could be replayed
 * on its own.
 *
 * `pg` acquires connections two ways and the adapter uses both — `pool.query()`
 * goes through the callback form, `pool.connect()` through the promise form —
 * so both are wrapped.
 *
 * This buys time under contention; it does not create connection slots. The
 * ceiling is whatever the database allows, and raising it is a change to the
 * database, not to this file.
 *
 * Exported for testing only — deliberately not re-exported from index.ts.
 */
export function withConnectRetry(pool: Pool): Pool {
  const original = pool.connect.bind(pool) as (cb?: unknown) => unknown

  const retrying = function connect(callback?: unknown): unknown {
    if (typeof callback === 'function') {
      const cb = callback as (err: unknown, client?: unknown, done?: unknown) => void

      const attempt = (i: number) => {
        original((err: unknown, client?: unknown, done?: unknown) => {
          const delay = CONNECT_RETRY_DELAYS_MS[i]
          if (err && delay !== undefined && isPrismaConnectionExhausted(err)) {
            setTimeout(() => attempt(i + 1), jitter(delay))
            return
          }
          cb(err, client, done)
        })
      }

      attempt(0)
      return undefined
    }

    return (async () => {
      for (let i = 0; ; i++) {
        try {
          return await original()
        } catch (error) {
          const delay = CONNECT_RETRY_DELAYS_MS[i]
          if (delay === undefined || !isPrismaConnectionExhausted(error)) throw error
          await new Promise((resolve) => setTimeout(resolve, jitter(delay)))
        }
      }
    })()
  }

  ;(pool as unknown as { connect: unknown }).connect = retrying
  return pool
}

function getPgPool(): Pool {
  if (!globalForPrisma.pgPool) {
    const rawUrl = process.env.DATABASE_URL!
    const ca = sslCaFromEnv()
    globalForPrisma.pgPool = withConnectRetry(new Pool({
      connectionString: ca ? stripSslParams(rawUrl) : postgresConnectionString(rawUrl),
      // Pinned certificate → strict verification against it (see sslCaFromEnv).
      ...(ca ? { ssl: pinnedSslOptions(rawUrl, ca) } : {}),
      max: defaultPoolMax(),
      idleTimeoutMillis: poolIdleTimeoutMs(),
      connectionTimeoutMillis: 8_000,
      // Let the Node process exit when the pool is idle instead of holding it
      // open: this is what makes a one-off script or a build step terminate.
      allowExitOnIdle: true,
      maxLifetimeSeconds: poolMaxLifetimeSeconds(),
    }))
  }
  return globalForPrisma.pgPool
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getPgPool())
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma
