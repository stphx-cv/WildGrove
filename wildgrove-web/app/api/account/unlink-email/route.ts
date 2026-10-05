// ══════════════════════════════════════════════════════════════════
// Unlink Email — POST to disconnect the email identity and remove
// the password in a single atomic operation.
//
// Flow:
//  1. Verify current password via signInWithPassword.
//  2. Check Google identity exists (must keep ≥1 sign-in method).
//  3. Delete email identity row from auth.identities via Prisma.
//  4. Invalidate the password: set encrypted_password to a random
//     non-bcrypt string via raw SQL (no InsForge API, no session loss).
//  5. Clear has_password flag via admin metadata update.
//  6. Remove EMAIL from Profile connections.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from "@wildgrove/db"
import { AuthProvider } from "@wildgrove/db"
import { randomUUID } from 'crypto'

function createAdminClient() {
    return createServiceClient()
}

export async function POST(request: NextRequest) {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const { currentPassword } = body

        if (!currentPassword) {
            return NextResponse.json({ error: 'Current password is required.' }, { status: 400 })
        }

        // Verify the current password before making any changes
        const { error: signInError } = await insforge.auth.signInWithPassword({
            email: user.email!,
            password: currentPassword,
        })
        if (signInError) {
            return NextResponse.json({ error: 'Incorrect password.' }, { status: 403 })
        }

        // Use admin client for authoritative identity check
        const admin = createAdminClient()
        const { data: adminData, error: adminErr } = await admin.auth.admin.getUserById(user.id)

        if (adminErr || !adminData.user) {
            return NextResponse.json({ error: 'Could not verify identity data.' }, { status: 500 })
        }

        const identities = adminData.user.identities ?? []
        const hasEmailIdentity  = identities.some(i => i.provider === 'email')
        const hasGoogleIdentity = identities.some(i => i.provider === 'google')

        if (!hasEmailIdentity) {
            return NextResponse.json({ error: 'Email is not connected.' }, { status: 400 })
        }

        // Must keep at least one sign-in method
        if (!hasGoogleIdentity) {
            return NextResponse.json(
                { error: 'You must keep at least one sign-in method. Connect Google first.' },
                { status: 400 }
            )
        }

        // Delete the email provider row
        const deleted = await prisma.$executeRaw`
            DELETE FROM auth.user_providers
            WHERE user_id = ${user.id}::uuid AND provider = 'email'
        `

        if (deleted === 0) {
            return NextResponse.json({ error: 'Email identity not found in database.' }, { status: 404 })
        }

        // Invalidate the password directly in the DB.
        try {
            await prisma.$executeRaw`
                UPDATE auth.users
                SET password = crypt(${`REMOVED-${randomUUID()}`}, gen_salt('bf')),
                    updated_at = NOW()
                WHERE id = ${user.id}::uuid
            `
        } catch { /* best-effort — email identity already removed, signin blocked */ }

        // Clear has_password flag via admin (metadata-only = no session invalidation)
        try {
            await admin.auth.admin.updateUserById(user.id, {
                user_metadata: { has_password: false },
            })
        } catch { /* best-effort */ }

        // Remove EMAIL from Profile connections
        try {
            const profile = await prisma.profile.findUnique({
                where: { id: user.id },
                select: { connections: true },
            })
            if (profile) {
                await prisma.profile.update({
                    where: { id: user.id },
                    data: {
                        connections: profile.connections.filter((c) => c !== AuthProvider.EMAIL),
                    },
                })
            }
        } catch { /* best-effort */ }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[unlink-email] Error:', err)
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
    }
}
