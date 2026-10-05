// ══════════════════════════════════════════════════════════════════
// New Menu Item Page — /menu/new
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { getAppSettings } from "@wildgrove/core/settings"
import { getCategoryOptions } from "@/lib/admin/categories"
import { MenuItemForm } from "@/components/MenuItemForm"

export const metadata: Metadata = {
    title: "New Menu Item",
}

export default async function NewMenuItemPage() {
    // The form's dropdown and photo limit arrive with the page, not a round
    // trip after it. Both getters are cached, so this is usually free.
    const [categories, settings] = await Promise.all([getCategoryOptions(), getAppSettings()])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    New Menu Item
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Add a new dish to your restaurant menu
                </p>
            </div>
            <MenuItemForm categories={categories} imageLimit={settings.productImageLimit} />
        </div>
    )
}
