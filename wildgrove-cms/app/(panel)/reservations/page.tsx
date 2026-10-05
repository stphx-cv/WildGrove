"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Reservations List Page — /reservations
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { ArrowPathIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon, TrashIcon } from "@wildgrove/ui/icons"
import { createClient } from "@wildgrove/core/clients/client"
import {
    ADMIN_RESERVATIONS_LIST_CHANNEL,
    ADMIN_RESERVATION_CREATED_EVENT,
    ADMIN_RESERVATION_UPDATED_EVENT,
} from "@wildgrove/core/admin/reservationsRealtimeShared"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { AdminSelect } from "@/components/AdminSelect"
import { AdminDatePicker } from "@/components/AdminDatePicker"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"

interface ReservationRow {
    id: string
    date: string
    partySize: number
    notes: string | null
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
    adminViewedAt: string | null
    hiddenByAdmin: boolean
    createdAt: string
    profile: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
        phoneNumber: string | null
    }
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

type ActionType = "reopen" | "delete"

interface PendingAction {
    type: ActionType
    item: ReservationRow
}

const ACTION_CONFIG: Record<ActionType, { title: string; message: (item: ReservationRow) => string; confirmLabel: string; variant: "danger" | "warning" }> = {
    reopen: {
        title: "Reopen reservation",
        message: (item) => `Reopen the reservation for ${item.profile.firstName} ${item.profile.lastName}? Status will be set back to Pending.`,
        confirmLabel: "Reopen",
        variant: "warning",
    },
    delete: {
        title: "Delete reservation",
        message: (item) => `Permanently delete the reservation for ${item.profile.firstName} ${item.profile.lastName}? This action cannot be undone.`,
        confirmLabel: "Delete",
        variant: "danger",
    },
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

type ReservationListPayload = { items: ReservationRow[]; pagination: PaginationData }

export default function AdminReservationsPage() {
    const { formatDate, formatTime } = useAdminAppDateTime()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [dateFilter, setDateFilter] = useState("")
    const [visibilityFilter, setVisibilityFilter] = useState("")
    const [page, setPage] = useState(1)
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [hidingId, setHidingId] = useState<string | null>(null)

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (search) params.set("search", search)
        if (statusFilter) params.set("status", statusFilter)
        if (dateFilter) params.set("date", dateFilter)
        if (visibilityFilter) params.set("visibility", visibilityFilter)
        return `/api/reservations?${params}`
    }, [page, search, statusFilter, dateFilter, visibilityFilter])

    const { data: list, isLoading, mutate: mutateList } = useCmsQuery<ReservationListPayload>(listKey)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION

    const refreshList = useCallback(() => { void invalidateCms("/api/reservations") }, [])

    useEffect(() => { setPage(1) }, [search, statusFilter, dateFilter, visibilityFilter])

    useEffect(() => {
        const insforge = createClient()
        const channel = insforge.channel(ADMIN_RESERVATIONS_LIST_CHANNEL)
        channel
            .on("broadcast", { event: ADMIN_RESERVATION_CREATED_EVENT }, () => { refreshList() })
            .on("broadcast", { event: ADMIN_RESERVATION_UPDATED_EVENT }, () => { refreshList() })
            .subscribe()
        return () => { insforge.removeChannel(channel) }
    }, [refreshList])

    const toggleHidden = useCallback(async (item: ReservationRow) => {
        setHidingId(item.id)
        try {
            const res = await fetch(`/api/reservations/${item.id}`, {
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
                    // The row leaves this filter and the totals change with it;
                    // step back off a page that just emptied before refetching.
                    if (items.length === 1 && page > 1) setPage((p) => p - 1)
                    refreshList()
                }
            }
        } catch (error) {
            console.error("Failed to toggle reservation visibility:", error)
        } finally {
            setHidingId(null)
        }
    }, [visibilityFilter, page, items.length, mutateList, refreshList])

    const handleActionConfirm = useCallback(async () => {
        if (!pendingAction) return
        const { type, item } = pendingAction

        setIsActionLoading(true)
        try {
            if (type === "reopen") {
                await fetch(`/api/reservations/${item.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "PENDING" }),
                })
            } else if (type === "delete") {
                await fetch(`/api/reservations/${item.id}`, { method: "DELETE" })
            }
            setPendingAction(null)
            refreshList()
        } finally {
            setIsActionLoading(false)
        }
    }, [pendingAction, refreshList])

    const columns: Column<ReservationRow>[] = useMemo(() => [
        {
            key: "customer",
            label: "Customer",
            render: (item) => (
                <div className="flex items-start gap-2">
                    {!item.adminViewedAt && (
                        <span
                            className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            title="New — not yet opened"
                            aria-hidden
                        />
                    )}
                    <div className="min-w-0">
                        <span className="font-medium">
                            {item.profile.firstName} {item.profile.lastName}
                        </span>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">{item.profile.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "date",
            label: "Date & Time",
            sortable: true,
            render: (item) => {
                const dt = new Date(item.date)
                return (
                    <div>
                        <span className="tabular-nums">{formatDate(dt)}</span>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted tabular-nums">{formatTime(dt)}</p>
                    </div>
                )
            },
        },
        {
            key: "partySize",
            label: "Guests",
            render: (item) => (
                <span className="tabular-nums">{item.partySize}</span>
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
            className: "w-32",
            render: (item) => (
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => { e.stopPropagation(); e.preventDefault() }}>
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

                    {item.status === "CANCELLED" && (
                        <button
                            type="button"
                            onClick={() => setPendingAction({ type: "reopen", item })}
                            className="p-1.5 rounded-brand text-wg-muted hover:text-amber-500 hover:bg-amber-500/10 dark:text-wg-dark-muted dark:hover:text-amber-400 dark:hover:bg-amber-500/10 transition-colors"
                            aria-label="Reopen reservation"
                            title="Reopen reservation"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setPendingAction({ type: "delete", item })}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-red-500 hover:bg-red-500/10 dark:text-wg-dark-muted dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                        aria-label="Delete reservation"
                        title="Delete reservation"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>

                    <Link
                        href={`/reservations/${item.id}`}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
                        aria-label="View details"
                        title="View details"
                        onClick={(e) => e.stopPropagation()}
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
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Reservations</h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Manage and review customer reservations</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <SearchInput value={search} onChange={setSearch} placeholder="Search customer name or email..." className="sm:w-72" />
                <AdminSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="All Statuses"
                    options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "CONFIRMED", label: "Confirmed" },
                        { value: "COMPLETED", label: "Completed" },
                        { value: "CANCELLED", label: "Cancelled" },
                    ]}
                    className="sm:w-40"
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
                        { value: "all", label: "All reservations" },
                    ]}
                    className="sm:w-44"
                />
            </div>

            <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                loadingMessage="Loading reservations…"
                rowHref={(item) => `/reservations/${item.id}`}
                emptyMessage={visibilityFilter === "hidden" ? "No hidden reservations" : "No reservations found"}
            />

            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={setPage}
            />

            {pendingAction && (
                <ConfirmDialog
                    isOpen
                    onClose={() => !isActionLoading && setPendingAction(null)}
                    onConfirm={handleActionConfirm}
                    title={ACTION_CONFIG[pendingAction.type].title}
                    message={ACTION_CONFIG[pendingAction.type].message(pendingAction.item)}
                    confirmLabel={ACTION_CONFIG[pendingAction.type].confirmLabel}
                    variant={ACTION_CONFIG[pendingAction.type].variant}
                    isLoading={isActionLoading}
                />
            )}
        </div>
    )
}
