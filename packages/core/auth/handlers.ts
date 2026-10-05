// ══════════════════════════════════════════════════════════════════
// Shared auth route handlers.
//
// Both apps expose the same email/password endpoints — the storefront for
// customers, the CMS for staff — but `insforge_*` cookies are host-only, so
// each host issues and holds its own session. Only the logic is shared; the
// route files in each app are thin delegations.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"

import { authCookieSettings } from "../insforge/cookies"
import { getInsforgeAnonKey, getInsforgeUrl } from "../insforge/env"
import { authLimiter, enforceLimitByIpAndIdentifier } from "../rate-limit"
import { createClient } from "../clients/server"
import { resolveIdentifierToEmail } from "./identifier"
import { syncProfileFromAuthUser } from "./sync-profile"
import { toAuthUser } from "./types"

function authActions(request: NextRequest, response: NextResponse) {
  return createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })
}

/**
 * POST — sign in with a password. Syncs the Profile row on success.
 *
 * Takes `identifier` (an email or a username) or `email`; a username is turned
 * into an address here, so the browser never has to be told one. An identifier
 * that matches no account answers like a wrong password.
 */
export async function handleSignIn(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const identifier =
    typeof body.identifier === "string"
      ? body.identifier.trim()
      : typeof body.email === "string"
        ? body.email.trim()
        : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "EMAIL_PASSWORD_REQUIRED", message: "Email and password are required" },
      { status: 400 },
    )
  }

  const limited = await enforceLimitByIpAndIdentifier(authLimiter, request, identifier)
  if (limited) return limited

  const unauthorized = () =>
    NextResponse.json(
      { error: "AUTH_UNAUTHORIZED", message: "Invalid login credentials" },
      { status: 401 },
    )

  const email = await resolveIdentifierToEmail(identifier)
  if (!email) return unauthorized()

  const response = NextResponse.json({ ok: true })
  const auth = authActions(request, response)

  const { data, error } = await auth.signInWithPassword({ email, password })
  if (error || !data?.user) {
    return NextResponse.json(
      {
        error: error?.error ?? "AUTH_UNAUTHORIZED",
        message: error?.message ?? "Sign in failed",
      },
      { status: error?.statusCode ?? 401 },
    )
  }

  const user = toAuthUser(data.user)
  if (user) {
    try {
      await syncProfileFromAuthUser(user)
    } catch (err) {
      console.error("[auth/sign-in] profile sync failed:", err)
    }
  }

  return NextResponse.json(
    { user: { id: data.user.id, email: data.user.email } },
    { headers: response.headers },
  )
}

/** POST — clears the session cookies for this host. */
export async function handleSignOut(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  const auth = authActions(request, response)

  const { error } = await auth.signOut()
  if (error) {
    return NextResponse.json(
      { error: error.error ?? "SIGNOUT_FAILED", message: error.message },
      { status: error.statusCode ?? 500 },
    )
  }

  return NextResponse.json({ ok: true }, { headers: response.headers })
}

/**
 * GET — browser-safe session probe; reads the httpOnly InsForge cookies on the
 * server because `createBrowserClient.getCurrentUser()` is unreliable right
 * after a cookie-based sign in.
 */
export async function handleSessionProbe() {
  try {
    const insforge = await createClient()
    const {
      data: { user },
      error,
    } = await insforge.auth.getUser()

    if (error || !user) return NextResponse.json({ user: null })
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null })
  }
}
