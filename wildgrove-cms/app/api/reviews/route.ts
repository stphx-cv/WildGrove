// ══════════════════════════════════════════════════════════════════
// Admin Reviews API — GET (list all reviews, filterable)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { reviewListQuerySchema } from "@wildgrove/core/admin-validation"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = reviewListQuerySchema.parse(params)

        const where: Record<string, unknown> = {}
        if (query.approved === "hidden") {
            where.hidden = true
        } else {
            where.hidden = false
            if (query.approved !== "all") {
                where.approved = query.approved === "true"
            }
        }

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where,
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    photos: true,
                    approved: true,
                    hidden: true,
                    pinned: true,
                    authorDisplayName: true,
                    authorAvatarUrl: true,
                    createdAt: true,
                    profile: { select: { id: true, firstName: true, lastName: true, email: true } },
                    reservation: { select: { id: true, date: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.review.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                reviews,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                },
            },
        })
    } catch (error) {
        console.error("[Admin Reviews GET] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch reviews" }, { status: 500 })
    }
}
