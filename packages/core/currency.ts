// ══════════════════════════════════════════════════════════════════
// Currency utilities — display formatting (amounts stay in their stored currency)
// Supported: PEN (Peruvian Sol), USD (US Dollar)
// ══════════════════════════════════════════════════════════════════

export type SupportedCurrency = "PEN" | "USD"

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["PEN", "USD"]
export const DEFAULT_CURRENCY: SupportedCurrency = "PEN"
/** localStorage key for visitor PEN/USD display preference */
export const CURRENCY_STORAGE_KEY = "wg:preferred-currency"

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
    PEN: "S/",
    USD: "$",
}

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
    PEN: "S/ — Peruvian Sol",
    USD: "$ — US Dollar",
}

/** Returns the display symbol for a currency code. Falls back to the code itself. */
export function getCurrencySymbol(currency: string): string {
    return CURRENCY_SYMBOLS[currency as SupportedCurrency] ?? currency
}

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
    return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)
}

export function normalizeCurrency(currency: string | null | undefined): SupportedCurrency {
    if (!currency) return DEFAULT_CURRENCY
    return isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY
}

export function roundCurrency(amount: number): number {
    return Math.round(amount * 100) / 100
}

/** Formats a numeric price with the correct currency prefix. e.g. "S/12.00" or "$12.00". */
export function formatPrice(amount: number, currency: string): string {
    return `${getCurrencySymbol(currency)}${roundCurrency(amount).toFixed(2)}`
}
