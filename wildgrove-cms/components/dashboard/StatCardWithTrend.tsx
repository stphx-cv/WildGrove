"use client"
import { LoadingState } from "@/components/LoadingState"

import type { Trend } from "@/lib/admin/dashboard-types"
import { InformationCircleIcon } from "@wildgrove/ui/icons"

interface StatCardWithTrendProps {
    title: string
    value: string | number
    icon?: React.ReactNode
    trend?: Trend
    trendLabel?: string
    loading?: boolean
    tooltip?: string
    prefix?: string
    className?: string
}

export function StatCardWithTrend({
    title,
    value,
    icon,
    trend,
    trendLabel = "vs previous period",
    loading = false,
    tooltip,
    prefix,
    className = "",
}: StatCardWithTrendProps) {
    const isPositive = trend ? trend.value >= 0 : null

    return (
        <div
            className={`p-5 rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface transition-shadow hover:shadow-card dark:hover:shadow-glow-sm ${className}`}
            aria-busy={loading}
        >
            <div className="flex items-start justify-between mb-3">
                {icon && (
                    <div className="p-2 rounded-brand bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary" aria-hidden="true">
                        {icon}
                    </div>
                )}
                {tooltip && (
                    <button
                        className="ml-auto p-1 rounded text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent"
                        aria-label={`Info: ${tooltip}`}
                        title={tooltip}
                    >
                        <InformationCircleIcon className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            </div>

            {loading ? (
                <LoadingState size="inline" message="Loading…" className="py-2" />
            ) : (
                <dl>
                    <dd className="text-2xl font-display font-bold text-wg-text dark:text-wg-dark-text tabular-nums">
                        {prefix}{value}
                    </dd>
                    <dt className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">{title}</dt>
                    {trend !== undefined && (
                        <dd className="mt-2 flex items-center gap-1">
                            <span
                                className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                                    isPositive
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                            >
                                <span aria-hidden="true">{isPositive ? "↑" : "↓"}</span>
                                {Math.abs(trend.value)}%
                            </span>
                            <span className="text-[11px] text-wg-muted/70 dark:text-wg-dark-muted/70">{trendLabel}</span>
                        </dd>
                    )}
                </dl>
            )}
        </div>
    )
}

export function StatCardSkeleton({ className = "" }: { className?: string }) {
    return (
        <div className={`p-5 rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface ${className}`}>
            <LoadingState size="inline" message="Loading…" className="py-4" />
        </div>
    )
}
