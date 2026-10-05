// ══════════════════════════════════════════════════════════════════
// Product Review Detail — PATCH (edit own) + DELETE (own)
// Editing forces re-moderation (approved=false). A photo the edit removes, or
// every photo of a deleted review, is deleted when no other review uses it.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { updateProductReviewSchema } from "@wildgrove/core/admin-validation"
import { PRODUCT_REVIEW_CACHE_TAG } from "@wildgrove/core/product-reviews/queries"
import { deleteUnusedReviewPhotos } from "@wildgrove/core/storage-cleanup"
import { isReviewPhotoInFolder, REVIEW_PHOTO_URL_MESSAGE } from "@wildgrove/core/reviews/photo-urls"
import { reviewPhotoFolder } from "@wildgrove/core/reviews/photo-folder"
import { revalidateTag } from "next/cache"
import { z } from "zod"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()
        if (!user) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const data = updateProductReviewSchema.parse(body)

        const review = await prisma.productReview.findUnique({
            where: { id },
            select: { id: true, profileId: true, menuItemId: true, photos: true },
        })
        if (!review) {
            return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
        }
        if (review.profileId !== user.id) {
            return NextResponse.json({ success: false, error: "Not your review" }, { status: 403 })
        }

        // A photo the review did not have yet must come from the author's own folder.
        if (data.photos) {
            const folder = await reviewPhotoFolder(user.id)
            if (data.photos.some((p) => !review.photos.includes(p) && !isReviewPhotoInFolder(p, folder))) {
                return NextResponse.json({ success: false, error: REVIEW_PHOTO_URL_MESSAGE }, { status: 400 })
            }
        }

        if (data.photos && data.photos.length > 0) {
            const settings = await prisma.appSettings.findUnique({ where: { key: "global" } })
            const limit = settings?.reviewPhotoLimit ?? 3
            if (data.photos.length > limit) {
                return NextResponse.json({ success: false, error: `Maximum ${limit} photos allowed` }, { status: 400 })
            }
        }

        const updated = await prisma.productReview.update({
            where: { id },
            data: {
                ...(data.rating !== undefined && { rating: data.rating }),
                ...(data.comment !== undefined && { comment: data.comment }),
                ...(data.photos !== undefined && { photos: data.photos }),
                approved: false,
                hidden: false,
            },
            select: { id: true, rating: true, comment: true, photos: true, approved: true, updatedAt: true },
        })

        await deleteUnusedReviewPhotos(review.photos.filter((url) => !updated.photos.includes(url)))

        revalidateTag(PRODUCT_REVIEW_CACHE_TAG, "default")
        revalidateTag(`product-rating:${review.menuItemId}`, "default")
        revalidateTag(`product-reviews:${review.menuItemId}`, "default")

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: "Validation failed", details: error.issues }, { status: 400 })
        }
        console.error("[Product Review PATCH] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to update review" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()
        if (!user) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
        }

        const { id } = await params
        const review = await prisma.productReview.findUnique({
            where: { id },
            select: { id: true, profileId: true, menuItemId: true, photos: true },
        })
        if (!review) {
            return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
        }
        if (review.profileId !== user.id) {
            return NextResponse.json({ success: false, error: "Not your review" }, { status: 403 })
        }

        await prisma.productReview.delete({ where: { id } })
        await deleteUnusedReviewPhotos(review.photos)

        revalidateTag(PRODUCT_REVIEW_CACHE_TAG, "default")
        revalidateTag(`product-rating:${review.menuItemId}`, "default")
        revalidateTag(`product-reviews:${review.menuItemId}`, "default")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Product Review DELETE] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to delete review" }, { status: 500 })
    }
}
