// ══════════════════════════════════════════════════════════════════
// Admin Dashboard Stats API — GET /api/stats
// Returns aggregated counts for the dashboard StatCards
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json(
            { success: false, error: auth.error },
            { status: auth.status }
        )
    }

    try {
        // Date boundaries for time-based queries
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        // Run all count queries in parallel — never use findMany for counts
        const [
            reservationsToday,
            reservationsThisWeek,
            reservationsPending,
            customersTotal,
            customersNewThisWeek,
            chatsWaiting,
            chatsTotal,
            menuTotalItems,
            menuUnavailable,
        ] = await Promise.all([
            prisma.reservation.count({
                where: { date: { gte: todayStart, lt: todayEnd }, hiddenByAdmin: false },
            }),
            prisma.reservation.count({
                where: { date: { gte: weekAgo }, hiddenByAdmin: false },
            }),
            prisma.reservation.count({
                where: { status: "PENDING", hiddenByAdmin: false },
            }),
            prisma.profile.count({
                where: { role: "CUSTOMER" },
            }),
            prisma.profile.count({
                where: { role: "CUSTOMER", createdAt: { gte: weekAgo } },
            }),
            prisma.chatSession.count({
                where: { status: "WAITING" },
            }),
            prisma.chatSession.count(),
            prisma.menuItem.count(),
            prisma.menuItem.count({
                where: { available: false },
            }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                reservations: {
                    today: reservationsToday,
                    thisWeek: reservationsThisWeek,
                    pending: reservationsPending,
                },
                customers: {
                    total: customersTotal,
                    newThisWeek: customersNewThisWeek,
                },
                chats: {
                    waiting: chatsWaiting,
                    total: chatsTotal,
                },
                menu: {
                    totalItems: menuTotalItems,
                    unavailable: menuUnavailable,
                },
            },
        })
    } catch (error) {
        console.error("[Admin Stats] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch dashboard stats" },
            { status: 500 }
        )
    }
}
