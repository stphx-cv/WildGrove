"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Categories List Page — /categories
// ══════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SearchInput } from "@/components/SearchInput"
import { AdminSelect } from "@/components/AdminSelect"
import { getCategoryIconByKey } from "@/lib/category-icons"
import { LoadingState } from "@/components/LoadingState"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import { PencilShortSeamIcon, PlusWideIcon, QueueListIcon, TrashIcon } from "@wildgrove/ui/icons"

// ── Types ──

interface CategoryRow {
    id: string
    name: string
    nameEs?: string | null
    slug: string
    icon: string
    order: number
    itemCount: number
    isDraft?: boolean
}

const DRAFT_COUNT_KEY = "/api/categories?draft=true"

export default function AdminCategoriesPage() {
    // Filters
    const [search, setSearch]             = useState("")
    const [statusFilter, setStatusFilter] = useState("")

    const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)
    const [isDeleting, setIsDeleting]     = useState(false)
    const [deleteError, setDeleteError]   = useState<string | null>(null)

    // ── Data ──

    const listKey = useMemo(() => {
        const params = new URLSearchParams()
        if (statusFilter === "drafts") params.set("draft", "true")
        else if (statusFilter === "published") params.set("draft", "false")
        const qs = params.toString()
        return `/api/categories${qs ? `?${qs}` : ""}`
    }, [statusFilter])

    const { data: categories = [], isLoading } = useCmsQuery<CategoryRow[]>(listKey)
    const { data: draftRows } = useCmsQuery<CategoryRow[]>(DRAFT_COUNT_KEY)
    const draftCount = Array.isArray(draftRows) ? draftRows.length : 0

    const refreshCategories = useCallback(() => { void invalidateCms("/api/categories") }, [])

    // ── Search filter (client-side) ──

    const searchLower = search.trim().toLowerCase()
    const visibleCategories = searchLower
        ? categories.filter(
              (c) =>
                  c.name.toLowerCase().includes(searchLower) ||
                  (c.nameEs ?? "").toLowerCase().includes(searchLower) ||
                  c.slug.toLowerCase().includes(searchLower)
          )
        : categories

    // ── Delete ──

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        setDeleteError(null)
        try {
            const res  = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" })
            const json = await res.json()
            if (!json.success) {
                setDeleteError(json.error ?? "Failed to delete category")
                return
            }
            setDeleteTarget(null)
            refreshCategories()
        } catch {
            setDeleteError("Network error. Please try again.")
        } finally {
            setIsDeleting(false)
        }
    }, [deleteTarget, refreshCategories])

    // ── Render ──

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Categories</h1>
                    <p className="mt-0.5 text-sm text-wg-muted dark:text-wg-dark-muted">
                        Manage your restaurant categories
                    </p>
                </div>
                <Link
                    href="/categories/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors"
                >
                    <PlusWideIcon className="w-4 h-4" strokeWidth={2} />
                    New Category
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search categories..."
                    className="sm:w-72"
                />
                <AdminSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="All Status"
                    options={[
                        { value: "published", label: "Published" },
                        { value: "drafts", label: draftCount > 0 ? `Drafts (${draftCount})` : "Drafts" },
                    ]}
                    className="sm:w-40"
                />
            </div>

            {/* Table */}
            <div className="rounded-card border border-wg-border/40 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-wg-border/30 dark:border-wg-dark-border/60 bg-wg-bg/50 dark:bg-wg-dark-bg/40">
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted w-12">
                                    Icon
                                </th>
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                                    Name (EN)
                                </th>
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                                    Name (ES)
                                </th>
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                                    Slug
                                </th>
                                <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted w-20">
                                    Items
                                </th>
                                <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted w-20">
                                    Order
                                </th>
                                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted w-32">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-wg-border/20 dark:divide-wg-dark-border/30">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12">
                                        <LoadingState size="inline" message="Loading categories…" />
                                    </td>
                                </tr>
                            ) : visibleCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-16 text-center">
                                        <QueueListIcon className="w-8 h-8 mx-auto mb-3 text-wg-muted/30 dark:text-wg-dark-muted/30" />
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">
                                            {statusFilter === "drafts" ? "No draft categories" : search ? "No matches" : "No categories yet"}
                                        </p>
                                        <p className="text-[13px] text-wg-muted dark:text-wg-dark-muted mb-4">
                                            {statusFilter === "drafts"
                                                ? "Saved drafts will appear here."
                                                : search
                                                ? "Try a different search term."
                                                : "Create your first category to start organizing the menu."}
                                        </p>
                                        {!search && statusFilter !== "drafts" && (
                                            <Link
                                                href="/categories/new"
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors"
                                            >
                                                <PlusWideIcon className="w-4 h-4" strokeWidth={2} />
                                                Add First Category
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                visibleCategories.map((cat) => (
                                    <tr key={cat.id} className="hover:bg-wg-bg/40 dark:hover:bg-wg-dark-bg/30 transition-colors">
                                        {/* Icon */}
                                        <td className="px-5 py-3.5">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-brand bg-wg-bg dark:bg-wg-dark-bg border border-wg-border/40 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted">
                                                {getCategoryIconByKey(cat.icon)}
                                            </span>
                                        </td>
                                        {/* Name EN */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-wg-text dark:text-wg-dark-text">{cat.name}</span>
                                                {cat.isDraft && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40 uppercase tracking-wide">
                                                        Draft
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Name ES */}
                                        <td className="px-5 py-3.5 text-wg-muted dark:text-wg-dark-muted">
                                            {cat.nameEs ?? <span className="italic text-wg-muted/50 dark:text-wg-dark-muted/50">—</span>}
                                        </td>
                                        {/* Slug */}
                                        <td className="px-5 py-3.5 font-mono text-xs text-wg-muted dark:text-wg-dark-muted">
                                            {cat.slug}
                                        </td>
                                        {/* Item count */}
                                        <td className="px-5 py-3.5 text-center text-wg-muted dark:text-wg-dark-muted">
                                            {cat.itemCount}
                                        </td>
                                        {/* Order */}
                                        <td className="px-5 py-3.5 text-center text-wg-muted dark:text-wg-dark-muted">
                                            {cat.order}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/categories/${cat.id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-primary/50 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors"
                                                >
                                                    <PencilShortSeamIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                                    Edit
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDeleteError(null); setDeleteTarget(cat) }}
                                                    disabled={cat.itemCount > 0}
                                                    title={cat.itemCount > 0 ? `Cannot delete: has ${cat.itemCount} item${cat.itemCount === 1 ? "" : "s"}` : "Delete category"}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tip */}
            {!isLoading && visibleCategories.length > 0 && (
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                    Categories with items cannot be deleted. Move or delete their items first.
                </p>
            )}

            {/* Delete confirm dialog */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
                onConfirm={handleDelete}
                title="Delete Category"
                message={
                    deleteError
                        ? deleteError
                        : `Delete "${deleteTarget?.name}"? This action cannot be undone.`
                }
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    )
}
