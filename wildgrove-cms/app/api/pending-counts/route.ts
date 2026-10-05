// ══════════════════════════════════════════════════════════════════
// GET /api/pending-counts
// Every badge count the sidebar needs, in one request.
//
// The sidebar refreshes its badges every 30 s. Asking for each count on its own
// route means seven requests, and on a serverless host each one lands on its own
// isolate with its own pg pool, so one panel load opens about eleven Postgres
// connections at once. That is enough to hit P2037 ("too many clients already")
// and leave the panel dead.
//
// One route, one requireAdmin(), one $transaction: one connection, one round
// trip. The individual /api/*/pending-count routes are kept, because they are
// cheap and other callers may still use them, but the sidebar no longer fans
// out.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"

// Reads auth cookies and live counts — never cached.
export const dynamic = "force-dynamic"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const [
            tickets,
            reviews,
            productReviews,
            orders,
            unreadReservations,
            unreadNotifications,
        ] = await prisma.$transaction([
            prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
            prisma.review.count({ where: { approved: false, hidden: false } }),
            prisma.productReview.count({ where: { approved: false, hidden: false } }),
            prisma.order.count({ where: { status: { in: ["PENDING", "PREPARING"] }, hiddenByAdmin: false } }),
            prisma.reservation.count({ where: { adminViewedAt: null, hiddenByAdmin: false } }),
            prisma.adminNotification.count({ where: { adminId: auth.userId, isRead: false } }),
        ])

        return NextResponse.json({
            success: true,
            counts: {
                tickets,
                reviews,
                productReviews,
                orders,
                unreadReservations,
                unreadNotifications,
            },
        })
    } catch (error) {
        console.error("[cms/pending-counts]", error)
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
}
