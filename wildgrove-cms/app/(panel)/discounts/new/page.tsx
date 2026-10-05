// ══════════════════════════════════════════════════════════════════
// New Discount Page — /discounts/new
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { getCategoriesWithItems } from "@/lib/admin/categories"
import { DiscountForm } from "@/components/DiscountForm"

export const metadata: Metadata = {
    title: "New Discount",
}

export default async function NewDiscountPage() {
    const categories = await getCategoriesWithItems()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    New Discount
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Create a new promotion, coupon, or happy hour
                </p>
            </div>
            <DiscountForm categories={categories} />
        </div>
    )
}
