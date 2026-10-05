import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { getAppUrl, getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"
import { safeInternalPath } from "@wildgrove/core/safe-path"

/**
 * Start Google (or other) OAuth — returns the provider URL + stores PKCE verifier.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const provider = typeof body.provider === "string" ? body.provider : "google"
  const next = safeInternalPath(body.next)
  const locale = body.locale === "es" ? "es" : "en"

  const nextPath = next.startsWith(`/${locale}`)
    ? next
    : `/${locale}${next === "/" ? "" : next}`

  // InsForge matches redirectTo exactly — query params must not be on redirectTo.
  const redirectTo = new URL("/api/auth/callback", getAppUrl()).toString()
  const mode = typeof body.mode === "string" ? body.mode : null

  const response = NextResponse.json({ ok: true })
  response.cookies.set("auth_oauth_next", nextPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })
  if (mode) {
    response.cookies.set("auth_oauth_mode", mode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    })
  }
  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })

  const { data, error } = await auth.signInWithOAuth(provider, {
    redirectTo,
    additionalParams: { prompt: "select_account" },
    skipBrowserRedirect: true,
  })

  if (error || !data?.url || !data.codeVerifier) {
    return NextResponse.json(
      {
        error: error?.error ?? "OAUTH_INIT_FAILED",
        message: error?.message ?? "Could not start OAuth",
      },
      { status: error?.statusCode ?? 500 }
    )
  }

  response.cookies.set("insforge_code_verifier", data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })

  return NextResponse.json({ url: data.url }, { headers: response.headers })
}
