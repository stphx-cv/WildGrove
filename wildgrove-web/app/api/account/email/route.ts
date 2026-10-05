// ══════════════════════════════════════════════════════════════════
// Account Email — PATCH to request a primary-email change
// Issues a one-time code, stores it, and sends it to the new address.
// auth.users is not modified here; the verify route applies the change.
// ══════════════════════════════════════════════════════════════════

import crypto from "crypto"
import { createClient } from '@wildgrove/core/clients/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createTransporter, getEmailFrom, recoveryEmailOtpHtml, getLocaleFromRequest } from '@wildgrove/core/email'
import { prisma } from "@wildgrove/db"
import { enforceLimit, emailLimiter, getClientIp } from '@wildgrove/core/rate-limit'

export async function PATCH(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await enforceLimit(emailLimiter, `${getClientIp(request)}:${user.id}`)
    if (limited) return limited

    const { email, skipRecoveryCheck } = await request.json()

    if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (normalizedEmail === user.email?.toLowerCase()) {
        return NextResponse.json({ error: 'This is already your current email.' }, { status: 400 })
    }

    const taken = await prisma.profile.findFirst({
        where: { email: normalizedEmail, NOT: { id: user.id } },
        select: { id: true },
    })
    if (taken) {
        return NextResponse.json({ error: 'This email is already in use.' }, { status: 400 })
    }

    if (!skipRecoveryCheck) {
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { recoveryEmails: true },
        })
        if (profile?.recoveryEmails.map(e => e.toLowerCase()).includes(normalizedEmail)) {
            return NextResponse.json({
                error: 'This email is already a recovery email. Remove it first or use "Make Primary".',
            }, { status: 400 })
        }
    }

    const code = crypto.randomInt(100000, 999999).toString()

    await prisma.verificationCode.deleteMany({ where: { profileId: user.id, email: normalizedEmail } })
    await prisma.verificationCode.create({
        data: {
            profileId: user.id,
            email: normalizedEmail,
            code,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    })

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
            subject: locale === "es" ? "Verificar correo nuevo | Wild Grove" : "Verify your new email | Wild Grove",
            html: recoveryEmailOtpHtml(code, locale),
        })
    } catch (err) {
        console.error("[account-email] Failed to send OTP:", err)
        return NextResponse.json({ error: "Failed to send verification email. Please try again." }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        message: "Verification code sent. Check your inbox.",
    })
}
