"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/routing"
import { CurrencyAmount } from "@/components/currency/CurrencyAmount"
import { DiscountBadge } from "@/components/currency/DiscountBadge"
import { DiscountCountdown } from "@/components/menu/DiscountCountdown"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { resolveMenuItemPriceForPreference } from "@wildgrove/core/menu-display-price"
import { computeDiscountedPrice, type ActiveMenuDiscount } from "@wildgrove/core/menu-discounts"
import { AddToCartButton } from "@/components/menu/AddToCartButton"
import type { MenuItemSnapshot } from "@/components/providers/CartProvider"
import { CalendarBandIcon } from "@wildgrove/ui/icons"

interface MenuProductPricePanelProps {
    prices: { PEN?: number; USD?: number }
    discount: ActiveMenuDiscount | null
    locale: string
    reserveTableLabel: string
    perServingLabel: string
    addToCartLabel?: string
    /** When provided, shows the Add to Cart button */
    cartSnapshot?: MenuItemSnapshot
}

export function MenuProductPricePanel({
    prices,
    discount,
    locale,
    reserveTableLabel,
    perServingLabel,
    cartSnapshot,
}: MenuProductPricePanelProps) {
    const { currency: preferredCurrency } = useCurrency()
    const { amount: displayPrice, currency: displayCurrency } = useMemo(
        () =>
            resolveMenuItemPriceForPreference(
                { prices },
                preferredCurrency,
            ),
        [prices, preferredCurrency],
    )

    const finalPrice = discount ? computeDiscountedPrice(displayPrice, discount, displayCurrency) : null

    return (
        <div className="mt-auto rounded-card border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-raised p-5">
            <div className="flex items-baseline justify-between mb-4">
                <div className="flex flex-col gap-0.5">
                    {finalPrice !== null ? (
                        <>
                            {discount && (
                                <DiscountBadge
                                    className="self-start mb-1"
                                    valueType={discount.valueType}
                                    value={discount.value}
                                    valueUsd={discount.valueUsd}
                                    currency={displayCurrency}
                                />
                            )}
                            <div className="flex items-baseline gap-2">
                                <span className="font-display text-3xl font-bold text-wg-accent dark:text-wg-dark-accent">
                                    <CurrencyAmount amount={finalPrice} currency={displayCurrency} />
                                </span>
                                <span className="text-base line-through text-wg-muted dark:text-wg-dark-muted">
                                    <CurrencyAmount amount={displayPrice} currency={displayCurrency} />
                                </span>
                            </div>
                        </>
                    ) : (
                        <span className="font-display text-3xl font-bold text-wg-accent dark:text-wg-dark-accent">
                            <CurrencyAmount amount={displayPrice} currency={displayCurrency} />
                        </span>
                    )}
                </div>
                <span className="text-xs text-wg-muted dark:text-wg-dark-muted uppercase tracking-wider">
                    {perServingLabel}
                </span>
            </div>
            {discount?.validUntil && (
                <div className="mb-4 pb-4 border-b border-wg-border/40 dark:border-wg-dark-border">
                    <DiscountCountdown validUntil={discount.validUntil} locale={locale} />
                </div>
            )}
            <div className="flex flex-col gap-3">
                {cartSnapshot && (
                    <AddToCartButton item={cartSnapshot} large />
                )}
                <Link
                    href="/reservations"
                    className={`flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-brand text-sm font-semibold transition-colors shadow-card ${
                        cartSnapshot
                            ? "bg-wg-surface dark:bg-wg-dark-bg border border-wg-border dark:border-wg-dark-border text-wg-primary dark:text-wg-dark-primary hover:bg-wg-border/30 dark:hover:bg-wg-dark-border/30"
                            : "bg-wg-accent hover:bg-wg-accent-hover text-white"
                    }`}
                >
                    <CalendarBandIcon className="w-4 h-4" strokeWidth={1.75} />
                    {reserveTableLabel}
                </Link>
            </div>
        </div>
    )
}
