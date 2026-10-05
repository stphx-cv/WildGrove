"use client"

import { useMemo } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { Link } from "@/i18n/routing"
import { Badge } from "@wildgrove/ui/Badge"
import { CurrencyAmount } from "@/components/currency/CurrencyAmount"
import { DiscountBadge } from "@/components/currency/DiscountBadge"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { resolveMenuItemPriceForPreference } from "@wildgrove/core/menu-display-price"
import {
    getDiscountForItem,
    computeDiscountedPrice,
    type ActiveMenuDiscount,
} from "@wildgrove/core/menu-discounts"
import { RatingStars } from "@/components/product-reviews/RatingStars"

export interface FeaturedDishCardDish {
    id: string
    slug: string
    slugEs: string | null
    name: string
    nameEs: string | null
    description: string
    descriptionEs: string | null
    prices: { PEN?: number; USD?: number }
    imageUrl: string | null
    tags: string[]
    tagsEs: string[]
    tagColors: unknown
    categoryId: string
}

interface FeaturedDishCardProps {
    dish: FeaturedDishCardDish
    locale: string
    discounts: ActiveMenuDiscount[]
    rating?: { average: number; count: number }
    index: number
    dishesCount: number
}

export function FeaturedDishCard({ dish, locale, discounts, rating, index, dishesCount }: FeaturedDishCardProps) {
    const isEs = locale === "es"
    const displayName        = isEs && dish.nameEs        ? dish.nameEs        : dish.name
    const displayDescription = isEs && dish.descriptionEs ? dish.descriptionEs : dish.description
    const displayTags        = isEs && dish.tagsEs?.length ? dish.tagsEs        : dish.tags
    const discount           = getDiscountForItem(dish, discounts)

    const { currency: preferredCurrency } = useCurrency()
    const { amount: rawPrice, currency } = useMemo(
        () =>
            resolveMenuItemPriceForPreference(
                {
                    prices: dish.prices,
                },
                preferredCurrency,
            ),
        [dish.prices, preferredCurrency],
    )

    const finalPrice = discount ? computeDiscountedPrice(rawPrice, discount, currency) : null
    const hasImage = Boolean(dish.imageUrl?.trim())
    const imageHeight = dishesCount === 1 ? "h-72" : "h-56"
    const showRating = Boolean(rating && rating.count > 0)

    const priceCurrentClass =
        "bg-wg-dark-bg/80 backdrop-blur-sm text-white px-3.5 py-1.5 rounded-brand text-base font-bold"
    const priceOriginalClass =
        "bg-wg-dark-bg/60 backdrop-blur-sm text-white/60 px-2.5 py-1 rounded-brand text-sm line-through"

    return (
        <Link href={`/menu/${isEs && dish.slugEs ? dish.slugEs : dish.slug}`} className="group block">
            <article
                className="bg-wg-surface dark:bg-wg-dark-raised rounded-card overflow-hidden shadow-card dark:shadow-glow-sm group-hover:-translate-y-1 group-hover:shadow-elevated dark:group-hover:shadow-glow-md transition-all duration-300 border border-wg-border/50 dark:border-wg-dark-border h-full"
                data-animate=""
                style={{ transitionDelay: `${index * 100}ms` }}
            >
                {hasImage && (
                    <div className={`relative overflow-hidden bg-wg-surface dark:bg-wg-dark-raised ${imageHeight}`}>
                        <FadeInImage
                            src={dish.imageUrl!}
                            alt={displayName}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        {discount && (
                            <DiscountBadge
                                className="absolute top-3 left-3"
                                valueType={discount.valueType}
                                value={discount.value}
                                valueUsd={discount.valueUsd}
                                currency={currency}
                            />
                        )}
                        {finalPrice !== null ? (
                            <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
                                <span className={priceCurrentClass}>
                                    <CurrencyAmount amount={finalPrice} currency={currency} />
                                </span>
                                <span className={priceOriginalClass}>
                                    <CurrencyAmount amount={rawPrice} currency={currency} />
                                </span>
                            </div>
                        ) : (
                            <div className={`absolute bottom-3 right-3 ${priceCurrentClass}`}>
                                <CurrencyAmount amount={rawPrice} currency={currency} />
                            </div>
                        )}
                    </div>
                )}

                <div className="p-5">
                    {!hasImage && (
                        <div className={`flex flex-wrap items-start gap-3 mb-4 ${discount ? "justify-between" : "justify-end"}`}>
                            {discount && (
                                <DiscountBadge
                                    valueType={discount.valueType}
                                    value={discount.value}
                                    valueUsd={discount.valueUsd}
                                    currency={currency}
                                />
                            )}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                {finalPrice !== null ? (
                                    <>
                                        <span className={priceCurrentClass}>
                                            <CurrencyAmount amount={finalPrice} currency={currency} />
                                        </span>
                                        <span className={priceOriginalClass}>
                                            <CurrencyAmount amount={rawPrice} currency={currency} />
                                        </span>
                                    </>
                                ) : (
                                    <span className={priceCurrentClass}>
                                        <CurrencyAmount amount={rawPrice} currency={currency} />
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">
                        {displayName}
                    </h3>
                    <p className={`text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed ${showRating || displayTags.length > 0 ? "mb-4" : ""}`}>
                        {displayDescription}
                    </p>

                    {(displayTags.length > 0 || showRating) && (
                        <div
                            className={
                                displayTags.length > 0
                                    ? "flex items-end justify-between gap-3"
                                    : "flex justify-end"
                            }
                        >
                            {displayTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
                                    {displayTags.map((tag) => (
                                        <Badge key={tag} tag={tag} readable customColor={(dish.tagColors as Record<string, string> | null)?.[tag]} />
                                    ))}
                                </div>
                            )}
                            {showRating && rating && (
                                <RatingStars
                                    value={rating.average}
                                    size="sm"
                                    filledClassName="text-amber-400"
                                    className="shrink-0"
                                />
                            )}
                        </div>
                    )}
                </div>
            </article>
        </Link>
    )
}
