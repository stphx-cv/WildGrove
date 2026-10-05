// ══════════════════════════════════════════════════════════════════
// Admin Orders API — GET /api/orders
// Paginated list with filters (status, fulfillment, date, search, visibility)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { orderListQuerySchema } from "@wildgrove/core/admin-validation"
import { Prisma } from "@wildgrove/db"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = orderListQuerySchema.parse(params)

        const where: Prisma.OrderWhereInput = {}

        if (query.visibility === "hidden") where.hiddenByAdmin = true
        else if (query.visibility !== "all") where.hiddenByAdmin = false

        if (query.status) where.status = query.status
        if (query.fulfillment) where.fulfillment = query.fulfillment

        if (query.date) {
            const dateStart = new Date(query.date)
            const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)
            where.createdAt = { gte: dateStart, lt: dateEnd }
        }

        if (query.search) {
            const numericSearch = parseInt(query.search, 10)
            where.OR = [
                ...(isNaN(numericSearch) ? [] : [{ orderNumber: numericSearch }]),
                { customerName: { contains: query.search, mode: "insensitive" as const } },
                {
                    profile: {
                        OR: [
                            { firstName: { contains: query.search, mode: "insensitive" as const } },
                            { lastName: { contains: query.search, mode: "insensitive" as const } },
                            { email: { contains: query.search, mode: "insensitive" as const } },
                        ],
                    },
                },
            ]
        }

        const skip = (query.page - 1) * query.limit

        const [items, total] = await Promise.all([
            prisma.order.findMany({
                where,
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    fulfillment: true,
                    currency: true,
                    total: true,
                    paymentMethod: true,
                    scheduledFor: true,
                    createdAt: true,
                    customerName: true,
                    customerPhone: true,
                    hiddenByAdmin: true,
                    profile: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    items: {
                        select: { nameSnapshot: true, quantity: true },
                        take: 3,
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: query.limit,
            }),
            prisma.order.count({ where }),
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
        console.error("[admin/orders GET]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch orders" }, { status: 500 })
    }
}
