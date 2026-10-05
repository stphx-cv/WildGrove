"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Menu List Page — /menu
// DataTable with search, category filter, inline availability toggle
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { DraftsListPanel } from "@/components/DraftsListPanel"
import { Badge } from "@wildgrove/ui/Badge"
import { Switch } from "@wildgrove/ui/Switch"
import { formatPrice } from "@wildgrove/core/currency"
import { AdminSelect } from "@/components/AdminSelect"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import {
    DocumentDuplicateIcon,
    PencilSquareIcon,
    PhotoSunIcon,
    PlusWideIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

// ── Types ──

interface MenuItemRow {
    id: string
    name: string
    description: string
    prices: { PEN?: number; USD?: number }
    imageUrl: string | null
    tags: string[]
    tagColors?: Record<string, string> | null
    available: boolean
    order: number
    categoryId: string | null
    category: { id: string; name: string; slug: string } | null
    isDraft?: boolean
    parentId?: string | null
    draftsCount?: number
}

interface Category {
    id: string
    name: string
    slug: string
    itemCount: number
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

const CATEGORIES_KEY = "/api/categories?draft=false"
const DRAFT_COUNT_KEY = "/api/menu?draft=true&limit=1&page=1"

type MenuListPayload = { items: MenuItemRow[]; pagination: PaginationData }

export default function AdminMenuPage() {
    // Filters
    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("")
    const [availableFilter, setAvailableFilter] = useState("")
    const [page, setPage] = useState(1)

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<MenuItemRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Drafts side-panel state
    const [draftsParent, setDraftsParent] = useState<{ id: string; name: string } | null>(null)

    // ── Data ──
    // The URL is the cache key, so every combination of page, search and filter
    // is its own entry: going back to one already visited paints it at once and
    // revalidates behind (D6).

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (search) params.set("search", search)
        if (categoryFilter) params.set("category", categoryFilter)
        if (availableFilter === "drafts") {
            params.set("draft", "true")
        } else if (availableFilter) {
            params.set("available", availableFilter)
        }
        return `/api/menu?${params}`
    }, [page, search, categoryFilter, availableFilter])

    const { data: list, isLoading, mutate: mutateList } = useCmsQuery<MenuListPayload>(listKey)
    const { data: categories = [] } = useCmsQuery<Category[]>(CATEGORIES_KEY)
    const { data: draftCountData } = useCmsQuery<MenuListPayload>(DRAFT_COUNT_KEY)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION
    const draftCount = draftCountData?.pagination.total ?? 0

    /** After a write: drop every `/api/menu` key, whatever its filters. */
    const refreshList = useCallback(() => { void invalidateCms("/api/menu") }, [])

    // Reset page when filters change
    useEffect(() => { setPage(1) }, [search, categoryFilter, availableFilter])

    // ── Inline availability toggle ──

    const handleToggleAvailability = useCallback(async (item: MenuItemRow) => {
        /** Sets one row's availability in the cached page, without a request. */
        const setAvailable = (available: boolean) =>
            mutateList(
                (current) =>
                    current && {
                        ...current,
                        items: current.items.map((i) => (i.id === item.id ? { ...i, available } : i)),
                    },
                { revalidate: false },
            )

        // Optimistic update
        void setAvailable(!item.available)

        try {
            const res = await fetch(`/api/menu/${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ available: !item.available }),
            })
            // Revert on failure
            if (!res.ok) void setAvailable(item.available)
        } catch {
            // Revert on network error
            void setAvailable(item.available)
        }
    }, [mutateList])

    // ── Delete handler ──

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/menu/${deleteTarget.id}`, { method: "DELETE" })
            if (res.ok) {
                // The row is gone, and so are the totals and the draft count.
                refreshList()
                setDeleteTarget(null)
            }
        } catch (error) {
            console.error("Delete failed:", error)
        } finally {
            setIsDeleting(false)
        }
    }, [deleteTarget, refreshList])

    // ── Column definitions (memoized) ──

    const columns: Column<MenuItemRow>[] = useMemo(() => [
        {
            key: "imageUrl",
            label: "Image",
            hideOnMobile: true,
            className: "w-14",
            render: (item) =>
                item.imageUrl ? (
                    <div className="w-10 h-10 rounded-brand overflow-hidden bg-wg-bg dark:bg-wg-dark-bg relative">
                        <FadeInImage src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="40px" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-brand bg-wg-border/20 dark:bg-wg-dark-border flex items-center justify-center">
                        <PhotoSunIcon className="w-4 h-4 text-wg-muted/40" />
                    </div>
                ),
        },
        {
            key: "name",
            label: "Name",
            sortable: true,
            render: (item) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    {item.isDraft && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40 uppercase tracking-wide">
                            Draft
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: "category",
            label: "Category",
            hideOnMobile: true,
            render: (item) => (
                <span className="text-wg-muted dark:text-wg-dark-muted">{item.category?.name ?? "—"}</span>
            ),
        },
        {
            key: "price",
            label: "Price",
            sortable: true,
            render: (item) => (
                <span className="tabular-nums">
                    {typeof item.prices.PEN === "number"
                        ? formatPrice(item.prices.PEN, "PEN")
                        : formatPrice(item.prices.USD ?? 0, "USD")}
                </span>
            ),
        },
        {
            key: "tags",
            label: "Tags",
            hideOnMobile: true,
            render: (item) => (
                <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} tag={tag} customColor={item.tagColors?.[tag]} />
                    ))}
                    {item.tags.length > 2 && (
                        <span className="text-[11px] text-wg-muted dark:text-wg-dark-muted">+{item.tags.length - 2}</span>
                    )}
                </div>
            ),
        },
        {
            key: "available",
            label: "Status",
            render: (item) => (
                <Switch
                    size="sm"
                    checked={item.available && !item.isDraft}
                    onChange={(_next, e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleToggleAvailability(item)
                    }}
                    disabled={!!item.isDraft}
                    title={item.isDraft ? "Publish this item before activating" : undefined}
                    label={item.isDraft ? "Cannot activate a draft" : item.available ? "Mark unavailable" : "Mark available"}
                />
            ),
        },
        {
            key: "actions",
            label: "",
            className: "w-28",
            render: (item) => (
                <div className="flex items-center gap-1">
                    <Link
                        href={`/menu/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
                        aria-label="Edit item"
                        title="Edit"
                    >
                        <PencilSquareIcon className="w-4 h-4" />
                    </Link>
                    {!item.isDraft && (
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setDraftsParent({ id: item.id, name: item.name })
                            }}
                            className="relative p-1.5 rounded-brand text-wg-muted hover:text-amber-600 hover:bg-amber-50 dark:text-wg-dark-muted dark:hover:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
                            aria-label="View drafts"
                            title={item.draftsCount ? `${item.draftsCount} draft${item.draftsCount === 1 ? "" : "s"}` : "Drafts"}
                        >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                            {!!item.draftsCount && item.draftsCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
                                    {item.draftsCount}
                                </span>
                            )}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDeleteTarget(item)
                        }}
                        className="p-1.5 rounded-brand text-wg-muted hover:text-red-600 hover:bg-red-50 dark:text-wg-dark-muted dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        aria-label="Delete item"
                        title="Delete"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ], [handleToggleAvailability])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                        Menu Items
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                        Manage your restaurant menu
                    </p>
                </div>
                <Link
                    href="/menu/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors"
                >
                    <PlusWideIcon className="w-4 h-4" strokeWidth={2} />
                    New Item
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search menu items..."
                    className="sm:w-72"
                />
                <AdminSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="All Categories"
                    options={categories.map((cat) => ({ value: cat.id, label: `${cat.name} (${cat.itemCount})` }))}
                    className="sm:w-44"
                />
                <AdminSelect
                    value={availableFilter}
                    onChange={setAvailableFilter}
                    placeholder="All Status"
                    options={[
                        { value: "true", label: "Available" },
                        { value: "false", label: "Unavailable" },
                        { value: "drafts", label: draftCount > 0 ? `Drafts (${draftCount})` : "Drafts" },
                    ]}
                    className="sm:w-40"
                />
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                loadingMessage="Loading menu items…"
                rowHref={(item) => `/menu/${item.id}`}
                emptyMessage="No menu items found"
                emptyAction={{ label: "Add First Item", href: "/menu/new" }}
            />

            {/* Pagination */}
            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={setPage}
            />

            {/* Delete confirmation */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Menu Item"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
            />

            {/* Drafts side panel */}
            <DraftsListPanel
                parent={draftsParent}
                onClose={() => setDraftsParent(null)}
                onChanged={refreshList}
            />
        </div>
    )
}
