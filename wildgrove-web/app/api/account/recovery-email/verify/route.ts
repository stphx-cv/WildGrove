// ══════════════════════════════════════════════════════════════════
// Account Recovery Email Verify — POST to confirm via OTP
// Verifies the 6-digit code and appends the email to recoveryEmails.
// ══════════════════════════════════════════════════════════════════

import { createClient } from "@wildgrove/core/clients/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import { enforceLimit, otpLimiter, getClientIp } from "@wildgrove/core/rate-limit"
import { verifyEmailCode } from "@wildgrove/core/otp-verify"

export async function POST(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Per-IP + per-user OTP rate limit (brute-force protection)
    const limited = await enforceLimit(otpLimiter, `${getClientIp(request)}:${user.id}`)
    if (limited) return limited

    const { email, token } = await request.json()

    if (!email || !token) {
        return NextResponse.json({ error: "Missing email or code." }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Validate the code, counting failed attempts (invalidates after N tries)
    const check = await verifyEmailCode(user.id, normalizedEmail, token)
    if (!check.ok) {
        return NextResponse.json(
            { error: check.error, remaining: check.remaining, invalidated: check.invalidated },
            { status: check.status }
        )
    }

    // Append the verified email to recoveryEmails (avoid duplicates)
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { recoveryEmails: true },
    })

    const existing = profile?.recoveryEmails ?? []
    const updated = existing.includes(normalizedEmail)
        ? existing
        : [...existing, normalizedEmail]

    await prisma.profile.update({
        where: { id: user.id },
        data: { recoveryEmails: updated },
    })

    // Clean up the verification code
    await prisma.verificationCode.deleteMany({ where: { profileId: user.id, email: normalizedEmail } })

    return NextResponse.json({ success: true, recoveryEmails: updated })
}
