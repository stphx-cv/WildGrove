// ══════════════════════════════════════════════════════════════════
// Current-user endpoint — GET /api/me
// Returns the signed-in user's header profile (name/avatar/role) or null.
// Used by the client-side header island so the page shell itself no longer
// reads auth cookies on the server (keeping public routes statically
// renderable / prefetchable). The middleware remains the real auth boundary.
//
// "There is no session" and "the lookup failed" are different answers and must
// not collapse into the same response. The session comes from the auth claims,
// which need no Postgres; the Profile row only decorates it, and a database
// under load can refuse the connection (P2037). Reporting "signed out" when
// Postgres is unavailable makes the header offer a Sign In button to somebody
// who already has a session, and the proxy then redirects /portal straight back
// to the page they clicked from, so the button looks dead.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"

// Reads auth cookies → must run per request, never cached.
export const dynamic = "force-dynamic"

const SIGNED_OUT = { user: null, isAdmin: false }

export async function GET() {
    let session: { userId: string; email: string; metaAvatar: string | null } | null = null

    try {
        const insforge = await createClient()
        const { data: claimsData } = await insforge.auth.getClaims()
        const claims = claimsData?.claims
        const userId = typeof claims?.sub === "string" ? claims.sub : null

        if (userId) {
            const metadata = claims?.user_metadata as Record<string, unknown> | undefined
            session = {
                userId,
                email: typeof claims?.email === "string" ? claims.email : "",
                metaAvatar: typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null,
            }
        }
    } catch {
        // The auth service itself was unreachable — signed-out and signed-in are
        // indistinguishable here, so say "unknown" and let the caller retry.
        return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503 })
    }

    if (!session) return NextResponse.json(SIGNED_OUT)

    try {
        const profile = await prisma.profile.findUnique({
            where: { id: session.userId },
            select: { firstName: true, lastName: true, username: true, avatarUrl: true, role: true },
        })

        return NextResponse.json({
            user: {
                firstName: profile?.firstName ?? null,
                lastName: profile?.lastName ?? null,
                username: profile?.username ?? null,
                email: session.email,
                avatarUrl: profile?.avatarUrl ?? session.metaAvatar,
            },
            isAdmin: profile?.role === "ADMIN" || profile?.role === "OWNER",
        })
    } catch {
        // Postgres is unavailable (typically P2037, no free connection slot).
        // The session is real, so render the signed-in header from the claims
        // alone. `isAdmin` fails closed — the CMS link stays hidden rather than
        // being shown on a guess.
        return NextResponse.json({
            user: {
                firstName: null,
                lastName: null,
                username: null,
                email: session.email,
                avatarUrl: session.metaAvatar,
            },
            isAdmin: false,
            degraded: true,
        })
    }
}
