// ══════════════════════════════════════════════════════════════════
// GET /api/tickets/pending-count
// Returns count of OPEN + IN_PROGRESS tickets for sidebar badge
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
        const count = await prisma.ticket.count({
            where: {
                status: { in: ["OPEN", "IN_PROGRESS"] },
            },
        })

        return NextResponse.json({ success: true, count })
    } catch (error) {
        console.error("[admin/tickets/pending-count]", error)
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
}
