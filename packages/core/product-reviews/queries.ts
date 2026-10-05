// ══════════════════════════════════════════════════════════════════
// Product Reviews — server-side query helpers (cached)
// ══════════════════════════════════════════════════════════════════

import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import {
    resolvePublicAuthorName,
    resolvePublicAvatarUrl,
} from "../reviews/display"

const CACHE_TAG = "product-reviews"

export interface AggregateRating {
    average: number
    count: number
    distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface PublicProductReview {
    id: string
    rating: number
    comment: string
    photos: string[]
    /** ISO-8601 string (cacheable across server boundaries). */
    createdAt: string
    authorName: string
    avatarUrl: string | null
    pinned: boolean
}

function buildDistribution(rows: Array<{ rating: number; _count: { _all: number } }>): AggregateRating["distribution"] {
    const dist: AggregateRating["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const row of rows) {
        const k = row.rating as 1 | 2 | 3 | 4 | 5
        if (k >= 1 && k <= 5) dist[k] = row._count._all
    }
    return dist
}

/**
 * Aggregate rating for a single MenuItem (cached).
 * Returns count=0 / average=0 when no approved reviews exist.
 */
export const getProductRatingAggregate = (menuItemId: string) =>
    unstable_cache(
        async (): Promise<AggregateRating> => {
            const [grouped, total] = await Promise.all([
                prisma.productReview.groupBy({
                    by: ["rating"],
                    where: { menuItemId, approved: true, hidden: false },
                    _count: { _all: true },
                }),
                prisma.productReview.aggregate({
                    where: { menuItemId, approved: true, hidden: false },
                    _avg: { rating: true },
                    _count: { _all: true },
                }),
            ])
            return {
                average: Number(total._avg.rating ?? 0),
                count: total._count._all,
                distribution: buildDistribution(grouped),
            }
        },
        ["product-rating-aggregate", menuItemId],
        { tags: [CACHE_TAG, `product-rating:${menuItemId}`], revalidate: 300 },
    )()

/**
 * List of menuItemId → aggregate rows. Returns a plain array so unstable_cache
 * can serialize it (Map is not JSON-serializable). The consumer rebuilds the
 * Map when needed.
 */
export const getProductRatings = unstable_cache(
    async (): Promise<Array<{ menuItemId: string; average: number; count: number }>> => {
        const rows = await prisma.productReview.groupBy({
            by: ["menuItemId"],
            where: { approved: true, hidden: false },
            _avg: { rating: true },
            _count: { _all: true },
        })
        return rows.map((r) => ({
            menuItemId: r.menuItemId,
            average: Number(r._avg.rating ?? 0),
            count: r._count._all,
        }))
    },
    ["product-ratings-map"],
    { tags: [CACHE_TAG], revalidate: 300 },
)

/**
 * Paginated list of approved reviews for a product, anonymized for public display.
 */
export const getProductReviews = (menuItemId: string, page = 1, limit = 6) =>
    unstable_cache(
        async (): Promise<{ reviews: PublicProductReview[]; total: number }> => {
            const [rows, total] = await Promise.all([
                prisma.productReview.findMany({
                    where: { menuItemId, approved: true, hidden: false },
                    select: {
                        id: true,
                        rating: true,
                        comment: true,
                        photos: true,
                        pinned: true,
                        authorDisplayName: true,
                        authorAvatarUrl: true,
                        createdAt: true,
                        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
                    },
                    orderBy: [{ pinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.productReview.count({ where: { menuItemId, approved: true, hidden: false } }),
            ])
            return {
                reviews: rows.map((r) => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    photos: (r.photos ?? []).filter((url) => url.trim().length > 0),
                    createdAt: r.createdAt.toISOString(),
                    authorName: resolvePublicAuthorName(
                        r.authorDisplayName,
                        r.profile.firstName,
                        r.profile.lastName,
                    ),
                    avatarUrl: resolvePublicAvatarUrl(r.authorAvatarUrl, r.profile.avatarUrl),
                    pinned: r.pinned,
                })),
                total,
            }
        },
        ["product-reviews-list", menuItemId, String(page), String(limit)],
        { tags: [CACHE_TAG, `product-reviews:${menuItemId}`], revalidate: 300 },
    )()

export const PRODUCT_REVIEW_CACHE_TAG = CACHE_TAG
