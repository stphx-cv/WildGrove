"use client"

// ══════════════════════════════════════════════════════════════════
// Pagination — Reusable pagination for all admin list views
// Standard: 25 items per page (configurable)
// ══════════════════════════════════════════════════════════════════

import { useCallback } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "@wildgrove/ui/icons"

export const DEFAULT_PAGE_SIZE = 25

interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    /** Total items count (optional, for display) */
    totalItems?: number
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
}: PaginationProps) {
    const handlePrevious = useCallback(
        () => onPageChange(Math.max(1, currentPage - 1)),
        [currentPage, onPageChange]
    )

    const handleNext = useCallback(
        () => onPageChange(Math.min(totalPages, currentPage + 1)),
        [currentPage, totalPages, onPageChange]
    )

    if (totalPages <= 1) return null

    return (
        <div className="flex items-center justify-between px-1 py-3">
            {/* Item count */}
            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                {totalItems !== undefined
                    ? `${totalItems} item${totalItems !== 1 ? "s" : ""} total`
                    : `Page ${currentPage} of ${totalPages}`}
            </p>

            {/* Navigation */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handlePrevious}
                    disabled={currentPage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                    aria-label="Previous page"
                >
                    <ChevronLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
                    Previous
                </button>

                <span className="text-xs font-medium text-wg-text dark:text-wg-dark-text tabular-nums">
                    {currentPage} / {totalPages}
                </span>

                <button
                    onClick={handleNext}
                    disabled={currentPage >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                    aria-label="Next page"
                >
                    Next
                    <ChevronRightIcon className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
            </div>
        </div>
    )
}
