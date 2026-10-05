import { createServiceClient } from '@wildgrove/core/clients/admin'
import { AuthProvider } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { enforceLimit, enumerationLimiter, getClientIp } from '@wildgrove/core/rate-limit'
import { resolveIdentifierToEmail } from '@wildgrove/core/auth/identifier'

function createAdminClient() {
    return createServiceClient()
}

function googleOnlyFromConnections(connections: AuthProvider[]): boolean {
    return connections.includes(AuthProvider.GOOGLE) && !connections.includes(AuthProvider.EMAIL)
}

/**
 * Which sign-in methods an account has, for the message the login form shows
 * after a rejected attempt. Takes `identifier` (an email or a username) or
 * `email`, and answers with booleans only.
 */
export async function GET(request: NextRequest) {
    const limited = await enforceLimit(enumerationLimiter, getClientIp(request))
    if (limited) return limited

    const params = request.nextUrl.searchParams
    const identifier = params.get('identifier') ?? params.get('email')

    if (!identifier) {
        return NextResponse.json({ exists: false })
    }

    const normalized = await resolveIdentifierToEmail(identifier)
    if (!normalized) {
        return NextResponse.json({ exists: false })
    }

    const existing = await prisma.profile.findUnique({
        where: { email: normalized },
        select: { id: true, connections: true },
    })

    if (!existing) {
        return NextResponse.json({ exists: false })
    }

    let googleSignInOnly = googleOnlyFromConnections(existing.connections)

    try {
        const admin = createAdminClient()
        const { data, error } = await admin.auth.admin.getUserById(existing.id)
        if (!error && data.user?.identities && data.user.identities.length > 0) {
            const identities = data.user.identities
            const hasEmailProvider = identities.some((i) => i.provider === 'email')
            const hasGoogleProvider = identities.some((i) => i.provider === 'google')
            googleSignInOnly = hasGoogleProvider && !hasEmailProvider
        }
    } catch {
        // Keep Prisma-based inference if admin API is unavailable
    }

    return NextResponse.json({ exists: true, googleSignInOnly })
}
