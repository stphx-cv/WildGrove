// ══════════════════════════════════════════════════════════════════
// Resend the signup verification code — POST { identifier | email }
// InsForge generates and sends the code; the template row is pointed at the
// caller's language first, as the password reset does.
// ══════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@insforge/sdk/ssr"
import { cookies } from "next/headers"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { getLocaleFromRequest } from "@wildgrove/core/email"
import { syncVerifyEmailTemplate } from "@wildgrove/core/auth-email-templates"
import { resolveIdentifierToEmail, maskEmail } from "@wildgrove/core/auth/identifier"
import { emailLimiter, enforceLimitByIpAndIdentifier } from "@wildgrove/core/rate-limit"

/**
 * The answer is the same whether an account exists or not: an email comes back
 * masked as it was typed, and a username gets no address at all, so the caller
 * learns nothing about an account that is not theirs. InsForge itself refuses
 * to send for an address that is already confirmed or does not exist.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const identifier =
    typeof body.identifier === "string"
      ? body.identifier.trim()
      : typeof body.email === "string"
        ? body.email.trim()
        : ""
  if (!identifier) {
    return NextResponse.json({ success: false, error: "EMAIL_REQUIRED" }, { status: 400 })
  }

  const limited = await enforceLimitByIpAndIdentifier(emailLimiter, request, identifier)
  if (limited) return limited

  const email = await resolveIdentifierToEmail(identifier)

  if (email) {
    try {
      await syncVerifyEmailTemplate(getLocaleFromRequest(request))
    } catch (err) {
      console.error("[auth/resend-verification] template sync failed:", err)
    }

    const server = createServerClient({
      baseUrl: getInsforgeUrl(),
      anonKey: getInsforgeAnonKey(),
      cookies: await cookies(),
    })
    const { error } = await server.auth.resendVerificationEmail({ email })
    if (error) {
      console.warn("[auth/resend-verification]", error.message)
      if (error.statusCode === 429) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 429 },
        )
      }
    }
  }

  const typedEmail = identifier.includes("@") ? identifier.toLowerCase() : null
  return NextResponse.json({
    success: true,
    maskedEmail: typedEmail ? maskEmail(typedEmail) : null,
  })
}
