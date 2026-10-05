// ══════════════════════════════════════════════════════════════════
// Account Recovery Email
// PATCH | Send a 6-digit OTP to verify a new recovery email
// DELETE | Remove a specific recovery email from the list
// ══════════════════════════════════════════════════════════════════

import crypto from "crypto"
import { createClient } from "@wildgrove/core/clients/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import { createTransporter, getEmailFrom, recoveryEmailOtpHtml, getLocaleFromRequest } from "@wildgrove/core/email"
import { enforceLimit, emailLimiter, getClientIp } from "@wildgrove/core/rate-limit"

export async function PATCH(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limit OTP/email dispatch (cost protection)
    const limited = await enforceLimit(emailLimiter, `${getClientIp(request)}:${user.id}`)
    if (limited) return limited

    const { email } = await request.json()

    if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Invalid email address." }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (normalizedEmail === user.email?.toLowerCase()) {
        return NextResponse.json({ error: "Recovery email cannot be the same as your primary email." }, { status: 400 })
    }

    // Check if already in the list
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { recoveryEmails: true },
    })
    if (profile?.recoveryEmails.map(e => e.toLowerCase()).includes(normalizedEmail)) {
        return NextResponse.json({ error: "This email is already a recovery email." }, { status: 400 })
    }

    // Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString()

    // Clear any pending codes for this user+email combo and create a new one
    await prisma.verificationCode.deleteMany({ where: { profileId: user.id, email: normalizedEmail } })
    await prisma.verificationCode.create({
        data: {
            profileId: user.id,
            email: normalizedEmail,
            code,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    })

    // Send OTP via email
    try {
        const locale = getLocaleFromRequest(request)
        const transporter = await createTransporter()
        const emailFrom = await getEmailFrom()
        if (!transporter || !emailFrom) {
            return NextResponse.json({ error: "Email notifications are disabled in admin settings." }, { status: 503 })
        }
        await transporter.sendMail({
            from: `Wild Grove <${emailFrom}>`,
            to: email,
            subject: locale === "es" ? "Verificar correo de recuperación | Wild Grove" : "Verify Your Recovery Email | Wild Grove",
            html: recoveryEmailOtpHtml(code, locale),
        })
    } catch (err) {
        console.error("[recovery-email] Failed to send OTP:", err)
        return NextResponse.json({ error: "Failed to send verification email. Please try again." }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        message: "Verification code sent. Check your inbox.",
    })
}

export async function DELETE(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email } = await request.json()

    if (!email) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { recoveryEmails: true },
    })

    const updated = (profile?.recoveryEmails ?? []).filter(e => e.toLowerCase() !== normalizedEmail)

    await prisma.profile.update({
        where: { id: user.id },
        data: { recoveryEmails: updated },
    })

    // Clean up any pending verification codes for this email
    await prisma.verificationCode.deleteMany({ where: { profileId: user.id, email: normalizedEmail } })

    return NextResponse.json({ success: true, recoveryEmails: updated })
}
