// ══════════════════════════════════════════════════════════════════
// Unlink Google — POST to disconnect the Google identity.
//
// Strategy: delete directly from auth.identities via Prisma $executeRaw.
// The Supabase admin REST endpoint for identity deletion is not available
// in all GoTrue versions, and the client-side unlinkIdentity requires ≥2
// identities. Direct DB deletion is reliable, version-independent, and
// bypasses both constraints.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { NextResponse } from 'next/server'
import { prisma } from "@wildgrove/db"
import { AuthProvider } from "@wildgrove/db"

function createAdminClient() {
    return createServiceClient()
}

export async function POST() {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Must have a password (or email identity) before removing Google as sign-in method
        const hasPassword =
            user.user_metadata?.has_password === true ||
            user.identities?.some((i: { provider: string }) => i.provider === 'email')

        if (!hasPassword) {
            return NextResponse.json(
                { error: 'Set a password before disconnecting Google.' },
                { status: 400 }
            )
        }

        // Verify Google is actually linked via admin (authoritative source)
        const admin = createAdminClient()
        const { data: adminData, error: adminErr } = await admin.auth.admin.getUserById(user.id)

        if (adminErr || !adminData.user) {
            return NextResponse.json({ error: 'Could not verify identity data.' }, { status: 500 })
        }

        const hasGoogleIdentity = adminData.user.identities?.some(i => i.provider === 'google')
        if (!hasGoogleIdentity) {
            return NextResponse.json({ error: 'Google is not connected.' }, { status: 400 })
        }

        // Delete the Google identity row directly from the database.
        // This is reliable across all Supabase/GoTrue versions.
        const deleted = await prisma.$executeRaw`
            DELETE FROM auth.user_providers
            WHERE user_id = ${user.id}::uuid AND provider = 'google'
        `

        if (deleted === 0) {
            return NextResponse.json({ error: 'Google identity not found in database.' }, { status: 404 })
        }

        // Remove GOOGLE from Profile connections
        try {
            const profile = await prisma.profile.findUnique({
                where: { id: user.id },
                select: { connections: true },
            })
            if (profile) {
                await prisma.profile.update({
                    where: { id: user.id },
                    data: {
                        connections: profile.connections.filter((c) => c !== AuthProvider.GOOGLE),
                    },
                })
            }
        } catch { /* best-effort */ }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[unlink-google] Error:', err)
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
    }
}
