"use client"

import { useTranslations } from "next-intl"
import { useMounted } from "@wildgrove/ui/useMounted"
import { useCurrency } from "@/components/providers/CurrencyProvider"

interface CurrencySelectorProps {
    compact?: boolean
}

export function CurrencySelector({ compact = false }: CurrencySelectorProps) {
    const t = useTranslations("common")
    const { currency: savedCurrency, setCurrency } = useCurrency()
    // The saved currency is only known in the browser, so nothing is marked
    // active until after hydration.
    const currency = useMounted() ? savedCurrency : null

    return (
        <div className={compact ? "flex gap-1" : undefined}>
            {!compact && (
                <p className="text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wider mb-2">
                    {t("currency")}
                </p>
            )}
            <div className="flex gap-1">
                <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-brand text-xs font-medium transition-colors ${
                        currency === "USD"
                            ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                            : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                    }`}
                >
                    USD
                </button>
                <button
                    type="button"
                    onClick={() => setCurrency("PEN")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-brand text-xs font-medium transition-colors ${
                        currency === "PEN"
                            ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                            : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                    }`}
                >
                    PEN
                </button>
            </div>
        </div>
    )
}
