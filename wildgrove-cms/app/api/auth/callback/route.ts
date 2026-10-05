// ══════════════════════════════════════════════════════════════════
// CMS Google sign-in, step 2 — turns Google's answer into a panel session, but
// only for an account that already exists and whose Profile.role is ADMIN or
// OWNER.
//
// Google sends the browser back here with no session, so proxy.ts lets this
// path through and the role check lives in the route itself. It fails closed:
//   - the session cookies are written to one response only, the one returned
//     to staff. Every refusal is a different response, so an account that is
//     turned away leaves this host without a session;
//   - nothing is created or updated. The storefront's callback syncs the Profile
//     row, which makes one for a stranger. This route only reads it, so signing
//     in with Google can never open an account here.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { prisma } from "@wildgrove/db"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"
import { safeInternalPath } from "@wildgrove/core/safe-path"
import { cmsLink, cmsUrl } from "@wildgrove/core/urls"
import { isAdminRole } from "@/lib/admin-auth"

type Refusal = "oauth_failed" | "not_staff"

/** Back to the sign-in form, with a reason the form knows how to word. */
function refuse(reason: Refusal) {
  const loginUrl = new URL("/login", cmsUrl())
  loginUrl.searchParams.set("error", reason)

  const response = NextResponse.redirect(loginUrl)
  response.headers.set("Cache-Control", "no-store")
  response.cookies.delete("insforge_code_verifier")
  response.cookies.delete("auth_oauth_next")
  return response
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("insforge_code")
  const codeVerifier = request.cookies.get("insforge_code_verifier")?.value

  if (params.get("error") || !code || !codeVerifier) return refuse("oauth_failed")

  // Only a path inside the panel, as oauth/start already stored it.
  const next = safeInternalPath(request.cookies.get("auth_oauth_next")?.value)

  // Session cookies land on this response and on no other.
  const response = NextResponse.redirect(cmsLink(next))
  response.headers.set("Cache-Control", "no-store")
  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })

  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier)
  if (error || !data?.user) {
    console.error("[auth/callback] exchange failed:", error?.message)
    return refuse("oauth_failed")
  }

  let role: string | undefined
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: data.user.id },
      select: { role: true },
    })
    role = profile?.role
  } catch (err) {
    console.error("[auth/callback] role lookup failed:", err)
    return refuse("oauth_failed")
  }

  if (!isAdminRole(role)) return refuse("not_staff")

  response.cookies.delete("insforge_code_verifier")
  response.cookies.delete("auth_oauth_next")
  return response
}
