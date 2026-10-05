// ══════════════════════════════════════════════════════════════════
// Menu discount utilities — types and helpers for displaying
// active discounts on the public /menu page.
// Only AUTOMATIC discounts are shown here.
// COUPON discounts are entered at checkout and not shown on the menu.
// ══════════════════════════════════════════════════════════════════

export interface ActiveMenuDiscount {
    id: string
    name: string
    description: string | null
    type: "AUTOMATIC"
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    /** FIXED_AMOUNT off in USD. Null when PERCENTAGE or not yet set. */
    valueUsd: number | null
    /** Null = applies to all items */
    menuItemId: string | null
    /** Null = not limited to a single category (legacy column; prefer categoryIds) */
    categoryId: string | null
    /** Category IDs this discount is limited to. Empty = not category-scoped. */
    categoryIds: string[]
    /** Item IDs excluded from this discount (for "All items, Except..." and category+exceptions) */
    excludedItemIds: string[]
    /** ISO string of when the discount expires; null = no expiry */
    validUntil: string | null
}

/** Category IDs a discount is limited to, including the legacy single `categoryId`. */
export function scopedCategoryIds(d: {
    categoryId: string | null
    categoryIds?: string[]
}): string[] {
    if (d.categoryIds && d.categoryIds.length > 0) return d.categoryIds
    return d.categoryId ? [d.categoryId] : []
}

/**
 * Returns the most-specific active discount for a menu item.
 * Priority: item-specific > category-specific > global (no restrictions)
 */
export function getDiscountForItem(
    item: { id: string; categoryId?: string | null },
    discounts: ActiveMenuDiscount[]
): ActiveMenuDiscount | null {
    if (!discounts.length) return null

    const itemSpecific = discounts.find((d) => d.menuItemId === item.id)
    if (itemSpecific) return itemSpecific

    if (item.categoryId) {
        const categorySpecific = discounts.find((d) =>
            d.menuItemId === null &&
            scopedCategoryIds(d).includes(item.categoryId!) &&
            !d.excludedItemIds.includes(item.id))
        if (categorySpecific) return categorySpecific
    }

    return discounts.find((d) =>
        d.menuItemId === null &&
        scopedCategoryIds(d).length === 0 &&
        !d.excludedItemIds.includes(item.id)) ?? null
}

/**
 * Percentage uses `value`. Fixed amount uses `value` (PEN) or `valueUsd` (USD).
 */
export function discountValueForCurrency(
    discount: Pick<ActiveMenuDiscount, "valueType" | "value" | "valueUsd">,
    currency: string,
): number {
    if (discount.valueType === "PERCENTAGE") return discount.value
    return currency === "USD" ? (discount.valueUsd ?? discount.value) : discount.value
}

/**
 * Computes the discounted price, rounded to 2 decimal places.
 * Fixed amounts are per currency: PEN uses `value`, USD uses `valueUsd`.
 */
export function computeDiscountedPrice(
    price: number,
    discount: ActiveMenuDiscount,
    currency: string,
): number {
    const off = discountValueForCurrency(discount, currency)
    const discounted =
        discount.valueType === "PERCENTAGE"
            ? price * (1 - off / 100)
            : price - off
    return Math.max(0, Math.round(discounted * 100) / 100)
}

/**
 * Per-currency unit prices for cart UI (matches checkout automatic discount).
 */
export function displayCartUnitPrices(
    prices: Record<string, number>,
    discount: ActiveMenuDiscount | null,
): { unitPricePEN: number; unitPriceUSD: number } {
    const pen = prices.PEN ?? 0
    const usd = prices.USD ?? 0
    if (!discount) {
        return { unitPricePEN: pen, unitPriceUSD: usd }
    }
    return {
        unitPricePEN: computeDiscountedPrice(pen, discount, "PEN"),
        unitPriceUSD: computeDiscountedPrice(usd, discount, "USD"),
    }
}

/**
 * Returns a short label like "20% OFF" or "S/5 OFF".
 */
export function discountLabel(discount: ActiveMenuDiscount, currency?: string): string {
    if (discount.valueType === "PERCENTAGE") {
        const pct = Number.isInteger(discount.value)
            ? discount.value
            : discount.value.toFixed(1)
        return `${pct}% OFF`
    }
    const amount = discountValueForCurrency(discount, currency ?? "PEN")
    const sym = currency === "USD" ? "$" : "S/"
    return `${sym}${amount.toFixed(2)} OFF`
}
