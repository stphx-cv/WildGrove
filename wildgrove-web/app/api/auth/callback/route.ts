// ══════════════════════════════════════════════════════════════════
// Auth Callback — InsForge OAuth / email link redirects
// Exchanges `insforge_code` for a session, upserts Profile, then
// redirects to complete-profile (new Google users) or portal.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"
import { getAppUrl, getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"
import { getUserLocaleFromAuthUser, syncProfileFromAuthUser } from "@wildgrove/core/auth/sync-profile"
import { toAuthUser } from "@wildgrove/core/auth/types"
import { safeInternalPath } from "@wildgrove/core/safe-path"

function resolveLocale(nextPath: string, fallback: "en" | "es"): "en" | "es" {
  const localeFromPath = /^\/(en|es)(?:\/|$)/.exec(nextPath)?.[1]
  return localeFromPath === "es" ? "es" : localeFromPath === "en" ? "en" : fallback
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // The container listens on 0.0.0.0:3000. Next builds request.url from that
  // bind address, and a browser cannot open it. The public site address is
  // the one Google was told to come back to.
  const origin = getAppUrl()
  const code = searchParams.get("insforge_code") ?? searchParams.get("code")
  const oauthError = searchParams.get("error")
  // Only a path inside this site, as oauth/start already stores it.
  const next = safeInternalPath(
    searchParams.get("next") ?? request.cookies.get("auth_oauth_next")?.value,
  )
  const mode =
    searchParams.get("mode") ?? request.cookies.get("auth_oauth_mode")?.value ?? null

  if (oauthError || !code) {
    const locale = resolveLocale(next, "en")
    return NextResponse.redirect(
      `${origin}/${locale}/portal?error=auth_callback_failed`
    )
  }

  const codeVerifier = request.cookies.get("insforge_code_verifier")?.value
  const response = NextResponse.redirect(`${origin}${next}`)
  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })

  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier)
  if (error || !data?.user) {
    console.error("[auth/callback] exchange failed:", error)
    const locale = resolveLocale(next, "en")
    return NextResponse.redirect(
      `${origin}/${locale}/portal?error=auth_callback_failed`
    )
  }

  response.cookies.delete("insforge_code_verifier")
  response.cookies.delete("auth_oauth_next")
  response.cookies.delete("auth_oauth_mode")

  let redirectUrl = `${origin}${next}`
  let localeForRedirect: "en" | "es" = "en"

  try {
    const user = toAuthUser(data.user)
    if (user) {
      localeForRedirect = getUserLocaleFromAuthUser(user)
      const { profile, existedProfile } = await syncProfileFromAuthUser(user)

      if (!existedProfile) {
        const profileName = profile.name || profile.firstName || user.email || "A new user"
        createAdminNotificationForAllAdmins({
          type: "CUSTOMER_CREATED",
          entityType: "PROFILE",
          entityId: user.id,
          title: "New customer registered",
          message: `${profileName} has joined the platform.`,
          href: `/customers/${user.id}`,
          metadata: {
            profileId: user.id,
            email: user.email ?? null,
          },
        }).catch((notifyError) => {
          console.error("[auth/callback] Notification error:", notifyError)
        })
      }

      const isGoogleUser =
        user.app_metadata?.provider === "google" ||
        user.identities?.some((id) => id.provider === "google")
      if (!profile.username && isGoogleUser) {
        redirectUrl = `${origin}/${localeForRedirect}/portal/complete-profile`
      }
    }
  } catch {
    // Profile upsert is best-effort
  }

  if (mode === "link") {
    redirectUrl = `${origin}${next}`
  }

  return NextResponse.redirect(redirectUrl, {
    headers: response.headers,
  })
}
