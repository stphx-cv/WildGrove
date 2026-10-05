"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Wallets List — /wallets
// Columns: Customer, Balance PEN, Balance USD, Last Activity
// ══════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react"
import Link from "next/link"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { AdminSelect } from "@/components/AdminSelect"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { useCmsQuery } from "@/lib/cms-query"
import { ChevronRightIcon } from "@wildgrove/ui/icons"

interface WalletRow {
    id: string // required by DataTable (equals profileId)
    profileId: string
    firstName: string | null
    lastName: string | null
    email: string | null
    avatarUrl: string | null
    balancePEN: string | null
    balanceUSD: string | null
    lastActivity: string | null
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

/** Phase G2 — null = no wallet row yet; "0.00" = muted; balance &gt; 0 = emphasis */
function WalletBalanceCell({ amount, currency }: { amount: string | null; currency: "PEN" | "USD" }) {
    if (amount === null) {
        return <span className="text-sm text-wg-muted dark:text-wg-dark-muted">—</span>
    }
    const n = Number.parseFloat(amount)
    const isZero = !Number.isNaN(n) && n === 0
    const tone = isZero ? "text-wg-muted dark:text-wg-dark-muted" : "text-wg-text dark:text-wg-dark-text"
    const prefix = currency === "PEN" ? "S/ " : "$ "
    return (
        <span className={`font-semibold tabular-nums text-sm ${tone}`}>
            {prefix}{amount}
        </span>
    )
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

type WalletListPayload = { items: WalletRow[]; pagination: PaginationData }

export default function AdminWalletsPage() {
    const { formatDate, formatTime } = useAdminAppDateTime()
    const [search, setSearch] = useState("")
    const [currencyFilter, setCurrencyFilter] = useState("")
    const [page, setPage] = useState(1)

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (search) params.set("search", search)
        if (currencyFilter) params.set("currency", currencyFilter)
        return `/api/wallets?${params}`
    }, [page, search, currencyFilter])

    const { data: list, isLoading } = useCmsQuery<WalletListPayload>(listKey)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION

    // Back to page 1 when the filters change. Derived-state-from-props rather
    // than an effect: the render that changes the filter is the render that
    // resets the page.
    const filterKey = `${search}|${currencyFilter}`
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
    if (prevFilterKey !== filterKey) {
        setPrevFilterKey(filterKey)
        setPage(1)
    }

    const columns: Column<WalletRow>[] = useMemo(() => [
        {
            key: "customer",
            label: "Customer",
            render: (item) => {
                const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || "—"
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                            {item.avatarUrl ? (
                                <FadeInImage
                                    src={item.avatarUrl}
                                    alt=""
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-xs font-semibold text-wg-accent dark:text-wg-dark-accent">
                                    {(item.firstName?.[0] ?? item.email?.[0] ?? "?").toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <span className="font-medium text-wg-text dark:text-wg-dark-text truncate block">{name}</span>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">{item.email ?? "—"}</p>
                        </div>
                    </div>
                )
            },
        },
        {
            key: "balancePEN",
            label: "Balance PEN",
            render: (item) => <WalletBalanceCell amount={item.balancePEN} currency="PEN" />,
        },
        {
            key: "balanceUSD",
            label: "Balance USD",
            className: "hidden sm:table-cell",
            render: (item) => <WalletBalanceCell amount={item.balanceUSD} currency="USD" />,
        },
        {
            key: "lastActivity",
            label: "Last Activity",
            className: "hidden md:table-cell",
            render: (item) => (
                item.lastActivity ? (
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted tabular-nums">
                        {formatDate(new Date(item.lastActivity))} · {formatTime(new Date(item.lastActivity))}
                    </span>
                ) : (
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted">Never</span>
                )
            ),
        },
        {
            key: "actions",
            label: "",
            className: "w-12",
            render: (item) => (
                <div onClick={(e) => { e.stopPropagation(); e.preventDefault() }}>
                    <Link
                        href={`/wallets/${item.profileId}`}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors flex items-center"
                        aria-label="View wallet"
                        title="View wallet"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </Link>
                </div>
            ),
        },
    ], [formatDate, formatTime])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Wallets</h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Manage customer wallet balances, recharge and review transaction history
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search customer name or email…"
                    className="sm:w-72"
                />
                <AdminSelect
                    value={currencyFilter}
                    onChange={setCurrencyFilter}
                    placeholder="All Currencies"
                    options={[
                        { value: "PEN", label: "PEN — Soles" },
                        { value: "USD", label: "USD — Dollars" },
                    ]}
                    className="sm:w-44"
                />
            </div>

            <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                loadingMessage="Loading wallets…"
                rowHref={(item) => `/wallets/${item.profileId}`}
                emptyMessage="No customers found"
            />

            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={setPage}
            />
        </div>
    )
}
