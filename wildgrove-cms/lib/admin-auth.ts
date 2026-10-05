// ══════════════════════════════════════════════════════════════════
// Admin Auth Helper — Reusable across all /api/* routes
// Verifies the caller is authenticated AND has ADMIN or OWNER role
// against the session and the Profile row. Route handlers call this
// even when the proxy already rejected anonymous traffic, so a request
// that reaches a handler still has to prove its own role.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { prisma } from "@wildgrove/db"

interface AdminAuthSuccess {
    authorized: true
    userId: string
    role: 'ADMIN' | 'OWNER'
}

interface AdminAuthFailure {
    authorized: false
    error: string
    status: number
}

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

export function isAdminRole(role: string | null | undefined): role is 'ADMIN' | 'OWNER' {
    return role === 'ADMIN' || role === 'OWNER'
}

/**
 * Verifies the current request is from an authenticated ADMIN or OWNER.
 * Use at the top of every admin API route handler.
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
    try {
        const insforge = await createClient()
        const { data: { user }, error } = await insforge.auth.getUser()

        if (error || !user) {
            return { authorized: false, error: 'Not authenticated', status: 401 }
        }

        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true },
        })

        if (!profile || !isAdminRole(profile.role)) {
            return { authorized: false, error: 'Insufficient permissions', status: 403 }
        }

        return { authorized: true, userId: user.id, role: profile.role }
    } catch {
        return { authorized: false, error: 'Authentication failed', status: 500 }
    }
}
