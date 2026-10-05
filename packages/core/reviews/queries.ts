// ══════════════════════════════════════════════════════════════════
// Reservation & homepage review queries (cached)
// ══════════════════════════════════════════════════════════════════

import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import type { PublicReviewCardData } from "./types"
import {
    formatPublicReviewDate,
    resolvePublicAuthorName,
    resolvePublicAvatarUrl,
} from "./display"
import { PRODUCT_REVIEW_CACHE_TAG } from "../product-reviews/queries"

export const REVIEW_CACHE_TAG = "reviews"

export interface ReviewsAggregate {
    average: number
    count: number
}

type ReservationReviewRow = {
    id: string
    rating: number
    comment: string
    photos: string[]
    pinned: boolean
    pinnedAt: Date | null
    authorDisplayName: string | null
    authorAvatarUrl: string | null
    createdAt: Date
    profile: { firstName: string | null; lastName: string | null; avatarUrl: string | null }
}

function mapReservationReviewToCard(r: ReservationReviewRow, locale: string): PublicReviewCardData {
    return {
        id: r.id,
        quote: r.comment,
        name: resolvePublicAuthorName(
            r.authorDisplayName,
            r.profile.firstName,
            r.profile.lastName,
        ),
        detail: formatPublicReviewDate(r.createdAt, locale),
        rating: r.rating,
        photos: (r.photos ?? []).filter((url) => url.trim().length > 0),
        avatarUrl: resolvePublicAvatarUrl(r.authorAvatarUrl, r.profile.avatarUrl),
        pinned: r.pinned,
    }
}

const reservationReviewSelect = {
    id: true,
    rating: true,
    comment: true,
    photos: true,
    pinned: true,
    pinnedAt: true,
    authorDisplayName: true,
    authorAvatarUrl: true,
    createdAt: true,
    profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
} as const

/** All approved, visible reservation reviews — default public list on /reservations. */
export const getApprovedReservationReviews = (locale: string) =>
    unstable_cache(
        async (): Promise<PublicReviewCardData[]> => {
            const reviews = await prisma.review.findMany({
                where: { approved: true, hidden: false },
                select: reservationReviewSelect,
                orderBy: [{ pinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
            })
            return reviews.map((r) => mapReservationReviewToCard(r, locale))
        },
        ["approved-reservation-reviews", locale],
        { tags: [REVIEW_CACHE_TAG], revalidate: 300 },
    )()

export const getReservationReviewsAggregate = unstable_cache(
    async (): Promise<ReviewsAggregate> => {
        const result = await prisma.review.aggregate({
            where: { approved: true, hidden: false },
            _avg: { rating: true },
            _count: { _all: true },
        })
        return {
            average: Number(result._avg.rating ?? 0),
            count: result._count._all,
        }
    },
    ["reservation-reviews-aggregate"],
    { tags: [REVIEW_CACHE_TAG], revalidate: 300 },
)

type HomePinnedRow =
    | ({ kind: "reservation" } & ReservationReviewRow)
    | {
          kind: "product"
          id: string
          rating: number
          comment: string
          photos: string[]
          pinned: boolean
          pinnedAt: Date | null
          authorDisplayName: string | null
          authorAvatarUrl: string | null
          createdAt: Date
          profile: { firstName: string | null; lastName: string | null; avatarUrl: string | null }
      }

function sortPinnedRows<T extends { pinnedAt: Date | null; createdAt: Date }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
        const aPin = a.pinnedAt?.getTime() ?? 0
        const bPin = b.pinnedAt?.getTime() ?? 0
        if (bPin !== aPin) return bPin - aPin
        return b.createdAt.getTime() - a.createdAt.getTime()
    })
}

/** Pinned reservation + product reviews for homepage testimonials. */
export const getHomePinnedReviews = (locale: string) =>
    unstable_cache(
        async (): Promise<PublicReviewCardData[]> => {
            const [reservationRows, productRows] = await Promise.all([
                prisma.review.findMany({
                    where: { approved: true, hidden: false, pinned: true },
                    select: reservationReviewSelect,
                }),
                prisma.productReview.findMany({
                    where: { approved: true, hidden: false, pinned: true },
                    select: {
                        id: true,
                        rating: true,
                        comment: true,
                        photos: true,
                        pinned: true,
                        pinnedAt: true,
                        authorDisplayName: true,
                        authorAvatarUrl: true,
                        createdAt: true,
                        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
                    },
                }),
            ])

            const merged: HomePinnedRow[] = [
                ...reservationRows.map((r) => ({ kind: "reservation" as const, ...r })),
                ...productRows.map((r) => ({ kind: "product" as const, ...r })),
            ]

            return sortPinnedRows(merged).map((row) => {
                if (row.kind === "reservation") {
                    return mapReservationReviewToCard(row, locale)
                }
                return {
                    id: `product:${row.id}`,
                    quote: row.comment,
                    name: resolvePublicAuthorName(
                        row.authorDisplayName,
                        row.profile.firstName,
                        row.profile.lastName,
                    ),
                    detail: formatPublicReviewDate(row.createdAt, locale),
                    rating: row.rating,
                    photos: (row.photos ?? []).filter((url) => url.trim().length > 0),
                    avatarUrl: resolvePublicAvatarUrl(row.authorAvatarUrl, row.profile.avatarUrl),
                    pinned: true,
                }
            })
        },
        ["home-pinned-reviews", locale],
        { tags: [REVIEW_CACHE_TAG, PRODUCT_REVIEW_CACHE_TAG], revalidate: 300 },
    )()

export const getHomePinnedReviewsAggregate = unstable_cache(
    async (): Promise<ReviewsAggregate> => {
        const [reservation, product] = await Promise.all([
            prisma.review.findMany({
                where: { approved: true, hidden: false, pinned: true },
                select: { rating: true },
            }),
            prisma.productReview.findMany({
                where: { approved: true, hidden: false, pinned: true },
                select: { rating: true },
            }),
        ])
        const ratings = [...reservation.map((r) => r.rating), ...product.map((r) => r.rating)]
        if (ratings.length === 0) return { average: 0, count: 0 }
        const sum = ratings.reduce((acc, n) => acc + n, 0)
        return { average: sum / ratings.length, count: ratings.length }
    },
    ["home-pinned-reviews-aggregate"],
    { tags: [REVIEW_CACHE_TAG, PRODUCT_REVIEW_CACHE_TAG], revalidate: 300 },
)
