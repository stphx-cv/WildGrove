// ══════════════════════════════════════════════════════════════════
// Admin Product Review Detail — PATCH (approve/hide/pin) + DELETE
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateAdminProductReviewSchema } from "@wildgrove/core/admin-validation"
import { MAX_PRODUCT_PINNED_REVIEWS } from "@wildgrove/core/reviews/display"
import { countProductPinnedReviews, productPinLimitError } from "@wildgrove/core/reviews/pin"
import { PRODUCT_REVIEW_CACHE_TAG } from "@wildgrove/core/product-reviews/queries"
import { revalidatePublic } from "@/lib/revalidate-public"
import { deleteUnusedReviewPhotos } from "@wildgrove/core/storage-cleanup"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const { id } = await params
        const body = await request.json()
        const data = updateAdminProductReviewSchema.parse(body)

        const review = await prisma.productReview.findUnique({
            where: { id },
            select: { id: true, menuItemId: true, approved: true, hidden: true, pinned: true },
        })
        if (!review) {
            return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
        }

        if (data.pinned === true) {
            const willBeApproved = data.approved ?? review.approved
            const willBeHidden = data.hidden ?? review.hidden
            if (!willBeApproved || willBeHidden) {
                return NextResponse.json(
                    { success: false, error: "Only approved, visible reviews can be pinned on the product page" },
                    { status: 400 },
                )
            }
            const pinnedCount = await countProductPinnedReviews(review.menuItemId, id)
            if (pinnedCount >= MAX_PRODUCT_PINNED_REVIEWS) {
                return NextResponse.json({ success: false, error: productPinLimitError() }, { status: 400 })
            }
        }

        const updateData: {
            approved?: boolean
            hidden?: boolean
            pinned?: boolean
            pinnedAt?: Date | null
        } = {}

        if (data.approved !== undefined) updateData.approved = data.approved
        if (data.hidden !== undefined) updateData.hidden = data.hidden

        if (data.pinned !== undefined) {
            updateData.pinned = data.pinned
            updateData.pinnedAt = data.pinned ? new Date() : null
        }

        const nextApproved = data.approved ?? review.approved
        const nextHidden = data.hidden ?? review.hidden
        if (data.approved === false || data.hidden === true) {
            updateData.pinned = false
            updateData.pinnedAt = null
        }

        if (data.pinned === true && (!nextApproved || nextHidden)) {
            return NextResponse.json(
                { success: false, error: "Only approved, visible reviews can be pinned on the product page" },
                { status: 400 },
            )
        }

        const updated = await prisma.productReview.update({
            where: { id },
            data: updateData,
            select: { id: true, approved: true, hidden: true, pinned: true, pinnedAt: true },
        })

        await revalidatePublic(
            PRODUCT_REVIEW_CACHE_TAG,
            "reviews",
            `product-rating:${review.menuItemId}`,
            `product-reviews:${review.menuItemId}`,
        )

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        console.error("[Admin Product Review PATCH] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to update review" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const { id } = await params
        const review = await prisma.productReview.findUnique({
            where: { id },
            select: { id: true, menuItemId: true, photos: true },
        })
        if (!review) {
            return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
        }

        await prisma.productReview.delete({ where: { id } })
        await deleteUnusedReviewPhotos(review.photos)

        await revalidatePublic(
            PRODUCT_REVIEW_CACHE_TAG,
            "reviews",
            `product-rating:${review.menuItemId}`,
            `product-reviews:${review.menuItemId}`,
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Admin Product Review DELETE] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to delete review" }, { status: 500 })
    }
}
