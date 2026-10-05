// ══════════════════════════════════════════════════════════════════
// GET /api/auth/resolve-identifier?identifier=<email|username>
//
// Says whether an account exists behind an identifier, and gives back the
// masked form of its address (ma***@example.com) for a form that needs to show
// which inbox a code went to. The address itself never leaves the server:
// sign-in and the password-reset steps take the identifier and resolve it
// themselves (packages/core/auth/identifier.ts).
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { enforceLimit, enumerationLimiter, getClientIp } from '@wildgrove/core/rate-limit'
import { maskEmail, resolveIdentifierToEmail } from '@wildgrove/core/auth/identifier'
import { prisma } from "@wildgrove/db"

export async function GET(request: NextRequest) {
    const limited = await enforceLimit(enumerationLimiter, getClientIp(request))
    if (limited) return limited

    const identifier = request.nextUrl.searchParams.get('identifier')

    if (!identifier) {
        return NextResponse.json({ found: false })
    }

    const email = await resolveIdentifierToEmail(identifier)
    if (!email) {
        return NextResponse.json({ found: false })
    }

    const profile = await prisma.profile.findUnique({
        where: { email },
        select: { id: true },
    })

    if (!profile) {
        return NextResponse.json({ found: false })
    }

    return NextResponse.json({ found: true, maskedEmail: maskEmail(email) })
}
