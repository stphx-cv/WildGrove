// ══════════════════════════════════════════════════════════════════
// Admin Reservations API — GET /api/reservations
// Paginated list with filters (status, date, search, visibility)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma, Prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { reservationListQuerySchema } from "@wildgrove/core/admin-validation"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = reservationListQuerySchema.parse(params)

        const where: Prisma.ReservationWhereInput = {}

        if (query.visibility === "hidden") where.hiddenByAdmin = true
        else if (query.visibility !== "all") where.hiddenByAdmin = false

        if (query.status) where.status = query.status
        if (query.date) {
            // A Lima calendar day: from Lima midnight, 24 hours (Lima has no DST).
            const dateStart = limaSlotStart(query.date, "00:00")
            const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)
            where.date = { gte: dateStart, lt: dateEnd }
        }
        if (query.search) {
            where.profile = {
                OR: [
                    { firstName: { contains: query.search, mode: "insensitive" } },
                    { lastName: { contains: query.search, mode: "insensitive" } },
                    { email: { contains: query.search, mode: "insensitive" } },
                ],
            }
        }

        const [items, total] = await Promise.all([
            prisma.reservation.findMany({
                where,
                select: {
                    id: true,
                    date: true,
                    partySize: true,
                    notes: true,
                    status: true,
                    adminViewedAt: true,
                    hiddenByAdmin: true,
                    createdAt: true,
                    profile: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                },
                orderBy: { date: "desc" },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.reservation.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                items,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                },
            },
        })
    } catch (error) {
        console.error("[Admin Reservations GET] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch reservations" },
            { status: 500 }
        )
    }
}
