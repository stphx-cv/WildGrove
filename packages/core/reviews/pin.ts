import { prisma } from "@wildgrove/db"
import { MAX_HOME_PINNED_REVIEWS, MAX_PRODUCT_PINNED_REVIEWS } from "./display"

export async function countHomePinnedReviews(excludeId?: string): Promise<number> {
    return prisma.review.count({
        where: {
            pinned: true,
            approved: true,
            hidden: false,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
    })
}

export async function countProductPinnedReviews(menuItemId: string, excludeId?: string): Promise<number> {
    return prisma.productReview.count({
        where: {
            menuItemId,
            pinned: true,
            approved: true,
            hidden: false,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
    })
}

export function homePinLimitError(): string {
    return `Maximum ${MAX_HOME_PINNED_REVIEWS} reviews can be pinned on the homepage`
}

export function productPinLimitError(): string {
    return `Maximum ${MAX_PRODUCT_PINNED_REVIEWS} reviews can be pinned per product`
}
