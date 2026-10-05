// ══════════════════════════════════════════════════════════════════
// Admin Product Reviews API — GET (list, filterable)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { adminProductReviewListQuerySchema } from "@wildgrove/core/admin-validation"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = adminProductReviewListQuerySchema.parse(params)

        const where: Record<string, unknown> = {}
        if (query.approved === "hidden") {
            where.hidden = true
        } else {
            where.hidden = false
            if (query.approved !== "all") {
                where.approved = query.approved === "true"
            }
        }
        if (query.menuItemId) {
            where.menuItemId = query.menuItemId
        }

        const [reviews, total] = await Promise.all([
            prisma.productReview.findMany({
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
                    updatedAt: true,
                    orderId: true,
                    profile: { select: { id: true, firstName: true, lastName: true, email: true } },
                    menuItem: { select: { id: true, name: true, slug: true, imageUrl: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.productReview.count({ where }),
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
        console.error("[Admin Product Reviews GET] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch product reviews" }, { status: 500 })
    }
}
