import { TagSolidIcon } from "@wildgrove/ui/icons"
import { CurrencyDiscountLabel } from "@/components/currency/CurrencyDiscountLabel"

type DiscountBadgeProps = {
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    valueUsd?: number | null
    currency: string
    /** Position and spacing from the place that uses it. */
    className?: string
}

/**
 * The discount label of a dish: the same small amber tag on the menu, the home page,
 * the dish page and the chat cards. White text on the light amber reaches 4.5:1 in
 * both themes (see the design system).
 */
export function DiscountBadge({ className = "", ...discount }: DiscountBadgeProps) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-brand bg-wg-accent px-2 py-0.5 text-xs font-semibold text-white ${className}`}>
            <TagSolidIcon className="h-3 w-3 shrink-0" />
            <CurrencyDiscountLabel {...discount} />
        </span>
    )
}
