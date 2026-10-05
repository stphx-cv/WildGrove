"use client"

// ══════════════════════════════════════════════════════════════════
// Admin New Category Page — /categories/new
// ══════════════════════════════════════════════════════════════════

import Link from "next/link"
import { CategoryForm } from "@/components/CategoryForm"
import { ChevronLeftIcon } from "@wildgrove/ui/icons"

export default function NewCategoryPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/categories"
                    className="flex items-center justify-center w-8 h-8 rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors"
                >
                    <ChevronLeftIcon className="w-4 h-4" strokeWidth={2} />
                </Link>
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                        New Category
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                        Create a new menu category with bilingual name and icon
                    </p>
                </div>
            </div>

            <CategoryForm />
        </div>
    )
}
