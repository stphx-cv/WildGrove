import { prisma } from "@wildgrove/db"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isUsernamePending } from '@wildgrove/core/insforge/auth-admin'
import { enforceLimit, enumerationLimiter, getClientIp } from '@wildgrove/core/rate-limit'

export async function GET(request: NextRequest) {
    const limited = await enforceLimit(enumerationLimiter, getClientIp(request))
    if (limited) return limited

    const username = request.nextUrl.searchParams.get('username')

    if (!username || username.length < 3) {
        return NextResponse.json({ available: false, reason: 'too_short' })
    }

    const existing = await prisma.profile.findUnique({
        where: { username },
        select: { id: true },
    })

    return NextResponse.json({ available: !existing && !(await isUsernamePending(username)) })
}
