"use client"

import { useTranslations } from "next-intl"
import { useCurrencyFormatter } from "@/components/providers/CurrencyProvider"
import { discountValueForCurrency } from "@wildgrove/core/menu-discounts"

interface CurrencyDiscountLabelProps {
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    valueUsd?: number | null
    currency: string
}

export function CurrencyDiscountLabel({
    valueType,
    value,
    valueUsd,
    currency,
}: CurrencyDiscountLabelProps) {
    const { formatAmount } = useCurrencyFormatter()
    const t = useTranslations("menu")

    if (valueType === "PERCENTAGE") {
        const pct = Number.isInteger(value) ? value : Number(value.toFixed(1))
        return <>{t("percentOff", { value: pct })}</>
    }

    const amount = discountValueForCurrency(
        { valueType, value, valueUsd: valueUsd ?? null },
        currency,
    )
    return <>{t("amountOff", { amount: formatAmount(amount, currency) })}</>
}
