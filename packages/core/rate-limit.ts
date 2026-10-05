// ══════════════════════════════════════════════════════════════════
// Central rate-limiting utility (Upstash Redis sliding window)
//
// Provides per-IP / per-user limiters for the abuse-prone surfaces:
// chat (AI provider cost), OTP + email (messaging cost + takeover),
// auth + user-enumeration endpoints.
//
// Safe degradation: if UPSTASH_REDIS_REST_URL / _TOKEN are unset the
// limiters become no-ops (requests are allowed) so local dev and the
// build never break. In production we warn loudly that limiting is off.
// ══════════════════════════════════════════════════════════════════

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

// ── Redis client (null when not configured) ─────────────────────
const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null
if (url && token) {
  redis = new Redis({ url, token })
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set — " +
      "rate limiting is DISABLED. Configure Upstash to protect abuse-prone routes.",
  )
} else {
  console.warn("[rate-limit] Upstash not configured — rate limiting disabled (dev mode).")
}

function makeLimiter(
  requests: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
  prefix: string,
): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
    analytics: false,
  })
}

// ── Preconfigured limiters ──────────────────────────────────────
/** Login / credential-style endpoints: 5 requests / minute. */
export const authLimiter = makeLimiter(5, "60 s", "rl:auth")
/** OTP send + verify: 5 requests / 10 minutes (key by IP, and by user when known). */
export const otpLimiter = makeLimiter(5, "600 s", "rl:otp")
/** Email dispatch: 3 requests / 10 minutes (cost protection). */
export const emailLimiter = makeLimiter(3, "600 s", "rl:msg")
/** Chat (OpenAI cost): 20 requests / minute / IP. */
export const chatLimiter = makeLimiter(20, "60 s", "rl:chat")
/** User-enumeration endpoints: 10 requests / minute / IP. */
export const enumerationLimiter = makeLimiter(10, "60 s", "rl:enum")

// ── Result type ─────────────────────────────────────────────────
export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  /** Epoch milliseconds when the window resets. */
  reset: number
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * The key every per-IP limiter is bucketed by, when the request did not arrive
 * through the edge. One shared bucket, on purpose: see `getClientIp`.
 */
const UNATTRIBUTED_IP = "unattributed"

/**
 * Client IP, read from the one header the edge writes and from nowhere else.
 *
 * `CF-Connecting-IP` is set by the edge on every request it forwards, and the
 * edge replaces whatever the caller sent under that name. That is what makes it
 * usable as a limiter key. `X-Forwarded-For` and `X-Real-IP` are not: the
 * reverse proxy in front of the apps appends to the chain rather than owning
 * it, so a caller can put any address it likes in the position a limiter would
 * read, and hand itself a fresh bucket per request.
 *
 * Requests that carry no edge header share `UNATTRIBUTED_IP`. That covers local
 * development and anything that reaches the origin without passing the edge.
 * Sharing one bucket is the restrictive direction: those callers compete with
 * each other for one allowance instead of each getting their own.
 */
export function getClientIp(req: Request): string {
  const edgeIp = req.headers.get("cf-connecting-ip")?.trim()
  return edgeIp || UNATTRIBUTED_IP
}

/**
 * Run a limiter for a key. When the limiter is null (Upstash not
 * configured) it allows the request — safe degradation.
 */
export async function limit(
  limiter: Ratelimit | null,
  key: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
  try {
    const { success, limit, remaining, reset } = await limiter.limit(key)
    return { success, limit, remaining, reset }
  } catch (err) {
    // Never let a Redis hiccup take down the route — fail open.
    console.error("[rate-limit] limiter error (allowing request):", err)
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}

/** Build a 429 response with a Retry-After header from a limit result. */
export function tooManyRequests(
  result: RateLimitResult,
  message = "Too many requests. Please try again later.",
): NextResponse {
  const retryAfterSeconds = result.reset
    ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    : 60
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  )
}

/**
 * Convenience: enforce a limiter for a key. Returns a ready-to-send
 * 429 NextResponse when the limit is exceeded, or null to continue.
 *
 * @example
 *   const limited = await enforceLimit(authLimiter, getClientIp(req))
 *   if (limited) return limited
 */
export async function enforceLimit(
  limiter: Ratelimit | null,
  key: string,
  message?: string,
): Promise<NextResponse | null> {
  const result = await limit(limiter, key)
  if (!result.success) return tooManyRequests(result, message)
  return null
}

/**
 * Enforce a limiter for the client IP, and again for an identifier when the
 * request carries one (an email, a username).
 *
 * Two keys rather than one combined key: a single `ip:email` key gives a fresh
 * quota with every email the caller types, which is the shape of a credential
 * sweep. Keeping them apart caps the IP whatever it types, and caps one account
 * whoever types it.
 */
export async function enforceLimitByIpAndIdentifier(
  limiter: Ratelimit | null,
  req: Request,
  identifier?: string | null,
  message?: string,
): Promise<NextResponse | null> {
  const byIp = await enforceLimit(limiter, `ip:${getClientIp(req)}`, message)
  if (byIp) return byIp

  const id = identifier?.trim().toLowerCase()
  if (!id) return null
  return enforceLimit(limiter, `id:${id}`, message)
}
