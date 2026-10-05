// ══════════════════════════════════════════════════════════════════
// Pick which stored menu price to show from visitor currency preference.
// No FX conversion is applied; amounts come directly from the CMS.
// ══════════════════════════════════════════════════════════════════

import { type SupportedCurrency, normalizeCurrency } from "./currency"

export interface MenuItemPriceFields {
    prices: Partial<Record<SupportedCurrency, number>>
}

/**
 * Picks the requested currency if available; otherwise falls back to the
 * first positive stored amount (PEN first, then USD).
 */
export function resolveMenuItemPriceForPreference(
    item: MenuItemPriceFields,
    preferred: SupportedCurrency
): { amount: number; currency: SupportedCurrency } {
    const preferredCurrency = normalizeCurrency(preferred)
    const preferredAmount = item.prices[preferredCurrency]
    if (typeof preferredAmount === "number" && Number.isFinite(preferredAmount) && preferredAmount > 0) {
        return { amount: preferredAmount, currency: preferredCurrency }
    }

    const penAmount = item.prices.PEN
    if (typeof penAmount === "number" && Number.isFinite(penAmount) && penAmount > 0) {
        return { amount: penAmount, currency: "PEN" }
    }

    const usdAmount = item.prices.USD
    if (typeof usdAmount === "number" && Number.isFinite(usdAmount) && usdAmount > 0) {
        return { amount: usdAmount, currency: "USD" }
    }

    return { amount: 0, currency: preferredCurrency }
}
