"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Notifications — /notifications
// Full management page: filter, search, bulk actions, read/unread,
// delete. Unread rows are visually accented; clicking navigates to
// the related entity and marks the notification as read.
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { SearchInput } from "@/components/SearchInput"
import { AdminSelect, type SelectOption } from "@/components/AdminSelect"
import { Pagination } from "@/components/Pagination"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { cmsPanelPath } from "@wildgrove/core/urls"
import { LoadingState } from "@/components/LoadingState"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import {
    BellFlaredIcon,
    CalendarBandIcon,
    ChatBubbleEllipsisIcon,
    CheckIcon,
    ChevronRightIcon,
    EyeIcon,
    EyeSlashIcon,
    TicketIcon,
    TrashIcon,
    UserIcon,
} from "@wildgrove/ui/icons"

// ── Types ────────────────────────────────────────────────────────

interface NotificationItem {
    id: string
    type: string
    entityType: string
    entityId: string
    title: string
    message: string
    href: string | null
    isRead: boolean
    createdAt: string
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

type ReadFilter = "all" | "read" | "unread"
type CategoryFilter = "" | "reservations" | "customers" | "chat" | "tickets"

interface PendingAction {
    title: string
    message: string
    confirmLabel: string
    variant: "danger" | "warning"
    onConfirm: () => Promise<void>
}

// ── Constants ────────────────────────────────────────────────────

const CATEGORY_TYPE_MAP: Record<string, string[]> = {
    reservations: [
        "RESERVATION_CREATED",
        "RESERVATION_CANCELLED",
        "RESERVATION_RESCHEDULED",
        "RESERVATION_CHANGE_REQUESTED",
    ],
    customers: ["CUSTOMER_CREATED", "PROFILE_UPDATED"],
    chat: ["CHAT_SESSION_CREATED", "CHAT_MESSAGE_RECEIVED", "CHAT_ESCALATED"],
    tickets: ["TICKET_CREATED", "TICKET_REPLY_RECEIVED"],
}

const READ_FILTER_OPTIONS: SelectOption[] = [
    { value: "all", label: "All notifications" },
    { value: "unread", label: "Unread only" },
    { value: "read", label: "Read only" },
]

const CATEGORY_OPTIONS: SelectOption[] = [
    { value: "reservations", label: "Reservations" },
    { value: "customers", label: "Customers" },
    { value: "chat", label: "Chat" },
    { value: "tickets", label: "Tickets" },
]

// ── Per-type icon + color config ─────────────────────────────────

interface TypeConfig {
    bg: string
    icon: React.ReactNode
}

function getTypeConfig(type: string): TypeConfig {
    // Reservation icons
    const calendarIcon = <CalendarBandIcon className="w-4 h-4" />
    const userIcon = <UserIcon className="w-4 h-4" />
    const chatIcon = <ChatBubbleEllipsisIcon className="w-4 h-4" />
    const ticketIcon = <TicketIcon className="w-4 h-4" />

    const MAP: Record<string, TypeConfig> = {
        RESERVATION_CREATED: {
            bg: "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary",
            icon: calendarIcon,
        },
        RESERVATION_CANCELLED: {
            bg: "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
            icon: calendarIcon,
        },
        RESERVATION_RESCHEDULED: {
            bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
            icon: calendarIcon,
        },
        RESERVATION_CHANGE_REQUESTED: {
            bg: "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
            icon: calendarIcon,
        },
        CUSTOMER_CREATED: {
            bg: "bg-violet-100 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
            icon: userIcon,
        },
        PROFILE_UPDATED: {
            bg: "bg-violet-100 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
            icon: userIcon,
        },
        CHAT_SESSION_CREATED: {
            bg: "bg-sky-100 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
            icon: chatIcon,
        },
        CHAT_MESSAGE_RECEIVED: {
            bg: "bg-sky-100 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
            icon: chatIcon,
        },
        CHAT_ESCALATED: {
            bg: "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
            icon: chatIcon,
        },
        TICKET_CREATED: {
            bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
            icon: ticketIcon,
        },
        TICKET_REPLY_RECEIVED: {
            bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
            icon: ticketIcon,
        },
    }

    return (
        MAP[type] ?? {
            bg: "bg-wg-border/30 text-wg-muted dark:bg-wg-dark-border dark:text-wg-dark-muted",
            icon: (
                <BellFlaredIcon className="w-4 h-4" />
            ),
        }
    )
}

// ── Relative time helper ─────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatAbsoluteTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: 20, total: 0, totalPages: 0 }

/** What `GET /api/notifications` returns: the rows and the two counts together. */
type NotificationsPayload = {
    items: NotificationItem[]
    totalCount: number
    unreadCount: number
    pagination: PaginationData
}

// ── Page Component ───────────────────────────────────────────────

export default function AdminNotificationsPage() {
    const router = useRouter()

    // Filters
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [readFilter, setReadFilter] = useState<ReadFilter>("all")
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("")

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isBulkActing, setIsBulkActing] = useState(false)

    // Confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
    const [isConfirming, setIsConfirming] = useState(false)

    // ── Data ─────────────────────────────────────────────────────

    const listKey = useMemo(() => {
        const params = new URLSearchParams({
            page: String(page),
            limit: "20",
            filter: readFilter,
        })
        if (search) params.set("search", search)
        if (categoryFilter) {
            params.set("type", CATEGORY_TYPE_MAP[categoryFilter].join(","))
        }
        return `/api/notifications?${params.toString()}`
    }, [page, search, readFilter, categoryFilter])

    const { data, isLoading, mutate: mutateList } = useCmsQuery<NotificationsPayload>(listKey)

    const items = data?.items ?? []
    const pagination = data?.pagination ?? EMPTY_PAGINATION
    const totalCount = data?.totalCount ?? 0
    const unreadCount = data?.unreadCount ?? 0

    /**
     * Rewrites this page's cached payload without a request. Every row action
     * below is optimistic: the endpoint has already been told, and the counts
     * move with the rows because they live in the same payload.
     */
    const patchCached = useCallback(
        (next: (current: NotificationsPayload) => NotificationsPayload) =>
            mutateList((current) => current && next(current), { revalidate: false }),
        [mutateList],
    )

    const refreshList = useCallback(() => { void invalidateCms("/api/notifications") }, [])

    // ── Notify bell of local changes via window event ────────────────

    const broadcastUpdate = useCallback(() => {
        window.dispatchEvent(new CustomEvent("admin:notification-changed"))
    }, [])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [search, readFilter, categoryFilter])

    // Clear selection when page/filters change
    useEffect(() => {
        setSelectedIds(new Set())
    }, [page, search, readFilter, categoryFilter])

    // ── Selection helpers ────────────────────────────────────────

    const allOnPageSelected =
        items.length > 0 && items.every((n) => selectedIds.has(n.id))

    const someOnPageSelected =
        items.some((n) => selectedIds.has(n.id)) && !allOnPageSelected

    function toggleSelectAll() {
        if (allOnPageSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(items.map((n) => n.id)))
        }
    }

    function toggleSelectOne(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // ── Per-row actions ──────────────────────────────────────────

    async function markOneAsRead(id: string) {
        await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
        void patchCached((current) => ({
            ...current,
            items: current.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
            unreadCount: Math.max(0, current.unreadCount - 1),
        }))
        broadcastUpdate()
    }

    async function markOneAsUnread(id: string) {
        await fetch(`/api/notifications/${id}/unread`, { method: "PATCH" })
        void patchCached((current) => ({
            ...current,
            items: current.items.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
            unreadCount: current.unreadCount + 1,
        }))
        broadcastUpdate()
    }

    function handleRowClick(item: NotificationItem) {
        if (!item.isRead) {
            void markOneAsRead(item.id)
        }
        if (item.href) {
            router.push(cmsPanelPath(item.href))
        }
    }

    function requestDeleteOne(item: NotificationItem) {
        setPendingAction({
            title: "Delete notification?",
            message: `"${item.title}" will be permanently removed and cannot be recovered.`,
            confirmLabel: "Delete",
            variant: "danger",
            onConfirm: async () => {
                await fetch(`/api/notifications/${item.id}`, { method: "DELETE" })
                const wasUnread = !item.isRead
                void patchCached((current) => ({
                    ...current,
                    items: current.items.filter((n) => n.id !== item.id),
                    totalCount: Math.max(0, current.totalCount - 1),
                    unreadCount: wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
                }))
                setSelectedIds((prev) => {
                    const next = new Set(prev)
                    next.delete(item.id)
                    return next
                })
                broadcastUpdate()
            },
        })
    }

    // ── Bulk actions ─────────────────────────────────────────────

    const selectedArray = Array.from(selectedIds)

    async function bulkMarkRead() {
        setIsBulkActing(true)
        try {
            await fetch("/api/notifications/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedArray, action: "read" }),
            })
            const unreadSelected = items.filter(
                (n) => selectedIds.has(n.id) && !n.isRead
            ).length
            void patchCached((current) => ({
                ...current,
                items: current.items.map((n) =>
                    selectedIds.has(n.id) ? { ...n, isRead: true } : n
                ),
                unreadCount: Math.max(0, current.unreadCount - unreadSelected),
            }))
            setSelectedIds(new Set())
            broadcastUpdate()
        } finally {
            setIsBulkActing(false)
        }
    }

    async function bulkMarkUnread() {
        setIsBulkActing(true)
        try {
            await fetch("/api/notifications/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedArray, action: "unread" }),
            })
            const readSelected = items.filter(
                (n) => selectedIds.has(n.id) && n.isRead
            ).length
            void patchCached((current) => ({
                ...current,
                items: current.items.map((n) =>
                    selectedIds.has(n.id) ? { ...n, isRead: false } : n
                ),
                unreadCount: current.unreadCount + readSelected,
            }))
            setSelectedIds(new Set())
            broadcastUpdate()
        } finally {
            setIsBulkActing(false)
        }
    }

    function requestBulkDelete() {
        const count = selectedArray.length
        setPendingAction({
            title: `Delete ${count} notification${count !== 1 ? "s" : ""}?`,
            message:
                "These notifications will be permanently removed. This cannot be undone.",
            confirmLabel: "Delete All",
            variant: "danger",
            onConfirm: async () => {
                await fetch("/api/notifications/bulk", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: selectedArray }),
                })
                const unreadDeletedCount = items.filter(
                    (n) => selectedIds.has(n.id) && !n.isRead
                ).length
                const remainingOnPage = items.filter(
                    (n) => !selectedIds.has(n.id)
                ).length
                void patchCached((current) => ({
                    ...current,
                    items: current.items.filter((n) => !selectedIds.has(n.id)),
                    totalCount: Math.max(0, current.totalCount - count),
                    unreadCount: Math.max(0, current.unreadCount - unreadDeletedCount),
                }))
                setSelectedIds(new Set())
                broadcastUpdate()
                if (remainingOnPage === 0 && page > 1) {
                    setPage((prev) => prev - 1)
                } else {
                    refreshList()
                }
            },
        })
    }

    async function markAllAsRead() {
        await fetch("/api/notifications/read-all", { method: "PATCH" })
        void patchCached((current) => ({
            ...current,
            items: current.items.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
        }))
        broadcastUpdate()
    }

    // ── Confirm dialog runner ────────────────────────────────────

    async function runPendingAction() {
        if (!pendingAction) return
        setIsConfirming(true)
        try {
            await pendingAction.onConfirm()
        } finally {
            setIsConfirming(false)
            setPendingAction(null)
        }
    }

    // ── Render ───────────────────────────────────────────────────

    const readCount = totalCount - unreadCount

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    Notifications
                </h1>
                <p className="mt-0.5 text-sm text-wg-muted dark:text-wg-dark-muted">
                    Manage and review your admin notifications
                </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-wg-muted dark:text-wg-dark-muted">
                    <strong className="text-wg-text dark:text-wg-dark-text font-semibold">
                        {totalCount}
                    </strong>{" "}
                    total
                </span>
                <span className="text-wg-border dark:text-wg-dark-border">·</span>
                <span className="text-wg-muted dark:text-wg-dark-muted">
                    <strong className="text-wg-accent dark:text-wg-dark-accent font-semibold">
                        {unreadCount}
                    </strong>{" "}
                    unread
                </span>
                <span className="text-wg-border dark:text-wg-dark-border">·</span>
                <span className="text-wg-muted dark:text-wg-dark-muted">
                    <strong className="text-wg-text dark:text-wg-dark-text font-semibold">
                        {readCount}
                    </strong>{" "}
                    read
                </span>
                {unreadCount > 0 && (
                    <button
                        onClick={() => void markAllAsRead()}
                        className="ml-auto text-xs font-medium text-wg-primary dark:text-wg-dark-primary hover:underline transition-colors"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search notifications…"
                    className="flex-1 min-w-0"
                />
                <AdminSelect
                    value={readFilter}
                    onChange={(v) => setReadFilter(v as ReadFilter)}
                    options={READ_FILTER_OPTIONS}
                    placeholder="All notifications"
                    className="sm:w-44"
                />
                <AdminSelect
                    value={categoryFilter}
                    onChange={(v) => setCategoryFilter(v as CategoryFilter)}
                    options={CATEGORY_OPTIONS}
                    placeholder="All categories"
                    className="sm:w-40"
                />
            </div>

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-brand bg-wg-primary/5 dark:bg-wg-dark-primary/10 border border-wg-primary/20 dark:border-wg-dark-primary/20">
                    <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                        {selectedIds.size} selected
                    </span>
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <button
                            onClick={() => void bulkMarkRead()}
                            disabled={isBulkActing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                        >
                            <EyeIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            Mark read
                        </button>
                        <button
                            onClick={() => void bulkMarkUnread()}
                            disabled={isBulkActing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                        >
                            <EyeSlashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            Mark unread
                        </button>
                        <button
                            onClick={requestBulkDelete}
                            disabled={isBulkActing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        >
                            <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Notification list card */}
            <div className="rounded-card border border-wg-border/60 dark:border-wg-dark-border/60 bg-wg-surface dark:bg-wg-dark-surface shadow-card overflow-hidden">
                {/* Table header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-wg-border/50 dark:border-wg-dark-border bg-wg-bg/50 dark:bg-wg-dark-bg/30">
                    <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someOnPageSelected
                        }}
                        onChange={toggleSelectAll}
                        disabled={items.length === 0}
                        className="wg-check w-4 h-4"
                        aria-label="Select all notifications on this page"
                    />
                    <span className="text-xs font-medium text-wg-muted dark:text-wg-dark-muted flex-1">
                        Notification
                    </span>
                    <span className="text-xs font-medium text-wg-muted dark:text-wg-dark-muted w-16 sm:w-20 text-right shrink-0">
                        Time
                    </span>
                    <span className="w-[4.5rem] sm:w-16 shrink-0" aria-hidden="true" />
                </div>

                {/* Loading skeleton */}
                {isLoading && (
                    <LoadingState size="section" message="Loading notifications…" />
                )}

                {/* Empty state */}
                {!isLoading && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <BellFlaredIcon className="w-14 h-14 text-wg-muted/20 dark:text-wg-dark-muted/15 mb-4" strokeWidth={1} />
                        <p className="text-sm font-medium text-wg-muted dark:text-wg-dark-muted">
                            {search || readFilter !== "all" || categoryFilter
                                ? "No notifications match your filters"
                                : "You're all caught up"}
                        </p>
                        <p className="text-xs text-wg-muted/60 dark:text-wg-dark-muted/60 mt-1">
                            {search || readFilter !== "all" || categoryFilter
                                ? "Try adjusting or clearing your filters"
                                : "New notifications will appear here"}
                        </p>
                        {(search || readFilter !== "all" || categoryFilter) && (
                            <button
                                onClick={() => {
                                    setSearch("")
                                    setReadFilter("all")
                                    setCategoryFilter("")
                                }}
                                className="mt-4 text-xs font-medium text-wg-primary dark:text-wg-dark-primary hover:underline transition-colors"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {/* Notification rows */}
                {!isLoading && items.length > 0 && (
                    <div className="divide-y divide-wg-border/30 dark:divide-wg-dark-border/40">
                        {items.map((item) => {
                            const config = getTypeConfig(item.type)
                            const isSelected = selectedIds.has(item.id)

                            return (
                                <div
                                    key={item.id}
                                    className={`
                                        relative flex items-start gap-3 px-4 py-4 group transition-colors
                                        ${item.isRead
                                            ? "bg-transparent hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/20"
                                            : "bg-wg-accent/[0.03] dark:bg-wg-dark-accent/[0.05] hover:bg-wg-accent/[0.06] dark:hover:bg-wg-dark-accent/[0.08] border-l-2 border-l-wg-accent dark:border-l-wg-dark-accent"
                                        }
                                        ${isSelected ? "bg-wg-primary/5 dark:bg-wg-dark-primary/10" : ""}
                                    `}
                                >
                                    {/* Checkbox */}
                                    <div className="pt-0.5 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectOne(item.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="wg-check w-4 h-4"
                                            aria-label={`Select notification: ${item.title}`}
                                        />
                                    </div>

                                    {/* Type icon */}
                                    <div
                                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${config.bg}`}
                                        aria-hidden="true"
                                    >
                                        {config.icon}
                                    </div>

                                    {/* Content */}
                                    <button
                                        onClick={() => handleRowClick(item)}
                                        className="flex-1 min-w-0 text-left"
                                        title={item.href ? `Navigate to ${cmsPanelPath(item.href)}` : item.title}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {!item.isRead && (
                                                <span
                                                    className="shrink-0 w-2 h-2 rounded-full bg-wg-accent dark:bg-wg-dark-accent"
                                                    aria-label="Unread"
                                                />
                                            )}
                                            <span
                                                className={`text-sm truncate ${
                                                    item.isRead
                                                        ? "text-wg-muted dark:text-wg-dark-muted font-normal"
                                                        : "text-wg-text dark:text-wg-dark-text font-semibold"
                                                }`}
                                            >
                                                {item.title}
                                            </span>
                                            {item.href && (
                                                <ChevronRightIcon className="shrink-0 w-3 h-3 text-wg-muted/50 dark:text-wg-dark-muted/50" strokeWidth={2} aria-hidden="true" />
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-wg-muted dark:text-wg-dark-muted truncate">
                                            {item.message}
                                        </p>
                                    </button>

                                    {/* Timestamp + row actions (always visible — touch devices have no hover) */}
                                    <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5 sm:flex-row sm:items-start sm:gap-2">
                                    <time
                                        className="text-[10px] sm:text-xs text-wg-muted/70 dark:text-wg-dark-muted/70 whitespace-nowrap tabular-nums sm:pt-0.5"
                                        dateTime={item.createdAt}
                                        title={formatAbsoluteTime(item.createdAt)}
                                    >
                                        {formatRelativeTime(item.createdAt)}
                                    </time>

                                    {/* Per-row action buttons */}
                                    <div className="flex items-center gap-0.5 sm:gap-1 sm:pt-0.5">
                                        {/* Toggle read/unread */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (item.isRead) void markOneAsUnread(item.id)
                                                else void markOneAsRead(item.id)
                                            }}
                                            title={item.isRead ? "Mark as unread" : "Mark as read"}
                                            className="p-1.5 rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors"
                                        >
                                            {item.isRead ? (
                                                // Mark unread icon (eye-slash)
                                                <EyeSlashIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                                            ) : (
                                                // Mark read icon (check)
                                                <CheckIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                            )}
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                requestDeleteOne(item)
                                            }}
                                            title="Delete notification"
                                            className="p-1.5 rounded-brand text-wg-muted hover:text-red-600 hover:bg-red-50 dark:text-wg-dark-muted dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                                        </button>
                                    </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && pagination.totalPages > 1 && (
                    <div className="px-4 border-t border-wg-border/50 dark:border-wg-dark-border">
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            totalItems={pagination.total}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>

            {/* Confirm dialog */}
            <ConfirmDialog
                isOpen={pendingAction !== null}
                onClose={() => {
                    if (!isConfirming) setPendingAction(null)
                }}
                onConfirm={() => void runPendingAction()}
                title={pendingAction?.title ?? ""}
                message={pendingAction?.message ?? ""}
                confirmLabel={pendingAction?.confirmLabel}
                variant={pendingAction?.variant ?? "danger"}
                isLoading={isConfirming}
            />
        </div>
    )
}
