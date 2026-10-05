// ══════════════════════════════════════════════════════════════════
// Server component — reviews block for /menu/[slug] product pages.
// Renders only when AppSettings.reviewsEnabled is true.
// ══════════════════════════════════════════════════════════════════

import { getTranslations } from "next-intl/server"
import { PublicReviewCard } from "@/components/reviews/PublicReviewCard"
import { getAppSettings } from "@wildgrove/core/settings"
import { getProductRatingAggregate, getProductReviews } from "@wildgrove/core/product-reviews/queries"
import { formatPublicReviewDate } from "@wildgrove/core/reviews/display"
import { RatingSummary } from "./RatingSummary"
import { StarSolidIcon } from "@wildgrove/ui/icons"

interface ProductReviewsSectionProps {
    menuItemId: string
    locale: string
}

export async function ProductReviewsSection({ menuItemId, locale }: ProductReviewsSectionProps) {
    const settings = await getAppSettings()
    if (!settings.reviewsEnabled) return null

    const [aggregate, list, t] = await Promise.all([
        getProductRatingAggregate(menuItemId),
        getProductReviews(menuItemId, 1, 6),
        getTranslations("productReviews"),
    ])

    return (
        <section className="mt-16 sm:mt-20" id="reviews" aria-labelledby="product-reviews-heading">
            <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-wg-border/60 dark:bg-wg-dark-border/60" />
                <StarSolidIcon className="w-4 h-4 text-wg-accent dark:text-wg-dark-accent" />
                <div className="h-px flex-1 bg-wg-border/60 dark:bg-wg-dark-border/60" />
            </div>

            <h2
                id="product-reviews-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text text-center mb-8"
            >
                {t("sectionTitle")}
            </h2>

            {aggregate.count === 0 ? (
                <p className="text-center text-sm text-wg-muted dark:text-wg-dark-muted">
                    {t("noReviewsYet")}
                </p>
            ) : (
                <>
                    <div className="max-w-2xl mx-auto mb-10">
                        <RatingSummary
                            average={aggregate.average}
                            count={aggregate.count}
                            distribution={aggregate.distribution}
                            labels={{
                                averageOf: t("averageOf", {
                                    average: aggregate.average.toFixed(1),
                                }),
                                reviewCount: t("reviewCount", { count: aggregate.count }),
                            }}
                        />
                    </div>

                    <ul className="flex flex-wrap justify-center items-start gap-5 sm:gap-6 list-none p-0 m-0">
                        {list.reviews.map((r) => (
                            <li
                                key={r.id}
                                className="flex justify-center w-full sm:w-auto sm:flex-none sm:max-w-[20rem]"
                            >
                                <PublicReviewCard
                                    review={{
                                        id: r.id,
                                        quote: r.comment,
                                        name: r.authorName,
                                        detail: formatPublicReviewDate(r.createdAt, locale),
                                        rating: r.rating,
                                        photos: r.photos,
                                        avatarUrl: r.avatarUrl,
                                        pinned: r.pinned,
                                    }}
                                    pinnedLabel={t("pinnedBadge")}
                                />
                            </li>
                        ))}
                    </ul>

                    {list.total > list.reviews.length && (
                        <p className="mt-6 text-center text-xs text-wg-muted dark:text-wg-dark-muted">
                            {t("showingOf", { showing: list.reviews.length, total: list.total })}
                        </p>
                    )}
                </>
            )}
        </section>
    )
}
