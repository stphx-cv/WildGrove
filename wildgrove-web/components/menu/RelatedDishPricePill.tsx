"use client"

import { useMemo } from "react"
import { CurrencyAmount } from "@/components/currency/CurrencyAmount"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { resolveMenuItemPriceForPreference } from "@wildgrove/core/menu-display-price"
import { computeDiscountedPrice, type ActiveMenuDiscount } from "@wildgrove/core/menu-discounts"

interface RelatedDishPricePillProps {
    prices: { PEN?: number; USD?: number }
    /** The automatic discount for this dish, resolved like the menu grid does. */
    discount?: ActiveMenuDiscount | null
    /** `overlay` = absolute on a relative image container; `inline` = static pill for cards without an image */
    placement?: "overlay" | "inline"
}

export function RelatedDishPricePill({ prices, discount = null, placement = "overlay" }: RelatedDishPricePillProps) {
    const { currency: preferredCurrency } = useCurrency()
    const { amount, currency: cur } = useMemo(
        () =>
            resolveMenuItemPriceForPreference(
                { prices },
                preferredCurrency,
            ),
        [prices, preferredCurrency],
    )
    const finalAmount = discount ? computeDiscountedPrice(amount, discount, cur) : null

    const box =
        placement === "inline"
            ? "relative shrink-0 bg-wg-dark-bg/75 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-brand"
            : "absolute bottom-2 right-2 bg-wg-dark-bg/75 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-brand"

    return (
        <div className={box}>
            {finalAmount !== null ? (
                <>
                    <CurrencyAmount amount={finalAmount} currency={cur} />
                    <span className="ml-1.5 font-normal line-through opacity-70">
                        <CurrencyAmount amount={amount} currency={cur} />
                    </span>
                </>
            ) : (
                <CurrencyAmount amount={amount} currency={cur} />
            )}
        </div>
    )
}
