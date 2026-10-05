// ══════════════════════════════════════════════════════════════════
// Public Reviews API — GET (approved) + POST (submit)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { createReviewSchema } from "@wildgrove/core/admin-validation"
import { buildAuthorSnapshot } from "@wildgrove/core/reviews/display"
import { revalidateTag } from "next/cache"
import { isReviewPhotoInFolder, REVIEW_PHOTO_URL_MESSAGE } from "@wildgrove/core/reviews/photo-urls"
import { reviewPhotoFolder } from "@wildgrove/core/reviews/photo-folder"

// ── GET — Public approved reviews (paginated) ──

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams
        const page = Math.max(1, Number(params.get("page") || 1))
        const limit = Math.min(50, Math.max(1, Number(params.get("limit") || 10)))

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: { approved: true, hidden: false },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    profile: { select: { firstName: true, lastName: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.review.count({ where: { approved: true, hidden: false } }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                reviews: reviews.map((r) => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.createdAt,
                    name: [r.profile.firstName, r.profile.lastName?.[0]].filter(Boolean).join(" ") + "." || "Guest",
                })),
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        })
    } catch (error) {
        console.error("[Reviews GET] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch reviews" }, { status: 500 })
    }
}

// ── POST — Submit a review (authenticated users only) ──

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
        const data = createReviewSchema.parse(body)

        // Verify the reservation belongs to this user and is COMPLETED
        const reservation = await prisma.reservation.findUnique({
            where: { id: data.reservationId },
            select: { profileId: true, status: true, review: { select: { id: true } } },
        })

        if (!reservation) {
            return NextResponse.json({ success: false, error: "Reservation not found" }, { status: 404 })
        }

        if (reservation.profileId !== user.id) {
            return NextResponse.json({ success: false, error: "Not your reservation" }, { status: 403 })
        }

        if (reservation.status !== "COMPLETED") {
            return NextResponse.json(
                { success: false, error: "Only completed reservations can be reviewed" },
                { status: 400 }
            )
        }

        if (reservation.review) {
            return NextResponse.json(
                { success: false, error: "This reservation already has a review" },
                { status: 409 }
            )
        }

        // Only photos the author uploaded into their own folder of this
        // project's storage are stored, and only as many as the panel allows.
        const submittedPhotos: unknown[] = Array.isArray(body.photos) ? body.photos : []
        const folder = await reviewPhotoFolder(user.id)
        if (submittedPhotos.some((p) => !isReviewPhotoInFolder(p, folder))) {
            return NextResponse.json(
                { success: false, error: REVIEW_PHOTO_URL_MESSAGE },
                { status: 400 }
            )
        }
        const photos = submittedPhotos as string[]
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

        const review = await prisma.review.create({
            data: {
                profileId: user.id,
                reservationId: data.reservationId,
                rating: data.rating,
                comment: data.comment,
                photos,
                ...authorSnapshot,
            },
            select: { id: true, rating: true, comment: true, photos: true, createdAt: true },
        })

        revalidateTag("reviews", "default")

        return NextResponse.json({ success: true, data: review }, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json({ success: false, error: "Validation failed", details: error }, { status: 400 })
        }
        console.error("[Reviews POST] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to submit review" }, { status: 500 })
    }
}
