"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Discounts List Page — /discounts
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { Switch } from "@wildgrove/ui/Switch"
import { AdminSelect } from "@/components/AdminSelect"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import { PencilSquareIcon, PlusWideIcon, TagLowDotIcon, TrashIcon } from "@wildgrove/ui/icons"

interface DiscountRow {
    id: string
    name: string
    type: "COUPON" | "AUTOMATIC"
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    valueUsd: number | null
    code: string | null
    usageCount: number
    usageLimit: number | null
    active: boolean
    validFrom: string | null
    validUntil: string | null
    createdAt: string
    isDraft?: boolean
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

const DRAFT_COUNT_KEY = "/api/discounts?draft=true&limit=1&page=1"

type DiscountListPayload = { items: DiscountRow[]; pagination: PaginationData }

export default function AdminDiscountsPage() {
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("")
    const [activeFilter, setActiveFilter] = useState("")
    const [page, setPage] = useState(1)
    const [deleteTarget, setDeleteTarget] = useState<DiscountRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // The URL is the cache key: a filter already looked at paints at once.
    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (search) params.set("search", search)
        if (typeFilter) params.set("type", typeFilter)
        if (activeFilter === "drafts") {
            params.set("draft", "true")
        } else if (activeFilter) {
            params.set("active", activeFilter)
        }
        return `/api/discounts?${params}`
    }, [page, search, typeFilter, activeFilter])

    const { data: list, isLoading, mutate: mutateList } = useCmsQuery<DiscountListPayload>(listKey)
    const { data: draftCountData } = useCmsQuery<DiscountListPayload>(DRAFT_COUNT_KEY)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION
    const draftCount = draftCountData?.pagination.total ?? 0

    const refreshList = useCallback(() => { void invalidateCms("/api/discounts") }, [])

    useEffect(() => { setPage(1) }, [search, typeFilter, activeFilter])

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/discounts/${deleteTarget.id}`, { method: "DELETE" })
            if (res.ok) {
                refreshList()
                setDeleteTarget(null)
            }
        } catch (error) {
            console.error("Delete failed:", error)
        } finally {
            setIsDeleting(false)
        }
    }, [deleteTarget, refreshList])

    const handleToggleActive = useCallback(async (item: DiscountRow) => {
        /** Sets one row's active flag in the cached page, without a request. */
        const setActive = (active: boolean) =>
            mutateList(
                (current) =>
                    current && {
                        ...current,
                        items: current.items.map((i) => (i.id === item.id ? { ...i, active } : i)),
                    },
                { revalidate: false },
            )

        void setActive(!item.active)
        try {
            const res = await fetch(`/api/discounts/${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !item.active }),
            })
            if (!res.ok) void setActive(item.active)
        } catch {
            void setActive(item.active)
        }
    }, [mutateList])

    const columns: Column<DiscountRow>[] = useMemo(() => [
        {
            key: "name",
            label: "Name",
            render: (item) => (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{item.name}</span>
                    {item.isDraft && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40 uppercase tracking-wide">
                            Draft
                        </span>
                    )}
                    {item.code && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-wg-border/20 dark:bg-wg-dark-border text-wg-muted dark:text-wg-dark-muted">
                            {item.code}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: "type",
            label: "Type",
            render: (item) => <StatusBadge status={item.type} />,
        },
        {
            key: "value",
            label: "Value",
            render: (item) => (
                <span className="tabular-nums font-medium">
                    {item.valueType === "PERCENTAGE"
                        ? `${item.value}%`
                        : `S/${item.value.toFixed(2)} / $${(item.valueUsd ?? item.value).toFixed(2)}`}
                </span>
            ),
        },
        {
            key: "usage",
            label: "Usage",
            hideOnMobile: true,
            render: (item) => (
                <span className="text-wg-muted dark:text-wg-dark-muted tabular-nums">
                    {item.usageCount}{item.usageLimit ? `/${item.usageLimit}` : ""}
                </span>
            ),
        },
        {
            key: "active",
            label: "Active",
            render: (item) => (
                <Switch
                    size="sm"
                    checked={item.active && !item.isDraft}
                    onChange={(_next, e) => { e.preventDefault(); e.stopPropagation(); handleToggleActive(item) }}
                    disabled={!!item.isDraft}
                    title={item.isDraft ? "Publish this discount before activating" : undefined}
                    label={item.isDraft ? "Cannot activate a draft" : item.active ? "Deactivate" : "Activate"}
                />
            ),
        },
        {
            key: "actions",
            label: "",
            className: "w-20",
            render: (item) => (
                <div className="flex items-center gap-1">
                    <Link
                        href={`/discounts/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
                        aria-label="Edit"
                    >
                        <PencilSquareIcon className="w-4 h-4" />
                    </Link>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(item) }}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-red-600 hover:bg-red-50 dark:text-wg-dark-muted dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        aria-label="Delete"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ], [handleToggleActive])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Discounts</h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Manage promotions and coupon codes</p>
                </div>
                <Link
                    href="/discounts/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors"
                >
                    <PlusWideIcon className="w-4 h-4" strokeWidth={2} />
                    New Discount
                </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput value={search} onChange={setSearch} placeholder="Search by name or code..." className="sm:w-72" />
                <AdminSelect
                    value={typeFilter}
                    onChange={setTypeFilter}
                    placeholder="All Types"
                    options={[
                        { value: "COUPON", label: "Coupon" },
                        { value: "AUTOMATIC", label: "Automatic" },
                    ]}
                    className="sm:w-40"
                />
                <AdminSelect
                    value={activeFilter}
                    onChange={setActiveFilter}
                    placeholder="All Status"
                    options={[
                        { value: "true", label: "Active" },
                        { value: "false", label: "Inactive" },
                        { value: "drafts", label: draftCount > 0 ? `Drafts (${draftCount})` : "Drafts" },
                    ]}
                    className="sm:w-40"
                />
            </div>

            <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                loadingMessage="Loading discounts…"
                rowHref={(item) => `/discounts/${item.id}`}
                emptyMessage="No discounts found"
                emptyIcon={
                    <TagLowDotIcon className="w-8 h-8 text-wg-muted/30 dark:text-wg-dark-muted/30" aria-hidden />
                }
                emptyAction={{ label: "Create First Discount", href: "/discounts/new" }}
            />

            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={setPage}
            />

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Discount"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove all usage records.`}
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    )
}
