// ══════════════════════════════════════════════════════════════════
// Admin Review Detail — PATCH (approve/reject/pin) + DELETE
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateReviewSchema } from "@wildgrove/core/admin-validation"
import { MAX_HOME_PINNED_REVIEWS } from "@wildgrove/core/reviews/display"
import { countHomePinnedReviews, homePinLimitError } from "@wildgrove/core/reviews/pin"
import { revalidatePublic } from "@/lib/revalidate-public"
import { deleteUnusedReviewPhotos } from "@wildgrove/core/storage-cleanup"

// ── PATCH — Approve, hide, or pin a review ──

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
        const data = updateReviewSchema.parse(body)

        const review = await prisma.review.findUnique({
            where: { id },
            select: { id: true, approved: true, hidden: true, pinned: true },
        })
        if (!review) {
            return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
        }

        if (data.pinned === true) {
            const willBeApproved = data.approved ?? review.approved
            const willBeHidden = data.hidden ?? review.hidden
            if (!willBeApproved || willBeHidden) {
                return NextResponse.json(
                    { success: false, error: "Only approved, visible reviews can be pinned on the homepage" },
                    { status: 400 },
                )
            }
            const pinnedCount = await countHomePinnedReviews(id)
            if (pinnedCount >= MAX_HOME_PINNED_REVIEWS) {
                return NextResponse.json({ success: false, error: homePinLimitError() }, { status: 400 })
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
            if (!data.pinned) {
                // no extra checks
            } else if ((data.approved === false) || (data.hidden === true)) {
                return NextResponse.json(
                    { success: false, error: "Cannot pin while revoking approval or hiding" },
                    { status: 400 },
                )
            }
        }

        // Unpin automatically when hiding or revoking approval
        const nextApproved = data.approved ?? review.approved
        const nextHidden = data.hidden ?? review.hidden
        if ((data.approved === false || data.hidden === true) && (review.pinned || data.pinned)) {
            updateData.pinned = false
            updateData.pinnedAt = null
        }

        if (data.pinned === true && (!nextApproved || nextHidden)) {
            return NextResponse.json(
                { success: false, error: "Only approved, visible reviews can be pinned on the homepage" },
                { status: 400 },
            )
        }

        const updated = await prisma.review.update({
            where: { id },
            data: updateData,
            select: { id: true, approved: true, hidden: true, pinned: true, pinnedAt: true },
        })

        await revalidatePublic("reviews")

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        console.error("[Admin Review PATCH] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to update review" }, { status: 500 })
    }
}

// ── DELETE — Remove a review ──

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
        const review = await prisma.review.findUnique({ where: { id }, select: { id: true, photos: true } })
        if (!review) {
            return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
        }

        await prisma.review.delete({ where: { id } })
        await deleteUnusedReviewPhotos(review.photos)
        await revalidatePublic("reviews")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Admin Review DELETE] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to delete review" }, { status: 500 })
    }
}
