"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Edit Category Page — /categories/[id]
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CategoryForm } from "@/components/CategoryForm"
import { LoadingState } from "@/components/LoadingState"
import { ChevronLeftIcon } from "@wildgrove/ui/icons"

interface CategoryData {
    id: string
    name: string
    nameEs?: string | null
    slug: string
    slugEs?: string | null
    icon: string
    order: number
    isDraft?: boolean
    draftData?: {
        formState: {
            nameEn: string
            nameEs: string
            slugEn: string
            slugEs: string
            icon: string
            order: string
        }
        savedAt: string
    } | null
}

export default function EditCategoryPage() {
    const params = useParams<{ id: string }>()
    const id     = params?.id

    const [category, setCategory] = useState<CategoryData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError]         = useState<string | null>(null)

    useEffect(() => {
        if (!id) return
        fetch(`/api/categories/${id}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setCategory(json.data)
                else setError(json.error ?? "Category not found")
            })
            .catch(() => setError("Failed to load category"))
            .finally(() => setIsLoading(false))
    }, [id])

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
                        {isLoading ? "Loading…" : category ? `Edit: ${category.name}` : "Category Not Found"}
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                        Update name, icon, slug, or display order
                    </p>
                </div>
            </div>

            {isLoading && (
                <LoadingState size="section" message="Loading category…" />
            )}

            {error && (
                <div className="px-4 py-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {category && <CategoryForm initialData={category} />}
        </div>
    )
}
