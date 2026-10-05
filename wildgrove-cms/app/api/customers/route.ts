// ══════════════════════════════════════════════════════════════════
// Admin Customers API — GET /api/customers
// Read-only list of all profiles (any role) with reservation counts
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { customerListQuerySchema } from "@wildgrove/core/admin-validation"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = customerListQuerySchema.parse(params)

        const where: Record<string, unknown> = {}
        if (query.status === "complete") where.connections = { isEmpty: false }
        if (query.status === "incomplete") where.connections = { isEmpty: true }
        if (query.search) {
            where.OR = [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { username: { contains: query.search, mode: "insensitive" } },
            ]
        }

        const [items, total] = await Promise.all([
            prisma.profile.findMany({
                where,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    email: true,
                    avatarUrl: true,
                    phoneNumber: true,
                    phoneCountryCode: true,
                    role: true,
                    connections: true,
                    createdAt: true,
                    _count: { select: { reservations: true, chatSessions: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.profile.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                items: items.map((item) => ({
                    ...item,
                    reservationCount: item._count.reservations,
                    messageCount: item._count.chatSessions,
                    _count: undefined,
                })),
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                },
            },
        })
    } catch (error) {
        console.error("[Admin Customers GET] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch customers" },
            { status: 500 }
        )
    }
}
