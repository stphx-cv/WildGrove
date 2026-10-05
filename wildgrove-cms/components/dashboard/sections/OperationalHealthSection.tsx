"use client"

import Link from "next/link"
import { useDashboardData } from "@/hooks/useDashboardData"
import type { HealthDTO, SystemAlert } from "@/lib/admin/dashboard-types"
import {
    ArrowTrendingUpIcon,
    ClockRightAngleIcon,
    StarOutlineIcon,
    StarSolidIcon,
    TicketIcon,
} from "@wildgrove/ui/icons"

const PRIORITY_COLORS: Record<string, string> = {
    URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    HIGH:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    LOW:    "bg-wg-border/40 text-wg-muted dark:bg-wg-dark-border/40 dark:text-wg-dark-muted",
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <StarSolidIcon key={i} className={`w-3.5 h-3.5 ${i < rating ? "text-amber-400" : "text-wg-border dark:text-wg-dark-border"}`} aria-hidden="true" />
            ))}
        </div>
    )
}

function AlertBanner({ alert }: { alert: SystemAlert }) {
    const icons: Record<SystemAlert["type"], React.ReactNode> = {
        LATE_ORDER: <ClockRightAngleIcon className="w-4 h-4" aria-hidden="true" />,
        LOW_REVIEW: <StarOutlineIcon className="w-4 h-4" aria-hidden="true" />,
        HIGH_TICKET: <TicketIcon className="w-4 h-4" aria-hidden="true" />,
        LOW_PERFORMER: <ArrowTrendingUpIcon className="w-4 h-4" aria-hidden="true" />,
    }

    const content = (
        <div className="flex items-start gap-2 px-4 py-3 rounded-brand bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300">
            {icons[alert.type]}
            <span className="text-sm">{alert.message}</span>
        </div>
    )

    return alert.href ? <Link href={alert.href}>{content}</Link> : content
}

function KpiCard({ label, value, suffix, highlight }: { label: string; value: string | number; suffix?: string; highlight?: boolean }) {
    return (
        <div className={`p-5 rounded-card border bg-wg-surface dark:bg-wg-dark-surface ${highlight ? "border-red-300 dark:border-red-800" : "border-wg-border/50 dark:border-wg-dark-border"}`}>
            <dl>
                <dd className={`text-2xl font-display font-bold tabular-nums ${highlight ? "text-red-600 dark:text-red-400" : "text-wg-text dark:text-wg-dark-text"}`}>
                    {value}{suffix}
                </dd>
                <dt className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">{label}</dt>
            </dl>
        </div>
    )
}

interface Props {
    rangeQuery: string
}

export function OperationalHealthSection({ rangeQuery }: Props) {
    const { data } = useDashboardData<HealthDTO>({
        endpoint: `/api/dashboard/health?${rangeQuery}`,
        intervalMs: 30_000,
    })

    return (
        <section aria-labelledby="health-heading" className="space-y-6">
            <h2 id="health-heading" className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                Operational Health
            </h2>

            {/* System alerts */}
            {data && data.systemAlerts.length > 0 && (
                <div className="space-y-2" role="alert">
                    {data.systemAlerts.map((alert, i) => (
                        <AlertBanner key={i} alert={alert} />
                    ))}
                </div>
            )}

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard
                    label="Cancel rate"
                    value={(data?.cancelRate ?? 0).toFixed(1)}
                    suffix="%"
                    highlight={(data?.cancelRate ?? 0) > 10}
                />
                <KpiCard
                    label="Refund rate"
                    value={(data?.refundRate ?? 0).toFixed(1)}
                    suffix="%"
                    highlight={(data?.refundRate ?? 0) > 5}
                />
                <KpiCard
                    label="Avg completion"
                    value={data?.avgCompletionMinutes != null ? `${data.avgCompletionMinutes}m` : "—"}
                />
                <KpiCard
                    label="ETA hit rate"
                    value={data?.etaHitRate != null ? `${data.etaHitRate.toFixed(1)}%` : "—"}
                    highlight={data?.etaHitRate != null && data.etaHitRate < 70}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Open tickets by priority */}
                <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border/30 dark:border-wg-dark-border">
                        <h3 className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text">Open tickets by priority</h3>
                        <Link href="/tickets" className="text-xs font-medium text-wg-accent dark:text-wg-dark-accent hover:underline">View all</Link>
                    </div>
                    <div className="p-5 space-y-2">
                        {!data || data.openTickets.length === 0 ? (
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted text-center py-4">No open tickets</p>
                        ) : (
                            data.openTickets.map((t) => (
                                <div key={t.priority} className="flex items-center justify-between">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                                        {t.priority}
                                    </span>
                                    <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text tabular-nums">
                                        {t.count}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent reviews */}
                <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border/30 dark:border-wg-dark-border">
                        <div>
                            <h3 className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                                Reviews
                                {data?.reviewsAvg != null && (
                                    <span className="ml-2 font-normal text-wg-muted dark:text-wg-dark-muted">
                                        avg {data.reviewsAvg.toFixed(1)}/5
                                    </span>
                                )}
                            </h3>
                        </div>
                        <Link href="/reviews" className="text-xs font-medium text-wg-accent dark:text-wg-dark-accent hover:underline">View all</Link>
                    </div>
                    <div className="divide-y divide-wg-border/20 dark:divide-wg-dark-border/20">
                        {!data || data.recentReviews.length === 0 ? (
                            <p className="px-5 py-6 text-sm text-wg-muted dark:text-wg-dark-muted text-center">No reviews yet</p>
                        ) : (
                            data.recentReviews.map((r) => (
                                <div key={r.id} className="px-5 py-3">
                                    <StarRating rating={r.rating} />
                                    <p className="text-sm text-wg-text dark:text-wg-dark-text mt-1 line-clamp-2">{r.comment}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
