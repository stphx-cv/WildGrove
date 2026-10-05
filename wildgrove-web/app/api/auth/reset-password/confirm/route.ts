import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@insforge/sdk/ssr"
import { cookies } from "next/headers"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { otpLimiter, enforceLimitByIpAndIdentifier } from "@wildgrove/core/rate-limit"

/** Step 3 — set new password using the reset token cookie. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "PASSWORD_REQUIRED" }, { status: 400 })
  }

  const limited = await enforceLimitByIpAndIdentifier(otpLimiter, request)
  if (limited) return limited

  const cookieStore = await cookies()
  const token = cookieStore.get("insforge_reset_token")?.value
  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 })
  }

  const server = createServerClient({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    cookies: cookieStore,
  })

  const { error } = await server.auth.resetPassword({
    newPassword,
    otp: token,
  })

  if (error) {
    return NextResponse.json(
      { error: "RESET_FAILED", message: error.message },
      { status: error.statusCode ?? 400 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete("insforge_reset_token")
  return response
}
