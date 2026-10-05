// ══════════════════════════════════════════════════════════════════
// Form-user endpoint — GET /api/form-user
// Returns the signed-in user's profile in the UserProfile shape used to
// prefill the public reservation / contact-ticket forms, or { user: null }.
// Resolving this client-side keeps the /reservations and /contact pages free
// of server-side cookie reads, so they stay statically rendered / prefetchable.
// The middleware (proxy.ts) remains the real auth boundary.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import type { UserProfile } from "@wildgrove/core/types"

// Reads auth cookies → must run per request, never cached.
export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const insforge = await createClient()
        const { data: claimsData } = await insforge.auth.getClaims()
        const claims = claimsData?.claims
        const userId = typeof claims?.sub === "string" ? claims.sub : null
        if (!userId) return NextResponse.json({ user: null })

        const profile = await prisma.profile.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneCountryCode: true,
                phoneNumber: true,
            },
        })
        if (!profile) return NextResponse.json({ user: null })

        const claimEmail = typeof claims?.email === "string" ? claims.email : ""
        const user: UserProfile = {
            id: profile.id,
            name:
                profile.name ??
                ([profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
                    claimEmail.split("@")[0] ||
                    ""),
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email ?? claimEmail,
            phone: profile.phoneNumber
                ? `+${profile.phoneCountryCode ?? ""}${profile.phoneNumber}`
                : null,
        }
        return NextResponse.json({ user })
    } catch {
        return NextResponse.json({ user: null })
    }
}
