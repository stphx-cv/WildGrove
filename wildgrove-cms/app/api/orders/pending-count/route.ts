// ══════════════════════════════════════════════════════════════════
// Admin Orders Pending Count — GET /api/orders/pending-count
// Used by AdminSidebar to display a badge on the Orders nav item.
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
        const count = await prisma.order.count({
            where: { status: { in: ["PENDING", "PREPARING"] }, hiddenByAdmin: false },
        })
        return NextResponse.json({ success: true, count })
    } catch (error) {
        console.error("[admin/orders/pending-count GET]", error)
        return NextResponse.json({ success: false, count: 0 })
    }
}
