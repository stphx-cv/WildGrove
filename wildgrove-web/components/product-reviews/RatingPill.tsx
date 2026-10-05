// Small inline pill: ★ 4.8 (24)

import { StarSolidIcon, UserSolidIcon } from "@wildgrove/ui/icons"

interface RatingPillProps {
    average: number
    count: number
    /** Compact = smaller text + no parentheses. */
    compact?: boolean
    className?: string
}

export function RatingPill({ average, count, compact, className }: RatingPillProps) {
    if (count <= 0) return null
    const display = average.toFixed(1)
    return (
        <span
            className={
                "inline-flex items-center gap-1 text-wg-text dark:text-wg-dark-text " +
                (compact ? "text-xs" : "text-sm") +
                " " + (className ?? "")
            }
            aria-label={`Rated ${display} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
        >
            <StarSolidIcon
                className={
                    "rating-pill-star shrink-0 " +
                    (compact ? "w-3.5 h-3.5 " : "w-4 h-4 ") +
                    "text-wg-accent dark:text-wg-dark-accent"
                }
            />
            <span className="font-medium">{display}</span>
            {compact ? (
                <span className="rating-pill-count inline-flex items-center gap-0.5 text-wg-muted dark:text-wg-dark-muted">
                    <span className="text-current/60" aria-hidden="true">
                        ·
                    </span>
                    <UserSolidIcon className="rating-pill-reviewer-icon w-3 h-3 shrink-0" />
                    <span>{count}</span>
                </span>
            ) : (
                <span className="rating-pill-count inline-flex items-center gap-1 text-wg-muted dark:text-wg-dark-muted">
                    <UserSolidIcon className="rating-pill-reviewer-icon w-3.5 h-3.5 shrink-0" />
                    <span>({count})</span>
                </span>
            )}
        </span>
    )
}
