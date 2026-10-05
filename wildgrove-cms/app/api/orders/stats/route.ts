// ══════════════════════════════════════════════════════════════════
// Admin Orders Stats — GET /api/orders/stats
// KPIs for the dashboard: orders today, revenue today, pending count
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { Prisma } from "@wildgrove/db"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

        const [ordersToday, pendingOrders, revenueToday] = await Promise.all([
            prisma.order.count({
                where: {
                    createdAt: { gte: todayStart, lt: todayEnd },
                    status: { notIn: ["CANCELLED", "REFUNDED"] },
                    hiddenByAdmin: false,
                },
            }),
            prisma.order.count({
                where: { status: { in: ["PENDING", "PREPARING"] }, hiddenByAdmin: false },
            }),
            prisma.order.aggregate({
                where: {
                    createdAt: { gte: todayStart, lt: todayEnd },
                    status: { notIn: ["CANCELLED", "REFUNDED"] },
                    hiddenByAdmin: false,
                    currency: "PEN",
                },
                _sum: { total: true },
            }),
        ])

        const revenuePen: number = revenueToday._sum.total
            ? new Prisma.Decimal(revenueToday._sum.total).toNumber()
            : 0

        return NextResponse.json({
            success: true,
            data: {
                ordersToday,
                pendingOrders,
                revenuePen,
            },
        })
    } catch (error) {
        console.error("[admin/orders/stats GET]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch order stats" }, { status: 500 })
    }
}
