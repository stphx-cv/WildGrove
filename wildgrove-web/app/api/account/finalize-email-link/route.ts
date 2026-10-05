// ══════════════════════════════════════════════════════════════════
// Finalize Email Link — POST to officially register email as a
// InsForge sign-in method for the current user.
//
// Strategy:
//  1. Insert an email provider row into auth.user_providers via raw SQL
//  2. If a password is provided, set it via the admin client so the
//     user can also sign in with email + password. Only an account with
//     no password of its own gets one here; changing an existing one goes
//     through /api/account/password, which asks for the current one.
//  3. Update the Profile connections to include EMAIL.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { NextResponse } from 'next/server'
import { prisma } from "@wildgrove/db"
import { AuthProvider } from "@wildgrove/db"
import { passwordRules } from '@wildgrove/core/validation'
import { accountHasPassword } from '@wildgrove/core/insforge/auth-admin'

function createAdminClient() {
    return createServiceClient()
}

export async function POST(request: Request) {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const password = body.password as string | undefined

        if (password !== undefined) {
            // Same rules the rest of the project applies, so a password created
            // here is as strong as one created anywhere else.
            if (typeof password !== 'string' || passwordRules.some(r => !r.test(password))) {
                return NextResponse.json(
                    { error: 'Password does not meet the minimum requirements.' },
                    { status: 400 }
                )
            }

            // This endpoint creates a first password, and it verifies nothing
            // beyond the session. An account that already has one changes it
            // through /api/account/password, which asks for the current one.
            // An indeterminate answer is treated as "it has one".
            const hasPassword = await accountHasPassword(user.id)
            if (hasPassword !== false) {
                return NextResponse.json(
                    { error: 'This account already has a password. Change it from your account settings.' },
                    { status: 409 }
                )
            }
        }

        const userId = user.id
        const email  = user.email!

        // Insert the email identity — idempotent via WHERE NOT EXISTS.
        // This mirrors what Supabase would do when a user signs in via magic link
        // for the first time. Direct SQL is the only reliable way since there is
        // no admin API endpoint for adding identities to existing users.
        const identityData = JSON.stringify({
            email,
            email_verified: true,
            phone_verified: false,
            sub: userId,
        })

        await prisma.$executeRaw`
            INSERT INTO auth.user_providers
                (id, user_id, provider, provider_account_id, provider_data, created_at, updated_at)
            SELECT
                gen_random_uuid(), ${userId}::uuid, 'email', ${email},
                ${identityData}::jsonb, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM auth.user_providers
                WHERE user_id = ${userId}::uuid AND provider = 'email'
            )
        `

        // Set password if the user just created one
        if (password) {
            const admin = createAdminClient()
            const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
                password,
                user_metadata: { has_password: true },
            })
            if (pwErr) {
                console.error('[finalize-email-link] password error:', pwErr)
                return NextResponse.json(
                    { error: 'Failed to set password. Please try again.' },
                    { status: 500 }
                )
            }
        }

        // Update Profile connections
        try {
            const profile = await prisma.profile.findUnique({
                where: { id: userId },
                select: { connections: true },
            })
            if (profile && !profile.connections.includes(AuthProvider.EMAIL)) {
                await prisma.profile.update({
                    where: { id: userId },
                    data: { connections: { push: AuthProvider.EMAIL } },
                })
            }
        } catch { /* best-effort */ }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[finalize-email-link] Error:', err)
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
    }
}
