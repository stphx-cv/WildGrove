// ══════════════════════════════════════════════════════════════════
// Account Password — PATCH to change password
// Verifies current password via signInWithPassword before updating.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { passwordRules } from '@wildgrove/core/validation'
import { prisma } from "@wildgrove/db"
import { AuthProvider } from "@wildgrove/db"
import { randomUUID } from 'crypto'
import { enforceLimit, authLimiter, getClientIp } from '@wildgrove/core/rate-limit'
import { accountHasPassword } from '@wildgrove/core/insforge/auth-admin'

function createAdminClient() {
    return createServiceClient()
}

export async function PATCH(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit password-change attempts (verifies current password → brute-force surface)
    const limited = await enforceLimit(authLimiter, `${getClientIp(request)}:${user.id}`)
    if (limited) return limited

    const { currentPassword, newPassword } = await request.json()

    if (!newPassword) {
        return NextResponse.json(
            { error: 'New password is required.' },
            { status: 400 }
        )
    }

    // Validate new password against rules
    const failing = passwordRules.filter(r => !r.test(newPassword))
    if (failing.length > 0) {
        return NextResponse.json(
            { error: 'New password does not meet the minimum requirements.' },
            { status: 400 }
        )
    }

    if (currentPassword) {
        // User has an existing password — verify it before allowing the change
        const { error: signInError } = await insforge.auth.signInWithPassword({
            email: user.email!,
            password: currentPassword,
        })
        if (signInError) {
            return NextResponse.json(
                { error: 'Current password is incorrect.' },
                { status: 403 }
            )
        }
    } else {
        // No current password provided. That is only ever valid for an account
        // that has none yet, and the answer comes from the auth row rather than
        // from the session payload. An indeterminate answer is treated as "it
        // has one": the request is refused, and the owner of the account can
        // still get in through the reset-by-email flow.
        const hasPassword = await accountHasPassword(user.id)
        if (hasPassword !== false) {
            return NextResponse.json(
                { error: 'Current password is required.' },
                { status: 400 }
            )
        }
    }

    // Update password and tag the user so client-side can detect password existence
    const { error } = await insforge.auth.updateUser({ password: newPassword, data: { has_password: true } })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Add EMAIL to Profile connections if not already present
    try {
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { connections: true },
        })
        if (profile && !profile.connections.includes(AuthProvider.EMAIL)) {
            await prisma.profile.update({
                where: { id: user.id },
                data: {
                    connections: { set: [...profile.connections, AuthProvider.EMAIL] },
                },
            })
        }
    } catch { /* best-effort */ }

    return NextResponse.json({ success: true })
}

// ══════════════════════════════════════════════════════════════════
// DELETE — Remove the user's password.
//
// Strategy:
//  1. Verify current password via signInWithPassword.
//  2. Check user has Google identity (so at least 1 sign-in method remains).
//  3. Replace encrypted_password with a random unguessable value, and
//     clear the has_password flag — so old password no longer works
//     and the app treats the account as password-less.
// ══════════════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Rate limit password-removal attempts (verifies current password → brute-force surface)
        const limited = await enforceLimit(authLimiter, `${getClientIp(request)}:${user.id}`)
        if (limited) return limited

        const { currentPassword } = await request.json()

        if (!currentPassword) {
            return NextResponse.json({ error: 'Current password is required.' }, { status: 400 })
        }

        // Verify the current password
        const { error: signInError } = await insforge.auth.signInWithPassword({
            email: user.email!,
            password: currentPassword,
        })
        if (signInError) {
            return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 })
        }

        // Ensure user has Google linked so they can still sign in
        const admin = createAdminClient()
        const { data: adminData, error: adminErr } = await admin.auth.admin.getUserById(user.id)
        if (adminErr || !adminData.user) {
            return NextResponse.json({ error: 'Could not verify account status.' }, { status: 500 })
        }

        const identities = adminData.user.identities ?? []
        const hasGoogleIdentity = identities.some(i => i.provider === 'google')
        const hasEmailIdentity  = identities.some(i => i.provider === 'email')

        if (!hasGoogleIdentity) {
            return NextResponse.json(
                { error: 'Connect your Google account first before removing your password.' },
                { status: 400 }
            )
        }

        // Email identity must be disconnected first
        if (hasEmailIdentity) {
            return NextResponse.json(
                { error: 'Disconnect your Email sign-in method first, then remove your password.' },
                { status: 400 }
            )
        }

        // Set a random unguessable password to invalidate the old one,
        // and clear the has_password flag. Using the non-admin updateUser to
        // avoid session invalidation. Single UUID (36 chars) stays well within
        // bcrypt's 72-byte input limit.
        const { error: updateErr } = await insforge.auth.updateUser({
            password: randomUUID(),
            data: { has_password: false },
        })
        if (updateErr) {
            return NextResponse.json({ error: 'Failed to remove password.' }, { status: 500 })
        }

        // Remove EMAIL from Profile connections (best-effort; backfill on next
        // page load will re-add it only if an email identity still exists)
        try {
            const profile = await prisma.profile.findUnique({
                where: { id: user.id },
                select: { connections: true },
            })
            if (profile) {
                await prisma.profile.update({
                    where: { id: user.id },
                    data: { connections: profile.connections.filter(c => c !== AuthProvider.EMAIL) },
                })
            }
        } catch { /* best-effort */ }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[password DELETE] Error:', err)
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
    }
}
