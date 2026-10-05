"use client"

import { ThemeProvider as BaseThemeProvider } from "@wildgrove/ui/ThemeProvider"
import { CurrencyProvider } from "@/components/providers/CurrencyProvider"
import type { SupportedCurrency } from "@wildgrove/core/currency"

/**
 * Public-site theme provider — the shared next-themes provider plus the
 * currency context, which only the storefront uses.
 */
export function ThemeProvider({
    children,
    storeCurrency = null,
}: {
    children: React.ReactNode
    storeCurrency?: SupportedCurrency | null
}) {
    return (
        <BaseThemeProvider>
            <CurrencyProvider storeCurrency={storeCurrency}>{children}</CurrencyProvider>
        </BaseThemeProvider>
    )
}
