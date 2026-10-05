// Aggregate rating block: large number + stars + distribution bars

import { RatingStars } from "./RatingStars"
import { StarSolidIcon } from "@wildgrove/ui/icons"

interface RatingSummaryProps {
    average: number
    count: number
    distribution: Record<1 | 2 | 3 | 4 | 5, number>
    labels: {
        averageOf: string
        reviewCount: string
    }
}

export function RatingSummary({ average, count, distribution, labels }: RatingSummaryProps) {
    const max = Math.max(1, ...Object.values(distribution))

    return (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-center">
            <div className="text-center sm:text-left">
                <div className="font-display text-5xl font-semibold text-wg-text dark:text-wg-dark-text leading-none">
                    {average.toFixed(1)}
                </div>
                <RatingStars value={average} size="md" className="mt-2 justify-center sm:justify-start" />
                <p className="mt-2 text-xs text-wg-muted dark:text-wg-dark-muted">
                    {labels.averageOf}
                </p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                    {labels.reviewCount}
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                    const c = distribution[star]
                    const pct = (c / max) * 100
                    return (
                        <div key={star} className="flex items-center gap-2 text-xs text-wg-muted dark:text-wg-dark-muted">
                            <span className="w-3 text-right tabular-nums">{star}</span>
                            <StarSolidIcon className="w-3 h-3 text-wg-accent dark:text-wg-dark-accent" />
                            <div className="flex-1 h-2 rounded-full bg-wg-border/30 dark:bg-wg-dark-border/30 overflow-hidden">
                                <div
                                    className="h-full bg-wg-accent dark:bg-wg-dark-accent transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-6 text-right tabular-nums">{c}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
