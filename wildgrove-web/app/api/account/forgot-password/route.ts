// ══════════════════════════════════════════════════════════════════
// Forgot Password | POST to send InsForge reset-password email.
// Recovery emails still receive a branded notice pointing users to
// check the primary inbox (InsForge only emails the account address).
// ══════════════════════════════════════════════════════════════════

import { createServiceClient } from "@wildgrove/core/clients/admin"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import {
  createTransporter,
  getEmailFrom,
  getLocaleFromRequest,
} from "@wildgrove/core/email"
import { enforceLimit, emailLimiter, getClientIp } from "@wildgrove/core/rate-limit"
import { syncResetPasswordTemplate } from "@wildgrove/core/auth-email-templates"

export async function POST(request: NextRequest) {
  const limited = await enforceLimit(emailLimiter, getClientIp(request))
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 })
  }

  // Same contract as /api/auth/reset-password/send: InsForge owns the send,
  // its template table holds one row for every language, so point that row at
  // this request's language first. A failure must not stop the send.
  const locale = getLocaleFromRequest(request)
  try {
    await syncResetPasswordTemplate(locale)
  } catch (err) {
    console.error("[forgot-password] template sync failed:", err)
  }

  const admin = createServiceClient()
  // The reset is by code, entered in the sign-in form or the account page,
  // so the email carries no link back to the site.
  const { error } = await admin.auth.sendResetPasswordEmail({ email })

  // Always return success to avoid account enumeration
  if (error) {
    console.warn("[forgot-password] sendResetPasswordEmail:", error.message)
  }

  // Optionally notify recovery addresses that a reset was requested
  try {
    const profile = await prisma.profile.findUnique({
      where: { email },
      select: { recoveryEmails: true },
    })
    const recoveryEmails = profile?.recoveryEmails ?? []
    if (recoveryEmails.length > 0) {
      const transporter = await createTransporter()
      const emailFrom = await getEmailFrom()
      if (transporter && emailFrom) {
        const subject =
          locale === "es"
            ? "Solicitud de restablecimiento | Wild Grove"
            : "Password reset requested | Wild Grove"
        const html =
          locale === "es"
            ? `<p>Se solicitó un restablecimiento de contraseña para la cuenta asociada a <strong>${email}</strong>. Revisa la bandeja de ese correo para el código o enlace.</p>`
            : `<p>A password reset was requested for the account associated with <strong>${email}</strong>. Check that inbox for the code or link.</p>`
        for (const recoveryEmail of recoveryEmails) {
          await transporter
            .sendMail({
              from: `Wild Grove <${emailFrom}>`,
              to: recoveryEmail,
              subject,
              html,
            })
            .catch((err) =>
              console.error(`[forgot-password] recovery notify ${recoveryEmail}:`, err),
            )
        }
      }
    }
  } catch (err) {
    console.warn("[forgot-password] recovery notify skipped:", err)
  }

  return NextResponse.json({ success: true, sentTo: [email] })
}
