"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
    CURRENCY_STORAGE_KEY,
    DEFAULT_CURRENCY,
    type SupportedCurrency,
    formatPrice,
    isSupportedCurrency,
    normalizeCurrency,
    roundCurrency,
} from "@wildgrove/core/currency"

interface CurrencyContextValue {
    currency: SupportedCurrency
    setCurrency: (currency: SupportedCurrency) => void
    /**
     * Set while the owner has dual currency off: the only currency the store
     * shows. `currency` is always this one and `setCurrency` does nothing.
     */
    storeCurrency: SupportedCurrency | null
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({
    children,
    storeCurrency = null,
}: {
    children: React.ReactNode
    storeCurrency?: SupportedCurrency | null
}) {
    const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY)
    // The visitor's saved preference is kept, and ignored while the store has one currency.
    const currency = storeCurrency ?? preferredCurrency

    /* eslint-disable react-hooks/set-state-in-effect -- restore currency from localStorage after hydration */
    useEffect(() => {
        try {
            const stored = localStorage.getItem(CURRENCY_STORAGE_KEY)
            if (stored && isSupportedCurrency(stored)) {
                setPreferredCurrency(stored)
            }
        } catch {
            // ignore
        }
    }, [])
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        try {
            document.cookie = `wg_currency=${currency}; path=/; max-age=31536000; samesite=lax`
        } catch {
            // ignore
        }
    }, [currency])

    const value = useMemo(() => {
        const setCurrency = (nextCurrency: SupportedCurrency) => {
            if (storeCurrency) return
            setPreferredCurrency(nextCurrency)
            try {
                localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency)
            } catch {
                // ignore
            }
        }
        return { currency, setCurrency, storeCurrency }
    }, [currency, storeCurrency])
    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
    const ctx = useContext(CurrencyContext)
    if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider")
    return ctx
}

/** Formats an amount in the given currency code (no conversion). */
export function useCurrencyFormatter() {
    return useMemo(
        () => ({
            formatAmount(amount: number, fromCurrency: string) {
                const c = normalizeCurrency(fromCurrency)
                return formatPrice(roundCurrency(amount), c)
            },
        }),
        [],
    )
}
