// ══════════════════════════════════════════════════════════════════
// GET /api/reservations/unread-count
// Reservations not yet opened by an admin (adminViewedAt is null)
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const count = await prisma.reservation.count({
            where: { adminViewedAt: null, hiddenByAdmin: false },
        })

        return NextResponse.json({ success: true, count })
    } catch (error) {
        console.error("[admin/reservations/unread-count]", error)
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
}
