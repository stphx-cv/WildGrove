"use client"

import dynamic from "next/dynamic"
import { useDashboardData } from "@/hooks/useDashboardData"
import { StatCardWithTrend, StatCardSkeleton } from "@/components/dashboard/StatCardWithTrend"
import type { FinancialDTO } from "@/lib/admin/dashboard-types"
import type { DatePreset } from "@/hooks/useDashboardDateRange"
import { LoadingState } from "@/components/LoadingState"
import { BanknotesIcon, ClipboardDocumentTextIcon, CurrencyDollarCircleIcon } from "@wildgrove/ui/icons"

// Lazy-load all recharts-based charts (no SSR)
const RevenueLineChart  = dynamic(() => import("@/components/dashboard/charts/RevenueLineChart").then((m) => ({ default: m.RevenueLineChart })), { ssr: false, loading: () => <ChartSkeleton /> })
const PaymentMethodDonut = dynamic(() => import("@/components/dashboard/charts/PaymentMethodDonut").then((m) => ({ default: m.PaymentMethodDonut })), { ssr: false, loading: () => <ChartSkeleton /> })
const HoursHeatmap      = dynamic(() => import("@/components/dashboard/charts/HoursHeatmap").then((m) => ({ default: m.HoursHeatmap })), { ssr: false, loading: () => <ChartSkeleton /> })
const WeekdayBars       = dynamic(() => import("@/components/dashboard/charts/WeekdayBars").then((m) => ({ default: m.WeekdayBars })), { ssr: false, loading: () => <ChartSkeleton /> })

function ChartSkeleton() {
    return <LoadingState size="section" message="Loading chart…" className="h-48 justify-center" />
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-5">
            <h3 className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text mb-4">{title}</h3>
            {children}
        </div>
    )
}

interface Props {
    rangeQuery: string
    preset: DatePreset
}

export function FinancialSection({ rangeQuery, preset }: Props) {
    const { data, isLoading } = useDashboardData<FinancialDTO>({
        endpoint: `/api/dashboard/financial?${rangeQuery}`,
        intervalMs: 30_000,
    })

    const trendLabel = preset === "today" ? "vs yesterday" : "vs previous period"

    return (
        <section aria-labelledby="financial-heading" className="space-y-6">
            <h2 id="financial-heading" className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                Financial
            </h2>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {isLoading && !data ? (
                    Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCardWithTrend
                            title="Revenue PEN"
                            value={`S/ ${(data?.revenuePen ?? 0).toFixed(2)}`}
                            trend={data?.trend.revenuePen}
                            trendLabel={trendLabel}
                            icon={<CurrencyDollarCircleIcon className="w-5 h-5" />}
                        />
                        <StatCardWithTrend
                            title="Revenue USD"
                            value={`$ ${(data?.revenueUsd ?? 0).toFixed(2)}`}
                            trend={data?.trend.revenueUsd}
                            trendLabel={trendLabel}
                            icon={<CurrencyDollarCircleIcon className="w-5 h-5" />}
                        />
                        <StatCardWithTrend
                            title="Orders"
                            value={data?.orderCount ?? 0}
                            trend={data?.trend.orderCount}
                            trendLabel={trendLabel}
                            icon={<ClipboardDocumentTextIcon className="w-5 h-5" />}
                        />
                        <StatCardWithTrend
                            title="Avg ticket (PEN)"
                            value={`S/ ${(data?.avgTicketPen ?? 0).toFixed(2)}`}
                            trend={data?.trend.avgTicketPen}
                            trendLabel={trendLabel}
                            icon={<BanknotesIcon className="w-5 h-5" />}
                            tooltip="Average order value for PEN orders in the period"
                        />
                    </>
                )}
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ChartCard title="Revenue trend — last 30 days">
                        <RevenueLineChart data={data?.dailyRevenue ?? []} />
                    </ChartCard>
                </div>
                <ChartCard title="Payment methods">
                    <PaymentMethodDonut data={data?.paymentMethods ?? []} />
                </ChartCard>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Revenue heatmap — last 7 days (hour × day)">
                    <HoursHeatmap data={data?.hoursHeatmap ?? []} />
                </ChartCard>
                <ChartCard title="Orders by day of week">
                    <WeekdayBars data={data?.weekdayBars ?? []} />
                </ChartCard>
            </div>
        </section>
    )
}
