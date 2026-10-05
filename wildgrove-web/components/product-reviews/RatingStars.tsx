// Read-only star row with proportional fill per star (0–5)

import { StarSolidIcon } from "@wildgrove/ui/icons"

interface RatingStarsProps {
    value: number
    size?: "sm" | "md" | "lg" | "xl"
    className?: string
    filledClassName?: string
    emptyClassName?: string
}

const SIZE: Record<NonNullable<RatingStarsProps["size"]>, string> = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
    xl: "w-6 h-6 sm:w-7 sm:h-7",
}

const GAP: Record<NonNullable<RatingStarsProps["size"]>, string> = {
    sm: "gap-0.5",
    md: "gap-0.5",
    lg: "gap-1",
    xl: "gap-1 sm:gap-1.5",
}

export function RatingStars({
    value,
    size = "md",
    className,
    filledClassName = "text-wg-accent dark:text-wg-dark-accent",
    emptyClassName = "text-wg-border dark:text-wg-dark-border",
}: RatingStarsProps) {
    const clamped = Math.min(5, Math.max(0, value))
    const sizeClass = SIZE[size]
    const gapClass = GAP[size]

    return (
        <div
            className={`inline-flex items-center ${gapClass} ${className ?? ""}`}
            role="img"
            aria-label={`${clamped.toFixed(1)} of 5`}
        >
            {Array.from({ length: 5 }).map((_, i) => {
                const fillPercent = Math.min(100, Math.max(0, (clamped - i) * 100))
                return (
                    <span key={i} className="relative inline-flex shrink-0" aria-hidden="true">
                        <StarSolidIcon className={`${sizeClass} ${emptyClassName}`} />
                        {fillPercent > 0 && (
                            <span
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${fillPercent}%` }}
                            >
                                <StarSolidIcon className={`${sizeClass} ${filledClassName}`} />
                            </span>
                        )}
                    </span>
                )
            })}
        </div>
    )
}
