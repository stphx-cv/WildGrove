// ══════════════════════════════════════════════════════════════════
// What a dish costs today, for the agent surface.
//
// The menu page shows the discounted price and the dish page's structured
// data carries it too; until this file existed the agent API, the MCP tool
// and the markdown representation all quoted the list price. One of the ARD
// manifest's own representative queries — "How much does the lomo saltado
// cost?" — was being answered wrongly.
//
// Only AUTOMATIC discounts apply here, as on the public menu. Coupons are
// entered at checkout and are not part of the published price.
// ══════════════════════════════════════════════════════════════════

import { loadActiveAutomaticDiscounts } from "../cart/active-automatic-discounts"
import { DEFAULT_CURRENCY, formatPrice, type SupportedCurrency } from "../currency"
import {
    computeDiscountedPrice,
    discountLabel,
    getDiscountForItem,
    type ActiveMenuDiscount,
} from "../menu-discounts"
import { getAppSettings } from "../settings"

/**
 * Active automatic discounts: the same list the menu and checkout read, with
 * the validFrom/validUntil window applied on every call.
 */
export const getAgentDiscounts = loadActiveAutomaticDiscounts

/**
 * The currency the agent surface quotes: the store's only currency when the
 * owner turned off the second one, soles otherwise. The same rule as the
 * dish page's structured data, so an agent never quotes a currency the
 * store does not sell in.
 */
export async function getAgentCurrency(): Promise<SupportedCurrency> {
    const { storeCurrency } = await getAppSettings()
    return storeCurrency ?? DEFAULT_CURRENCY
}

export interface AgentPrice {
    /** What the guest pays today, after any automatic discount. Null when unpriced. */
    amount: number | null
    /** The undiscounted price. Null unless a discount applies. */
    listAmount: number | null
    /** "40% OFF", "S/5.00 OFF". Null unless a discount applies. */
    discount: string | null
    currency: SupportedCurrency
}

type PricedItem = {
    id: string
    categoryId?: string | null
    prices?: Partial<Record<"PEN" | "USD", number>>
}

export function agentPrice(
    item: PricedItem,
    discounts: ActiveMenuDiscount[],
    currency: SupportedCurrency
): AgentPrice {
    const list = item.prices?.[currency]
    if (typeof list !== "number" || !Number.isFinite(list) || list <= 0) {
        return { amount: null, listAmount: null, discount: null, currency }
    }

    const discount = getDiscountForItem(item, discounts)
    if (!discount) return { amount: list, listAmount: null, discount: null, currency }

    return {
        amount: computeDiscountedPrice(list, discount, currency),
        listAmount: list,
        discount: discountLabel(discount, currency),
        currency,
    }
}

/**
 * "S/37.20 (40% OFF, list S/62.00)", "S/62.00", or "—" when unpriced.
 * `listLabel` is the localized word for "list", passed in by callers that
 * render a Spanish document.
 */
export function formatAgentPrice(p: AgentPrice, listLabel = "list"): string {
    if (p.amount === null) return "—"
    const now = formatPrice(p.amount, p.currency)
    if (p.listAmount === null || p.discount === null) return now
    return `${now} (${p.discount}, ${listLabel} ${formatPrice(p.listAmount, p.currency)})`
}
