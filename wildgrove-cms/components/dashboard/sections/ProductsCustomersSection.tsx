"use client"

import dynamic from "next/dynamic"
import { memo } from "react"
import Link from "next/link"
import { useDashboardData } from "@/hooks/useDashboardData"
import type { ProductsCustomersDTO, TopMenuItem, TopCustomer } from "@/lib/admin/dashboard-types"
import { LoadingState } from "@/components/LoadingState"

const CategoriesPie = dynamic(
    () => import("@/components/dashboard/charts/CategoriesPie").then((m) => ({ default: m.CategoriesPie })),
    { ssr: false, loading: () => <LoadingState size="section" message="Loading chart…" className="h-48 justify-center" /> }
)

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-wg-border/30 dark:border-wg-dark-border">
                <h3 className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text">{title}</h3>
            </div>
            {children}
        </div>
    )
}

const TopItemRow = memo(function TopItemRow({ item, rank }: { item: TopMenuItem; rank: number }) {
    return (
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-wg-border/15 dark:border-wg-dark-border/15 last:border-0 hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/10">
            <span className="w-5 text-xs font-bold text-wg-muted dark:text-wg-dark-muted tabular-nums">{rank}</span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">{item.name}</p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{item.qty} sold</p>
            </div>
            <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text tabular-nums">
                S/{item.revenue.toFixed(2)}
            </span>
        </div>
    )
})

const TopCustomerRow = memo(function TopCustomerRow({ customer, rank }: { customer: TopCustomer; rank: number }) {
    return (
        <Link
            href={`/customers/${customer.profileId}`}
            className="flex items-center gap-3 px-5 py-2.5 border-b border-wg-border/15 dark:border-wg-dark-border/15 last:border-0 hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-accent"
        >
            <span className="w-5 text-xs font-bold text-wg-muted dark:text-wg-dark-muted tabular-nums">{rank}</span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">{customer.name ?? "Anonymous"}</p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{customer.orderCount} orders</p>
            </div>
            <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text tabular-nums">
                S/{customer.totalSpend.toFixed(2)}
            </span>
        </Link>
    )
})

interface Props {
    rangeQuery: string
}

export function ProductsCustomersSection({ rangeQuery }: Props) {
    const { data, isLoading } = useDashboardData<ProductsCustomersDTO>({
        endpoint: `/api/dashboard/products-customers?${rangeQuery}`,
        intervalMs: 30_000,
    })

    const isEmpty = !data || (data.topItems.length === 0 && data.topCustomers.length === 0)

    return (
        <section aria-labelledby="pc-heading" className="space-y-6">
            <h2 id="pc-heading" className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                Products &amp; Customers
            </h2>

            {/* Wallet circulation + new customers row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(data?.walletCirculation ?? []).map((w) => (
                    <div key={w.currency} className="p-5 rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
                        <dl>
                            <dd className="text-2xl font-display font-bold text-wg-text dark:text-wg-dark-text tabular-nums">
                                {w.currency === "PEN" ? "S/ " : "$ "}{w.totalBalance.toFixed(2)}
                            </dd>
                            <dt className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
                                Wallet {w.currency} in circulation
                            </dt>
                        </dl>
                    </div>
                ))}
                <div className="p-5 rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
                    <dl>
                        <dd className="text-2xl font-display font-bold text-wg-text dark:text-wg-dark-text tabular-nums">
                            {isLoading && !data ? "—" : data?.newCustomers ?? 0}
                        </dd>
                        <dt className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">New customers</dt>
                    </dl>
                </div>
                <div className="p-5 rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
                    <dl>
                        <dd className="text-2xl font-display font-bold text-wg-text dark:text-wg-dark-text tabular-nums">
                            {isLoading && !data ? "—" : `${data?.returningPct ?? 0}%`}
                        </dd>
                        <dt className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">Returning customers</dt>
                    </dl>
                </div>
            </div>

            {isEmpty && !isLoading ? (
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted text-center py-8">
                    No order data for this period
                </p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TableCard title="Top 10 menu items">
                        {(data?.topItems ?? []).length === 0 ? (
                            <p className="px-5 py-6 text-sm text-wg-muted dark:text-wg-dark-muted text-center">No items sold</p>
                        ) : (
                            <div>
                                {(data?.topItems ?? []).map((item, i) => (
                                    <TopItemRow key={item.menuItemId} item={item} rank={i + 1} />
                                ))}
                            </div>
                        )}
                    </TableCard>

                    <div className="space-y-6">
                        <TableCard title="Top customers">
                            {(data?.topCustomers ?? []).length === 0 ? (
                                <p className="px-5 py-6 text-sm text-wg-muted dark:text-wg-dark-muted text-center">No customer data</p>
                            ) : (
                                <div>
                                    {(data?.topCustomers ?? []).map((c, i) => (
                                        <TopCustomerRow key={c.profileId} customer={c} rank={i + 1} />
                                    ))}
                                </div>
                            )}
                        </TableCard>

                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-5">
                            <h3 className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text mb-4">Revenue by category</h3>
                            <CategoriesPie data={data?.categoryRevenue ?? []} />
                        </div>
                    </div>
                </div>
            )}

            {/* Low performers */}
            {data && data.lowPerformers.length > 0 && (
                <div className="rounded-card border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                    <h3 className="font-display text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">
                        Low performers (less than {data.lowStockThreshold} sold in period)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {data.lowPerformers.map((item) => (
                            <span
                                key={item.menuItemId}
                                className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                            >
                                {item.name} ({item.qty} sold)
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}
