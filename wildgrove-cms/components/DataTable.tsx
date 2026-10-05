"use client"

// ══════════════════════════════════════════════════════════════════
// DataTable — Reusable sortable table for all admin list views
// Applies react-performance-optimization patterns throughout:
// - React.memo on rows, useCallback on handlers, useMemo on sorts
// Loading + empty states align with /categories (spinner, CTA + icon).
// The spinner itself is <LoadingState size="inline" />, shared with every
// route boundary in the panel.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { ArchiveBoxIcon, ChevronUpIcon, PlusWideIcon } from "@wildgrove/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoadingState } from "./LoadingState"

// ── Types ──

export interface Column<T> {
    /** Unique key for the column — used for sorting / identification */
    key: string
    /** Display label in the header */
    label: string
    /** Whether the column is sortable */
    sortable?: boolean
    /** Custom render function for the cell */
    render?: (item: T) => React.ReactNode
    /** Extra Tailwind classes for the cell */
    className?: string
    /** Hide this column on mobile (below sm breakpoint) */
    hideOnMobile?: boolean
}

export interface SortConfig {
    key: string
    direction: "asc" | "desc"
}

export interface DataTableProps<T extends { id: string }> {
    columns: Column<T>[]
    data: T[]
    isLoading?: boolean
    /** Spinner label while fetching (Categories-style). */
    loadingMessage?: string
    /** Current sort — controlled externally for server-side sorting */
    sortConfig?: SortConfig
    onSort?: (config: SortConfig) => void
    /** Click a row to navigate to a detail page */
    rowHref?: (item: T) => string
    /** Click handler for rows (alternative to rowHref) */
    onRowClick?: (item: T) => void
    /** Message shown when data is empty */
    emptyMessage?: string
    /** Optional icon above empty message (defaults to archive-style glyph) */
    emptyIcon?: React.ReactNode
    /** CTA shown in the empty state */
    emptyAction?: { label: string; href: string }
}

function DefaultEmptyIcon() {
    return (
        <ArchiveBoxIcon className="w-8 h-8 text-wg-muted/30 dark:text-wg-dark-muted/30" aria-hidden />
    )
}

/**
 * Options for `router.prefetch`. `kind: "full"` renders a dynamic page on the
 * server rather than fetching only its static shell, which is the whole point
 * here: `/menu/[id]` is dynamic, and a partial prefetch would leave the click
 * waiting for the render anyway. The `PrefetchKind` enum is not exported from
 * a public path, hence the cast.
 */
const FULL_PREFETCH = { kind: "full" } as Parameters<
    ReturnType<typeof useRouter>["prefetch"]
>[1]

/** How long the pointer must rest on a row before its page is prefetched. */
const PREFETCH_INTENT_MS = 120

// ── Memoized table row ──

const TableRow = React.memo(function TableRow<T extends { id: string }>({
    item,
    columns,
    rowHref,
    onRowClick,
}: {
    item: T
    columns: Column<T>[]
    rowHref?: (item: T) => string
    onRowClick?: (item: T) => void
}) {
    const router = useRouter()

    // ── Hover intent ──
    // A full prefetch renders the detail page on the server, so it must not
    // fire while the pointer sweeps down the table: only a rest of
    // PREFETCH_INTENT_MS counts as intent. Touch devices never fire
    // `pointerenter` without a tap, and they get the `loading.tsx` spinner
    // instead.
    const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearIntent = useCallback(() => {
        if (intentTimer.current) {
            clearTimeout(intentTimer.current)
            intentTimer.current = null
        }
    }, [])

    useEffect(() => clearIntent, [clearIntent])

    const handlePointerEnter = useCallback(() => {
        if (!rowHref) return
        clearIntent()
        const href = rowHref(item)
        intentTimer.current = setTimeout(() => {
            intentTimer.current = null
            router.prefetch(href, FULL_PREFETCH)
        }, PREFETCH_INTENT_MS)
    }, [clearIntent, item, rowHref, router])

    const content = columns.map((col) => (
        <td
            key={col.key}
            className={`
                px-5 py-3.5 text-sm text-wg-text dark:text-wg-dark-text
                ${col.hideOnMobile ? "hidden sm:table-cell" : ""}
                ${col.className ?? ""}
            `}
        >
            {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
        </td>
    ))

    if (rowHref) {
        return (
            <tr
                className="group hover:bg-wg-bg/40 dark:hover:bg-wg-dark-bg/30 transition-colors cursor-pointer"
                onClick={() => router.push(rowHref(item))}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={clearIntent}
            >
                {content}
            </tr>
        )
    }

    if (onRowClick) {
        return (
            <tr
                className="hover:bg-wg-bg/40 dark:hover:bg-wg-dark-bg/30 transition-colors cursor-pointer"
                onClick={() => onRowClick(item)}
            >
                {content}
            </tr>
        )
    }

    return (
        <tr className="hover:bg-wg-bg/40 dark:hover:bg-wg-dark-bg/30 transition-colors">
            {content}
        </tr>
    )
}) as <T extends { id: string }>(props: {
    item: T
    columns: Column<T>[]
    rowHref?: (item: T) => string
    onRowClick?: (item: T) => void
}) => React.ReactElement

// ── Main DataTable component ──

export function DataTable<T extends { id: string }>({
    columns,
    data,
    isLoading = false,
    loadingMessage = "Loading…",
    sortConfig,
    onSort,
    rowHref,
    onRowClick,
    emptyMessage = "No data found",
    emptyIcon,
    emptyAction,
}: DataTableProps<T>) {
    // Internal sort state (only used if onSort is not provided — client-side sorting)
    const [internalSort, setInternalSort] = useState<SortConfig | undefined>()
    const activeSort = sortConfig ?? internalSort

    const handleSort = useCallback(
        (key: string) => {
            const newDirection: "asc" | "desc" =
                activeSort?.key === key && activeSort?.direction === "asc" ? "desc" : "asc"
            const newConfig = { key, direction: newDirection }

            if (onSort) {
                onSort(newConfig)
            } else {
                setInternalSort(newConfig)
            }
        },
        [activeSort, onSort],
    )

    // Client-side sort (only when no onSort handler — for small datasets)
    const sortedData = useMemo(() => {
        if (onSort || !internalSort) return data
        return [...data].sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[internalSort.key]
            const bVal = (b as Record<string, unknown>)[internalSort.key]
            const comparison = String(aVal ?? "").localeCompare(String(bVal ?? ""))
            return internalSort.direction === "asc" ? comparison : -comparison
        })
    }, [data, internalSort, onSort])

    const visibleColCount = columns.length

    return (
        <div className="overflow-x-auto rounded-card border border-wg-border/40 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
            <table className="w-full text-left">
                {/* ── Header ── */}
                <thead>
                    <tr className="border-b border-wg-border/30 dark:border-wg-dark-border/60 bg-wg-bg/50 dark:bg-wg-dark-bg/40">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`
                                    px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest
                                    text-wg-muted dark:text-wg-dark-muted
                                    ${col.hideOnMobile ? "hidden sm:table-cell" : ""}
                                    ${col.sortable ? "cursor-pointer select-none hover:text-wg-text dark:hover:text-wg-dark-text transition-colors" : ""}
                                    ${col.className ?? ""}
                                `}
                                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                            >
                                <span className="flex items-center gap-1.5">
                                    {col.label}
                                    {col.sortable && activeSort?.key === col.key && (
                                        <ChevronUpIcon className={`w-3.5 h-3.5 transition-transform ${activeSort.direction === "desc" ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden />
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* ── Body ── */}
                <tbody className="divide-y divide-wg-border/20 dark:divide-wg-dark-border/30">
                    {isLoading ? (
                        <tr>
                            <td colSpan={visibleColCount} className="px-5 py-12">
                                <LoadingState size="inline" message={loadingMessage} />
                            </td>
                        </tr>
                    ) : sortedData.length === 0 ? (
                        <tr>
                            <td colSpan={visibleColCount} className="px-5 py-16 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    {emptyIcon ?? <DefaultEmptyIcon />}
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{emptyMessage}</p>
                                    {emptyAction && (
                                        <Link
                                            href={emptyAction.href}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors"
                                        >
                                            <PlusWideIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                            {emptyAction.label}
                                        </Link>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((item) => (
                            <TableRow
                                key={item.id}
                                item={item}
                                columns={columns}
                                rowHref={rowHref}
                                onRowClick={onRowClick}
                            />
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
