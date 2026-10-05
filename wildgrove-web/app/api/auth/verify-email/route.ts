import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { authCookieSettings } from "@wildgrove/core/insforge/cookies"
import { resolveIdentifierToEmail } from "@wildgrove/core/auth/identifier"
import { syncProfileFromAuthUser } from "@wildgrove/core/auth/sync-profile"
import type { InitialBalanceCredits } from "@wildgrove/core/wallet/initial-balance"
import { toAuthUser } from "@wildgrove/core/auth/types"
import { otpLimiter, enforceLimitByIpAndIdentifier } from "@wildgrove/core/rate-limit"

/**
 * Confirms the 6-digit code InsForge emailed at sign up. On success InsForge
 * opens the session, the cookies are written onto the response and the Profile
 * row is created from the fields that waited on the auth row. `initialBalance`
 * is what the new profile was credited with, or null.
 *
 * Takes `identifier` (an email or a username) or `email`, resolved server-side
 * like the password reset does, so the person who left the page and came back
 * through the sign in form can finish with a username too.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const identifier =
    typeof body.identifier === "string"
      ? body.identifier.trim()
      : typeof body.email === "string"
        ? body.email.trim()
        : ""
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!identifier || !code) {
    return NextResponse.json({ error: "EMAIL_CODE_REQUIRED" }, { status: 400 })
  }

  const limited = await enforceLimitByIpAndIdentifier(otpLimiter, request, identifier)
  if (limited) return limited

  const invalidCode = () =>
    NextResponse.json(
      { error: "INVALID_CODE", message: "Invalid or expired code" },
      { status: 400 },
    )

  const email = await resolveIdentifierToEmail(identifier)
  if (!email) return invalidCode()

  const response = NextResponse.json({ ok: true })
  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    ...authCookieSettings,
  })

  const { data, error } = await auth.verifyEmail({ email, otp: code })
  if (error || !data?.user) return invalidCode()

  let initialBalance: InitialBalanceCredits | null = null
  const user = toAuthUser(data.user)
  if (user) {
    try {
      initialBalance = (await syncProfileFromAuthUser(user)).initialBalance
    } catch (err) {
      console.error("[auth/verify-email] profile sync failed:", err)
    }
  }

  return NextResponse.json(
    { user: { id: data.user.id, email: data.user.email }, initialBalance },
    { headers: response.headers },
  )
}
