// ══════════════════════════════════════════════════════════════════
// Public Product Reviews API | GET (approved, per product) + POST
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { createProductReviewSchema } from "@wildgrove/core/admin-validation"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"
import { PRODUCT_REVIEW_CACHE_TAG } from "@wildgrove/core/product-reviews/queries"
import { buildAuthorSnapshot, resolvePublicAuthorName, resolvePublicAvatarUrl } from "@wildgrove/core/reviews/display"
import { isReviewPhotoInFolder, REVIEW_PHOTO_URL_MESSAGE } from "@wildgrove/core/reviews/photo-urls"
import { reviewPhotoFolder } from "@wildgrove/core/reviews/photo-folder"
import { revalidateTag } from "next/cache"
import { z } from "zod"

// ── GET | Approved reviews for a product (paginated) + aggregate ──

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams
        const menuItemId = params.get("menuItemId")
        if (!menuItemId) {
            return NextResponse.json({ success: false, error: "menuItemId is required" }, { status: 400 })
        }
        const page = Math.max(1, Number(params.get("page") || 1))
        const limit = Math.min(50, Math.max(1, Number(params.get("limit") || 10)))

        const where = { menuItemId, approved: true, hidden: false }

        const [reviews, total, aggregate, distRows] = await Promise.all([
            prisma.productReview.findMany({
                where,
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    photos: true,
                    createdAt: true,
                    authorDisplayName: true,
                    authorAvatarUrl: true,
                    pinned: true,
                    profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
                orderBy: [{ pinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.productReview.count({ where }),
            prisma.productReview.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
            prisma.productReview.groupBy({ by: ["rating"], where, _count: { _all: true } }),
        ])

        const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        for (const r of distRows) {
            const k = r.rating as 1 | 2 | 3 | 4 | 5
            if (k >= 1 && k <= 5) distribution[k] = r._count._all
        }

        return NextResponse.json({
            success: true,
            data: {
                reviews: reviews.map((r) => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    photos: (r.photos ?? []).filter((url) => url.trim().length > 0),
                    createdAt: r.createdAt,
                    name: resolvePublicAuthorName(
                        r.authorDisplayName,
                        r.profile.firstName,
                        r.profile.lastName,
                    ),
                    avatarUrl: resolvePublicAvatarUrl(r.authorAvatarUrl, r.profile.avatarUrl),
                    pinned: r.pinned,
                })),
                aggregate: {
                    average: Number(aggregate._avg.rating ?? 0),
                    count: aggregate._count._all,
                    distribution,
                },
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        })
    } catch (error) {
        console.error("[Product Reviews GET] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch product reviews" }, { status: 500 })
    }
}

// ── POST | Submit a product review (authenticated users only) ──

export async function POST(request: NextRequest) {
    try {
        const insforge = await createClient()
        const { data: { user }, error: authError } = await insforge.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
        }

        // Same switch the review forms read through the config route.
        const settings = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { reviewsEnabled: true },
        })
        if (!(settings?.reviewsEnabled ?? true)) {
            return NextResponse.json(
                { success: false, error: "Reviews are turned off", code: "REVIEWS_DISABLED" },
                { status: 403 },
            )
        }

        const body = await request.json()
        const data = createProductReviewSchema.parse(body)

        // Verify the order item belongs to the user, the order is COMPLETED,
        // and its menuItem matches the payload.
        const orderItem = await prisma.orderItem.findUnique({
            where: { id: data.orderItemId },
            select: {
                id: true,
                menuItemId: true,
                orderId: true,
                order: { select: { profileId: true, status: true } },
            },
        })

        if (!orderItem) {
            return NextResponse.json({ success: false, error: "Order item not found" }, { status: 404 })
        }
        if (orderItem.order.profileId !== user.id) {
            return NextResponse.json({ success: false, error: "Not your purchase" }, { status: 403 })
        }
        if (orderItem.order.status !== "COMPLETED") {
            return NextResponse.json(
                { success: false, error: "Only completed orders can be reviewed" },
                { status: 400 },
            )
        }
        if (orderItem.menuItemId !== data.menuItemId) {
            return NextResponse.json(
                { success: false, error: "Order item does not match the product" },
                { status: 400 },
            )
        }

        // Reject if user already reviewed this product
        const existing = await prisma.productReview.findUnique({
            where: { profileId_menuItemId: { profileId: user.id, menuItemId: data.menuItemId } },
            select: { id: true },
        })
        if (existing) {
            return NextResponse.json(
                { success: false, error: "You have already reviewed this product" },
                { status: 409 },
            )
        }

        // Only photos the author uploaded into their own folder, and only as
        // many as the panel allows (shared with Review via reviewPhotoLimit).
        const photos = data.photos ?? []
        const folder = await reviewPhotoFolder(user.id)
        if (photos.some((p) => !isReviewPhotoInFolder(p, folder))) {
            return NextResponse.json({ success: false, error: REVIEW_PHOTO_URL_MESSAGE }, { status: 400 })
        }
        if (photos.length > 0) {
            const settings = await prisma.appSettings.findUnique({ where: { key: "global" } })
            const limit = settings?.reviewPhotoLimit ?? 3
            if (photos.length > limit) {
                return NextResponse.json({ success: false, error: `Maximum ${limit} photos allowed` }, { status: 400 })
            }
        }

        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { firstName: true, lastName: true, avatarUrl: true },
        })
        const authorSnapshot = buildAuthorSnapshot(
            profile ?? { firstName: null, lastName: null, avatarUrl: null },
        )

        const review = await prisma.productReview.create({
            data: {
                profileId:   user.id,
                menuItemId:  data.menuItemId,
                orderItemId: orderItem.id,
                orderId:     orderItem.orderId,
                rating:      data.rating,
                comment:     data.comment,
                photos,
                ...authorSnapshot,
            },
            select: {
                id: true, rating: true, comment: true, photos: true, createdAt: true, approved: true,
                menuItem: { select: { name: true } },
            },
        })

        revalidateTag(PRODUCT_REVIEW_CACHE_TAG, "default")
        revalidateTag(`product-rating:${data.menuItemId}`, "default")
        revalidateTag(`product-reviews:${data.menuItemId}`, "default")

        // Fire-and-forget admin notification
        try {
            await createAdminNotificationForAllAdmins({
                type: "PRODUCT_REVIEW_CREATED",
                entityType: "PRODUCT_REVIEW",
                entityId: review.id,
                title: "New product review submitted",
                message: `${review.menuItem.name} | ${review.rating}/5 stars`,
                // Dish reviews are a tab of /reviews; the panel has no page of its own for them.
                href: `/reviews`,
                metadata: { productReviewId: review.id, menuItemId: data.menuItemId, rating: review.rating },
            })
        } catch (e) {
            console.warn("[Product Reviews POST] admin notification failed:", e)
        }

        return NextResponse.json({ success: true, data: review }, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: "Validation failed", details: error.issues }, { status: 400 })
        }
        console.error("[Product Reviews POST] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to submit review" }, { status: 500 })
    }
}
