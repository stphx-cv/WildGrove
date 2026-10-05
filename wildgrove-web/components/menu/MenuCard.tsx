"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { Link } from "@/i18n/routing"
import { Badge } from "@wildgrove/ui/Badge"
import type { MenuItemData } from "@wildgrove/core/data/menu-seed"
import { CurrencyAmount } from "@/components/currency/CurrencyAmount"
import { DiscountBadge } from "@/components/currency/DiscountBadge"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { resolveMenuItemPriceForPreference } from "@wildgrove/core/menu-display-price"
import {
    getDiscountForItem,
    computeDiscountedPrice,
    displayCartUnitPrices,
    type ActiveMenuDiscount,
} from "@wildgrove/core/menu-discounts"
import { AddToCartButton } from "@/components/menu/AddToCartButton"
import type { MenuItemSnapshot } from "@/components/providers/CartProvider"
import { RatingPill } from "@/components/product-reviews/RatingPill"

interface MenuCardProps {
    item: MenuItemData
    locale: string
    discounts?: ActiveMenuDiscount[]
    rating?: { average: number; count: number }
}

export function MenuCard({ item, locale, discounts = [], rating }: MenuCardProps) {
    const t = useTranslations("menu")
    const isEs = locale === "es"
    const displayName        = isEs && item.nameEs        ? item.nameEs        : item.name
    const displayDescription = isEs && item.descriptionEs ? item.descriptionEs : item.description
    const displayTags        = isEs && item.tagsEs?.length ? item.tagsEs       : item.tags
    const href               = isEs && item.slugEs        ? `/menu/${item.slugEs}` : `/menu/${item.slug}`

    const { currency: preferredCurrency } = useCurrency()
    const { amount: basePrice, currency: baseCurrency } = useMemo(
        () =>
            resolveMenuItemPriceForPreference(
                {
                    prices: item.prices ?? {},
                },
                preferredCurrency,
            ),
        [item.prices, preferredCurrency],
    )

    const discount    = getDiscountForItem(item, discounts)
    const finalPrice  = discount ? computeDiscountedPrice(basePrice, discount, baseCurrency) : null

    const cartSnapshot = useMemo((): MenuItemSnapshot => {
        const prices = (item.prices ?? {}) as Record<string, number>
        const base: MenuItemSnapshot = {
            id: item.id,
            name: item.name,
            nameEs: item.nameEs ?? null,
            imageUrl: item.imageUrl?.trim() || null,
            prices,
            available: item.available,
        }
        if (!discount) return base
        const { unitPricePEN, unitPriceUSD } = displayCartUnitPrices(prices, discount)
        return {
            ...base,
            displayUnitPricePEN: unitPricePEN,
            displayUnitPriceUSD: unitPriceUSD,
        }
    }, [item, discount])

    const hasImage = Boolean(item.imageUrl?.trim())
    const showRating = Boolean(rating && rating.count > 0)

    const ratingOverlay = showRating && rating ? (
        <div className="absolute top-2 right-2 z-10 flex items-center bg-black/55 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-brand border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            <RatingPill
                average={rating.average}
                count={rating.count}
                compact
                className="text-white [&_.rating-pill-count]:text-white/80 [&_.rating-pill-reviewer-icon]:text-white/90 [&_.rating-pill-star]:text-amber-400"
            />
        </div>
    ) : null

    return (
        <article
            className={`group bg-wg-surface dark:bg-wg-dark-raised rounded-card overflow-hidden shadow-card dark:shadow-glow-sm hover:-translate-y-0.5 hover:shadow-elevated dark:hover:shadow-glow-md transition-all duration-300 border border-wg-border/50 dark:border-wg-dark-border flex flex-col ${!item.available ? "opacity-60 grayscale" : ""
                }`}
        >
            {/* Image — clickable area → item detail */}
            <Link href={href} className="block">
                {hasImage ? (
                    <div className="relative h-48 overflow-hidden">
                        <FadeInImage
                            src={item.imageUrl}
                            alt={displayName}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        {!item.available && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="bg-wg-dark-bg/90 text-white text-xs font-semibold px-3 py-1 rounded-brand uppercase tracking-wider">
                                    {t("unavailable")}
                                </span>
                            </div>
                        )}
                        {/* Discount badge */}
                        {discount && (
                            <DiscountBadge
                                className="absolute top-2 left-2"
                                valueType={discount.valueType}
                                value={discount.value}
                                valueUsd={discount.valueUsd}
                                currency={baseCurrency}
                            />
                        )}
                        {ratingOverlay}
                    </div>
                ) : (
                    (discount || !item.available || showRating) && (
                        <div className="relative px-4 pt-4 pb-2">
                            {ratingOverlay}
                            {!item.available && (
                                <div className="mb-2 text-center">
                                    <span className="inline-block bg-wg-dark-bg/90 text-white text-xs font-semibold px-3 py-1 rounded-brand uppercase tracking-wider">
                                        {t("unavailable")}
                                    </span>
                                </div>
                            )}
                            {discount && (
                                <DiscountBadge
                                    className="mb-2"
                                    valueType={discount.valueType}
                                    value={discount.value}
                                    valueUsd={discount.valueUsd}
                                    currency={baseCurrency}
                                />
                            )}
                        </div>
                    )
                )}

                {/* Content */}
                <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-display text-base font-semibold text-wg-text dark:text-wg-dark-text leading-snug">
                            {displayName}
                        </h3>
                        {finalPrice !== null ? (
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-sm font-semibold text-wg-accent dark:text-wg-dark-accent">
                                    <CurrencyAmount amount={finalPrice} currency={baseCurrency} />
                                </span>
                                <span className="text-xs line-through text-wg-muted dark:text-wg-dark-muted">
                                    <CurrencyAmount amount={basePrice} currency={baseCurrency} />
                                </span>
                            </div>
                        ) : (
                            <span className="flex-shrink-0 text-sm font-semibold text-wg-accent dark:text-wg-dark-accent">
                                <CurrencyAmount amount={basePrice} currency={baseCurrency} />
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-3 line-clamp-2">
                        {displayDescription}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                        {displayTags.map((tag) => (
                            <Badge key={tag} tag={tag} readable customColor={item.tagColors?.[tag]} />
                        ))}
                    </div>
                </div>
            </Link>

            {/* Add to cart — outside the Link to prevent navigation on click */}
            <div className="px-4 pb-4 mt-auto">
                <AddToCartButton item={cartSnapshot} />
            </div>
        </article>
    )
}
