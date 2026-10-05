"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Orders List Page — /orders
// Filters: search (orderNumber / customerName), status, fulfillment, date, visibility
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { ChevronRightIcon, EyeIcon, EyeSlashIcon, StorefrontWindowIcon, TruckIcon } from "@wildgrove/ui/icons"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { AdminSelect } from "@/components/AdminSelect"
import { AdminDatePicker } from "@/components/AdminDatePicker"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"

interface OrderRow {
    id: string
    orderNumber: number
    status: string
    fulfillment: "PICKUP" | "DELIVERY"
    currency: string
    total: string
    paymentMethod: string
    scheduledFor: string | null
    createdAt: string
    customerName: string | null
    hiddenByAdmin: boolean
    profile: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
    }
    items: { nameSnapshot: string; quantity: number }[]
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

function formatCurrency(amount: string | number, currency: string) {
    const n = typeof amount === "string" ? parseFloat(amount) : amount
    if (currency === "USD") return `$${n.toFixed(2)}`
    return `S/ ${n.toFixed(2)}`
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

type OrderListPayload = { items: OrderRow[]; pagination: PaginationData }

export default function AdminOrdersPage() {
    const { formatDate, formatTime } = useAdminAppDateTime()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [fulfillmentFilter, setFulfillmentFilter] = useState("")
    const [dateFilter, setDateFilter] = useState("")
    const [visibilityFilter, setVisibilityFilter] = useState("")
    const [page, setPage] = useState(1)
    const [hidingId, setHidingId] = useState<string | null>(null)

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (search) params.set("search", search)
        if (statusFilter) params.set("status", statusFilter)
        if (fulfillmentFilter) params.set("fulfillment", fulfillmentFilter)
        if (dateFilter) params.set("date", dateFilter)
        if (visibilityFilter) params.set("visibility", visibilityFilter)
        return `/api/orders?${params}`
    }, [page, search, statusFilter, fulfillmentFilter, dateFilter, visibilityFilter])

    const { data: list, isLoading, mutate: mutateList } = useCmsQuery<OrderListPayload>(listKey)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION

    useEffect(() => { setPage(1) }, [search, statusFilter, fulfillmentFilter, dateFilter, visibilityFilter])

    const toggleHidden = useCallback(async (item: OrderRow) => {
        setHidingId(item.id)
        try {
            const res = await fetch(`/api/orders/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hiddenByAdmin: !item.hiddenByAdmin }),
            })
            const json = await res.json()
            if (json.success) {
                if (visibilityFilter === "all") {
                    // The row stays, only its flag changes: update it in place.
                    void mutateList(
                        (current) =>
                            current && {
                                ...current,
                                items: current.items.map((row) =>
                                    row.id === item.id ? { ...row, hiddenByAdmin: !item.hiddenByAdmin } : row,
                                ),
                            },
                        { revalidate: false },
                    )
                } else {
                    // The row leaves this filter, and the totals change with it.
                    // Stepping back off a page that just emptied has to happen
                    // before the refetch, or the refetch asks for a page that
                    // no longer exists.
                    if (items.length === 1 && page > 1) setPage((p) => p - 1)
                    void invalidateCms("/api/orders")
                }
            }
        } catch (error) {
            console.error("Failed to toggle order visibility:", error)
        } finally {
            setHidingId(null)
        }
    }, [visibilityFilter, page, items.length, mutateList])

    const columns: Column<OrderRow>[] = useMemo(() => [
        {
            key: "orderNumber",
            label: "Order",
            render: (item) => (
                <div>
                    <span className="font-mono font-semibold text-wg-text dark:text-wg-dark-text">
                        #{item.orderNumber}
                    </span>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted tabular-nums mt-0.5">
                        {formatDate(new Date(item.createdAt))} · {formatTime(new Date(item.createdAt))}
                    </p>
                </div>
            ),
        },
        {
            key: "customer",
            label: "Customer",
            render: (item) => {
                const name = item.customerName
                    || [item.profile.firstName, item.profile.lastName].filter(Boolean).join(" ")
                    || "—"
                return (
                    <div className="min-w-0">
                        <span className="font-medium text-wg-text dark:text-wg-dark-text truncate block">{name}</span>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">{item.profile.email ?? "—"}</p>
                    </div>
                )
            },
        },
        {
            key: "items",
            label: "Items",
            className: "hidden md:table-cell",
            render: (item) => {
                const preview = item.items.slice(0, 2).map(i => `${i.quantity}× ${i.nameSnapshot}`).join(", ")
                return (
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted line-clamp-1">
                        {preview}
                    </span>
                )
            },
        },
        {
            key: "total",
            label: "Total",
            render: (item) => (
                <span className="font-semibold tabular-nums text-wg-text dark:text-wg-dark-text">
                    {formatCurrency(item.total, item.currency)}
                </span>
            ),
        },
        {
            key: "fulfillment",
            label: "Type",
            className: "hidden sm:table-cell",
            render: (item) => (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-wg-muted dark:text-wg-dark-muted">
                    {item.fulfillment === "DELIVERY" ? (
                        <>
                            <TruckIcon className="w-3.5 h-3.5" />
                            Delivery
                        </>
                    ) : (
                        <>
                            <StorefrontWindowIcon className="w-3.5 h-3.5" />
                            Pickup
                        </>
                    )}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (item) => (
                <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.hiddenByAdmin && visibilityFilter === "all" && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                            Hidden
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: "actions",
            label: "",
            className: "w-20",
            render: (item) => (
                <div className="flex items-center justify-end" onClick={(e) => { e.stopPropagation(); e.preventDefault() }}>
                    <button
                        type="button"
                        onClick={() => toggleHidden(item)}
                        disabled={hidingId === item.id}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors disabled:opacity-50"
                        aria-label={item.hiddenByAdmin ? "Show in queue" : "Hide from queue"}
                        title={item.hiddenByAdmin ? "Show in queue" : "Hide from queue"}
                    >
                        {item.hiddenByAdmin ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                    </button>
                    <Link
                        href={`/orders/${item.id}`}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors flex items-center"
                        aria-label="View order"
                        title="View order"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </Link>
                </div>
            ),
        },
    ], [formatDate, formatTime, hidingId, toggleHidden, visibilityFilter])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Orders</h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Manage customer orders, update status and handle refunds
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search order # or customer…"
                    className="sm:w-64"
                />
                <AdminSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="All Statuses"
                    options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "PREPARING", label: "Preparing" },
                        { value: "READY", label: "Ready" },
                        { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
                        { value: "COMPLETED", label: "Completed" },
                        { value: "CANCELLED", label: "Cancelled" },
                        { value: "REFUNDED", label: "Refunded" },
                    ]}
                    className="sm:w-44"
                />
                <AdminSelect
                    value={fulfillmentFilter}
                    onChange={setFulfillmentFilter}
                    placeholder="All Types"
                    options={[
                        { value: "PICKUP", label: "Pickup" },
                        { value: "DELIVERY", label: "Delivery" },
                    ]}
                    className="sm:w-36"
                />
                <AdminDatePicker
                    value={dateFilter}
                    onChange={setDateFilter}
                    mode="date"
                    placeholder="Filter by date"
                    className="sm:w-44"
                />
                <AdminSelect
                    value={visibilityFilter}
                    onChange={setVisibilityFilter}
                    placeholder="Visible"
                    options={[
                        { value: "hidden", label: "Hidden", icon: <EyeSlashIcon className="w-4 h-4" /> },
                        { value: "all", label: "All orders" },
                    ]}
                    className="sm:w-40"
                />
            </div>

            <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                loadingMessage="Loading orders…"
                rowHref={(item) => `/orders/${item.id}`}
                emptyMessage={visibilityFilter === "hidden" ? "No hidden orders" : "No orders found"}
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
