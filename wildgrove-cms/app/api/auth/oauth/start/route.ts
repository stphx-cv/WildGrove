// ══════════════════════════════════════════════════════════════════
// CMS Google sign-in, step 1 — returns the Google URL and parks the PKCE
// verifier and the landing path in short-lived httpOnly cookies.
//
// Google is the only provider this host offers, and the caller cannot pick
// another one. Starting the flow creates nothing: who may come in is decided in
// /api/auth/callback, once Google has said who the person is.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"
import { authLimiter, enforceLimit, getClientIp } from "@wildgrove/core/rate-limit"
import { safeInternalPath } from "@wildgrove/core/safe-path"
import { cmsUrl } from "@wildgrove/core/urls"

const transientCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 600,
} as const

export async function POST(request: NextRequest) {
  const limited = await enforceLimit(authLimiter, `ip:${getClientIp(request)}`)
  if (limited) return limited

  const body = (await request.json().catch(() => null)) as { next?: unknown } | null
  const next = safeInternalPath(body?.next)

  // InsForge matches redirectTo exactly, so nothing goes on it after the path.
  // The address must also be listed under allowed_redirect_urls in insforge.toml.
  const redirectTo = new URL("/api/auth/callback", cmsUrl()).toString()

  const response = NextResponse.json({ ok: true })
  response.cookies.set("auth_oauth_next", next, transientCookie)

  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })

  const { data, error } = await auth.signInWithOAuth("google", {
    redirectTo,
    additionalParams: { prompt: "select_account" },
    skipBrowserRedirect: true,
  })

  if (error || !data?.url || !data.codeVerifier) {
    console.error("[auth/oauth/start] could not start Google sign-in:", error?.message)
    return NextResponse.json({ error: "OAUTH_INIT_FAILED" }, { status: 502 })
  }

  response.cookies.set("insforge_code_verifier", data.codeVerifier, transientCookie)

  return NextResponse.json({ url: data.url }, { headers: response.headers })
}
