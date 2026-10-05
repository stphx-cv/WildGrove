import { NextResponse, type NextRequest } from "next/server"
import { createAuthActions } from "@insforge/sdk/ssr"
import { getInsforgeAnonKey, getInsforgeUrl } from "@wildgrove/core/insforge/env"
import { getLocaleFromRequest } from "@wildgrove/core/email"
import { syncResetPasswordTemplate } from "@wildgrove/core/auth-email-templates"
import { resolveIdentifierToEmail, maskEmail } from "@wildgrove/core/auth/identifier"
import { emailLimiter, enforceLimitByIpAndIdentifier } from "@wildgrove/core/rate-limit"

/**
 * Step 1 of password reset — send 6-digit code email.
 *
 * Takes `identifier` (an email or a username) or `email`. The address it lands
 * on is resolved here. The answer is the same whether an account exists or
 * not: an email comes back masked as it was typed, and a username gets no
 * address at all, so the caller learns nothing about an account that is not
 * theirs.
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
    return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 })
  }

  const limited = await enforceLimitByIpAndIdentifier(emailLimiter, request, identifier)
  if (limited) return limited

  const email = await resolveIdentifierToEmail(identifier)

  const response = NextResponse.json({ ok: true })
  const auth = createAuthActions({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  })

  // Prefer SDK password-reset send when available on auth actions surface.
  const client = auth as unknown as {
    signInWithOtp?: (args: { email: string }) => Promise<{ error: { message?: string } | null }>
  }

  // Fallback: use signInWithOtp channel only if dedicated reset isn't on AuthActions.
  // InsForge admin dashboard uses resetPasswordMethod=code; call via raw client if needed.
  const { createServerClient } = await import("@insforge/sdk/ssr")
  const { cookies } = await import("next/headers")
  const server = createServerClient({
    baseUrl: getInsforgeUrl(),
    anonKey: getInsforgeAnonKey(),
    cookies: await cookies(),
  })

  // InsForge renders and sends this email, and its template table holds one
  // row for every language. Point that row at the caller's language first —
  // AuthForm sends `x-locale`, so this is the language of the page they are
  // looking at. A failure here must not stop the send: the wrong language
  // beats no email. See packages/core/auth-email-templates.ts.
  try {
    await syncResetPasswordTemplate(getLocaleFromRequest(request))
  } catch (err) {
    console.error("[auth/reset-password/send] template sync failed:", err)
  }

  // A username that matches no account gets the same answer as one that does.
  if (email) {
    const { error } = await server.auth.sendResetPasswordEmail({ email })
    if (error) {
      // Do not leak whether the email exists
      console.warn("[auth/reset-password/send]", error.message)
    }
  }

  // Masking what the caller typed reveals nothing; masking a username's
  // address would tell them the account exists.
  const typedEmail = identifier.includes("@") ? identifier.toLowerCase() : null
  return NextResponse.json(
    { ok: true, maskedEmail: typedEmail ? maskEmail(typedEmail) : null },
    { headers: response.headers },
  )
}
