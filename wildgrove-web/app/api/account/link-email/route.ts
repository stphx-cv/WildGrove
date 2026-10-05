// ══════════════════════════════════════════════════════════════════
// Link Email | POST — Google-only users set a password to add email
// as a sign-in method (InsForge has no generateLink / linkIdentity).
// Sends a branded email with a deep link to the account password UI.
// ══════════════════════════════════════════════════════════════════

import { createClient } from "@wildgrove/core/clients/server"
import { NextResponse } from "next/server"
import {
  createTransporter,
  getEmailFrom,
  linkEmailVerificationHtml,
  getLocaleFromRequest,
} from "@wildgrove/core/email"
import { getAppUrl } from "@wildgrove/core/insforge/env"

export async function POST(request: Request) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasEmailIdentity = user.identities?.some(
      (i: { provider: string }) => i.provider === "email",
    )
    if (hasEmailIdentity) {
      return NextResponse.json({ error: "Email is already connected." }, { status: 400 })
    }

    if (!user.email) {
      return NextResponse.json({ error: "No email on account." }, { status: 400 })
    }

    const origin = getAppUrl()
    // Point user at account settings to set a password (creates email provider).
    const actionLink = `${origin}/account?highlight=password&linkEmail=1`

    const fullName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : ""
    const firstNameMeta =
      typeof user.user_metadata?.first_name === "string"
        ? user.user_metadata.first_name
        : ""
    const firstName = firstNameMeta || fullName.split(" ")[0] || "there"

    const locale = getLocaleFromRequest(request)
    const transporter = await createTransporter()
    const emailFrom = await getEmailFrom()
    if (!transporter || !emailFrom) {
      return NextResponse.json(
        { error: "Email notifications are disabled in admin settings." },
        { status: 503 },
      )
    }

    await transporter.sendMail({
      from: `Wild Grove <${emailFrom}>`,
      to: user.email,
      subject:
        locale === "es" ? "Vincula tu correo | Wild Grove" : "Link your email | Wild Grove",
      html: linkEmailVerificationHtml(firstName, actionLink, locale),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[link-email] Error:", err)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
