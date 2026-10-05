// ══════════════════════════════════════════════════════════════════
// Account Email Verify — POST to confirm a primary-email change
// Applies the change only when the stored code matches, is unexpired,
// and still has attempts left. Optional `addToRecovery` appends an
// address that is already verified (the current primary, or one already
// on the recovery list).
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from "@wildgrove/db"
import { enforceLimit, otpLimiter, getClientIp } from '@wildgrove/core/rate-limit'
import { verifyEmailCode } from '@wildgrove/core/otp-verify'

function isAlreadyVerifiedAddress(
    candidate: string,
    currentEmail: string | null | undefined,
    recoveryEmails: string[],
): boolean {
    const normalized = candidate.toLowerCase()
    if (currentEmail && normalized === currentEmail.toLowerCase()) return true
    return recoveryEmails.some((entry) => entry.toLowerCase() === normalized)
}

export async function POST(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await enforceLimit(otpLimiter, `${getClientIp(request)}:${user.id}`)
    if (limited) return limited

    const { email, token, addToRecovery } = await request.json()

    if (!email || !token) {
        return NextResponse.json({ error: 'Missing email or code.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const check = await verifyEmailCode(user.id, normalizedEmail, token)
    if (!check.ok) {
        return NextResponse.json(
            { error: check.error, remaining: check.remaining, invalidated: check.invalidated },
            { status: check.status },
        )
    }

    const taken = await prisma.profile.findFirst({
        where: { email: normalizedEmail, NOT: { id: user.id } },
        select: { id: true },
    })
    if (taken) {
        return NextResponse.json({ error: 'This email is already in use.' }, { status: 400 })
    }

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { recoveryEmails: true },
    })
    const existing = profile?.recoveryEmails ?? []

    const updateData: { email: string; recoveryEmails?: string[] } = { email: normalizedEmail }

    if (addToRecovery && typeof addToRecovery === "string" && addToRecovery.includes("@")) {
        const candidate = addToRecovery.toLowerCase().trim()
        if (isAlreadyVerifiedAddress(candidate, user.email, existing)) {
            if (!existing.map((entry) => entry.toLowerCase()).includes(candidate)) {
                updateData.recoveryEmails = [...existing, candidate]
            }
        }
    }

    await prisma.$executeRaw`
        UPDATE auth.users
        SET email = ${normalizedEmail},
            email_verified = TRUE,
            metadata = (COALESCE(metadata, '{}'::jsonb) - 'new_email'),
            updated_at = NOW()
        WHERE id = ${user.id}::uuid
    `

    await prisma.profile.update({
        where: { id: user.id },
        data: updateData,
    })

    await prisma.verificationCode.deleteMany({ where: { profileId: user.id, email: normalizedEmail } })

    return NextResponse.json({
        success: true,
        email: normalizedEmail,
        recoveryEmails: updateData.recoveryEmails ?? existing,
    })
}
