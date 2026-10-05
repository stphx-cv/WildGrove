// ══════════════════════════════════════════════════════════════════
// Edit Menu Item Page — /menu/[id]
// Fetches item data + linked discounts server-side
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@wildgrove/db"
import { getAppSettings } from "@wildgrove/core/settings"
import { getCategoryOptions } from "@/lib/admin/categories"
import { MenuItemForm } from "@/components/MenuItemForm"

export const metadata: Metadata = {
    title: "Edit Menu Item",
}

export default async function EditMenuItemPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    // Fetch the item first so we can use its categoryId for the discount queries
    const item = await prisma.menuItem.findUnique({
        where: { id },
        select: {
            id: true,
            sku: true,
            slug: true,
            slugEs: true,
            name: true,
            nameEs: true,
            description: true,
            descriptionEs: true,
            prices: true,
            imageUrl: true,
            images: true,
            tags: true,
            tagsEs: true,
            tagColors: true,
            ingredients: true,
            ingredientsEs: true,
            available: true,
            featured: true,
            featuredOrder: true,
            order: true,
            categoryId: true,
            isDraft: true,
            parentId: true,
        },
    })

    if (!item) {
        notFound()
    }

    // Everything else depends only on the item, so it goes in one round:
    // the parent, the drafts, the three discount scopes, and the two things the
    // form used to fetch for itself after mounting (categories, image limit).
    const discountSelect = {
        id: true, name: true, type: true, valueType: true,
        value: true, valueUsd: true, code: true, active: true, excludedItemIds: true,
    }
    const [
        parent,
        drafts,
        directDiscounts,
        categoryDiscounts,
        globalDiscounts,
        categories,
        settings,
    ] = await Promise.all([
        // Child draft: the parent, so the form can show its slug, name and SKU.
        item.parentId
            ? prisma.menuItem.findUnique({
                  where: { id: item.parentId },
                  select: { id: true, slug: true, slugEs: true, name: true, sku: true },
              })
            : Promise.resolve(null),
        // Published parent: its drafts, for the sidebar panel.
        !item.isDraft
            ? prisma.menuItem.findMany({
                  where: { parentId: id },
                  select: { id: true, name: true, updatedAt: true },
                  orderBy: { updatedAt: "desc" },
              })
            : Promise.resolve([]),
        // Directly linked to this item
        prisma.discount.findMany({
            where: { menuItemId: id },
            select: discountSelect,
            orderBy: { createdAt: "desc" },
        }),
        // Linked to this item's category (but not to a specific item, not excluding this item)
        item.categoryId ? prisma.discount.findMany({
            where: {
                menuItemId: null,
                applyToNone: false,
                NOT: { excludedItemIds: { has: id } },
                OR: [
                    { categoryId: item.categoryId },
                    { categoryIds: { has: item.categoryId } },
                ],
            },
            select: discountSelect,
            orderBy: { createdAt: "desc" },
        }) : Promise.resolve([]),
        // Global discounts (no item or category restriction, not excluding this item)
        prisma.discount.findMany({
            where: {
                menuItemId: null,
                categoryId: null,
                categoryIds: { isEmpty: true },
                applyToNone: false,
                NOT: { excludedItemIds: { has: id } },
            },
            select: discountSelect,
            orderBy: { createdAt: "desc" },
        }),
        // Both come from `unstable_cache`, so a cache hit costs no connection.
        getCategoryOptions(),
        getAppSettings(),
    ])

    const allDiscounts = [
        ...directDiscounts.map((d: (typeof directDiscounts)[number]) => ({ ...d, value: Number(d.value), valueUsd: d.valueUsd == null ? null : Number(d.valueUsd), type: d.type === "COUPON" ? "COUPON" as const : "AUTOMATIC" as const, scope: "direct" as const })),
        ...categoryDiscounts.map((d: (typeof categoryDiscounts)[number]) => ({ ...d, value: Number(d.value), valueUsd: d.valueUsd == null ? null : Number(d.valueUsd), type: d.type === "COUPON" ? "COUPON" as const : "AUTOMATIC" as const, scope: "category" as const })),
        ...globalDiscounts.map((d: (typeof globalDiscounts)[number]) => ({ ...d, value: Number(d.value), valueUsd: d.valueUsd == null ? null : Number(d.valueUsd), type: d.type === "COUPON" ? "COUPON" as const : "AUTOMATIC" as const, scope: "global" as const })),
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    Edit Menu Item
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Update &ldquo;{item.name}&rdquo;
                </p>
            </div>
            <MenuItemForm
                initialData={{
                    ...item,
                    prices: (item.prices && typeof item.prices === "object"
                        ? item.prices
                        : {}) as Partial<Record<"PEN" | "USD", number>>,
                    imageUrl: item.imageUrl,
                    tagColors: (item.tagColors ?? {}) as Record<string, string>,
                    isDraft: item.isDraft,
                    parentId: item.parentId,
                }}
                linkedDiscounts={allDiscounts}
                parent={parent ?? undefined}
                drafts={drafts.map((d) => ({
                    id: d.id,
                    name: d.name,
                    updatedAt: d.updatedAt.toISOString(),
                }))}
                categories={categories}
                imageLimit={settings.productImageLimit}
            />
        </div>
    )
}
