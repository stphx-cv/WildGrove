"use client"

import { useCurrencyFormatter } from "@/components/providers/CurrencyProvider"

interface CurrencyAmountProps {
    amount: number
    currency: string
}

export function CurrencyAmount({ amount, currency }: CurrencyAmountProps) {
    const { formatAmount } = useCurrencyFormatter()
    return <>{formatAmount(amount, currency)}</>
}
