import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, createAuthActions } from "@insforge/sdk/ssr"
import { cookies } from "next/headers"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { resolveIdentifierToEmail } from "@wildgrove/core/auth/identifier"
import { otpLimiter, enforceLimitByIpAndIdentifier } from "@wildgrove/core/rate-limit"

/**
 * Step 2 — exchange OTP code for a reset token (stored in httpOnly cookie).
 *
 * Takes `identifier` (an email or a username) or `email`, resolved server-side
 * exactly as step 1 does.
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

  const server = createServerClient({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    cookies: await cookies(),
  })

  const { data, error } = await server.auth.exchangeResetPasswordToken({
    email,
    code,
  })

  if (error || !data?.token) {
    return NextResponse.json(
      { error: "INVALID_CODE", message: error?.message ?? "Invalid or expired code" },
      { status: 400 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set("insforge_reset_token", data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })
  return response
}
