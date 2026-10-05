import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { PublicReviewCard } from "@/components/reviews/PublicReviewCard"
import { RatingStars } from "@/components/product-reviews/RatingStars"
import {
    getHomePinnedReviews,
    getHomePinnedReviewsAggregate,
} from "@wildgrove/core/reviews/queries"
import { getLocale, getTranslations } from "next-intl/server"

export async function TestimonialsSection() {
    const [t, locale] = await Promise.all([getTranslations("testimonials"), getLocale()])

    let testimonials: Awaited<ReturnType<typeof getHomePinnedReviews>>
    let aggregate: Awaited<ReturnType<typeof getHomePinnedReviewsAggregate>>
    try {
        ;[testimonials, aggregate] = await Promise.all([
            getHomePinnedReviews(locale),
            getHomePinnedReviewsAggregate(),
        ])
        if (testimonials.length === 0) return null
    } catch {
        return null
    }

    return (
        <SectionWrapper className="relative bg-wg-bg dark:bg-wg-dark-bg overflow-hidden">
            <div
                className="pointer-events-none absolute inset-0 max-h-[520px] bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(58,90,64,0.07),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(90,138,96,0.08),transparent)]"
                aria-hidden="true"
            />

            <div className="relative text-center mb-12 sm:mb-14">
                <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                    {t("subtitle")}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-wg-text dark:text-wg-dark-text">
                    {t("title")}
                </h2>
                {aggregate.count > 0 && (
                    <div className="mt-6 flex flex-col items-center gap-2.5">
                        <RatingStars value={aggregate.average} size="xl" />
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                            {t("summary", {
                                average: aggregate.average.toFixed(1),
                                count: aggregate.count,
                            })}
                        </p>
                    </div>
                )}
            </div>

            <ul className="relative flex flex-wrap justify-center items-start gap-5 sm:gap-6 lg:gap-8 list-none p-0 m-0">
                {testimonials.map((testimonial, index) => (
                    <li
                        key={testimonial.id}
                        className="flex justify-center w-full sm:w-auto sm:flex-none sm:max-w-[20rem]"
                        data-animate=""
                        style={{ transitionDelay: `${index * 100}ms` }}
                    >
                        <PublicReviewCard
                            review={testimonial}
                            pinnedLabel={t("pinnedBadge")}
                        />
                    </li>
                ))}
            </ul>
        </SectionWrapper>
    )
}
