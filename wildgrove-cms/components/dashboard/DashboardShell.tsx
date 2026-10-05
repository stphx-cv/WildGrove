"use client"

import { Suspense } from "react"
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange"
import { DateRangePicker } from "@/components/dashboard/DateRangePicker"
import { OperationsSection } from "@/components/dashboard/sections/OperationsSection"
import { FinancialSection } from "@/components/dashboard/sections/FinancialSection"
import { ProductsCustomersSection } from "@/components/dashboard/sections/ProductsCustomersSection"
import { OperationalHealthSection } from "@/components/dashboard/sections/OperationalHealthSection"
import { LoadingState } from "@/components/LoadingState"

interface Props {
    defaultPreset?: string
}

function DashboardContent({ defaultPreset }: Props) {
    const { preset, setPreset, rangeQuery } = useDashboardDateRange(
        (defaultPreset as Parameters<typeof useDashboardDateRange>[0]) ?? "today"
    )

    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                        Dashboard
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                        Restaurant operations at a glance
                    </p>
                </div>
                <DateRangePicker preset={preset} onPresetChange={setPreset} />
            </div>

            {/* Section 1 — Operations (live, 5s) */}
            <div className="border-t border-wg-border/30 dark:border-wg-dark-border pt-8">
                <OperationsSection />
            </div>

            {/* Section 2 — Financial (30s, range-aware) */}
            <div className="border-t border-wg-border/30 dark:border-wg-dark-border pt-8">
                <FinancialSection rangeQuery={rangeQuery} preset={preset} />
            </div>

            {/* Section 3 — Products & Customers (30s, range-aware) */}
            <div className="border-t border-wg-border/30 dark:border-wg-dark-border pt-8">
                <ProductsCustomersSection rangeQuery={rangeQuery} />
            </div>

            {/* Section 4 — Operational Health (30s, range-aware) */}
            <div className="border-t border-wg-border/30 dark:border-wg-dark-border pt-8">
                <OperationalHealthSection rangeQuery={rangeQuery} />
            </div>
        </div>
    )
}

export function DashboardShell({ defaultPreset }: Props) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent defaultPreset={defaultPreset} />
        </Suspense>
    )
}

function DashboardSkeleton() {
    return <LoadingState size="page" message="Loading dashboard…" />
}
