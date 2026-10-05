// ══════════════════════════════════════════════════════════════════
// The category list the CMS reads, in one place.
//
// It used to live inside `app/api/categories/route.ts`, which meant a server
// page that needed categories had to ask its own API route over HTTP — a second
// function invocation across the ocean for data the page could read directly.
// The route still owns the endpoint; it imports the getter from here.
// ══════════════════════════════════════════════════════════════════

import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import { CATEGORIES_CACHE_TAG } from "@/lib/cache-tags"

/** `null` = every category, `"true"` = drafts only, `"false"` = published only. */
export type CategoryDraftFilter = string | null

/**
 * Cached so a panel load that only reads categories opens no Postgres
 * connection at all — the point being connections, not latency: each serverless
 * isolate holds one of its pool's slots for as long as it queries.
 *
 * Tagged with "menu" as well as its own tag because the row carries
 * `_count.items`, which changes whenever a menu item is created or deleted —
 * and the menu routes already revalidate "menu".
 */
export const getCategories = unstable_cache(
    async (draftParam: CategoryDraftFilter) => {
        const where: Record<string, unknown> = {}
        if (draftParam === "true") where.isDraft = true
        else if (draftParam === "false") where.isDraft = false

        return prisma.menuCategory.findMany({
            where,
            select: {
                id: true,
                name: true,
                nameEs: true,
                slug: true,
                icon: true,
                order: true,
                isDraft: true,
                _count: { select: { items: true } },
            },
            orderBy: [{ isDraft: "desc" }, { order: "asc" }],
        })
    },
    ["cms-categories"],
    { tags: [CATEGORIES_CACHE_TAG, "menu"], revalidate: 300 },
)

/** What a form's category dropdown needs, and nothing else. */
export type CategoryOption = {
    id: string
    name: string
    nameEs: string | null
    slug: string
    icon: string
}

/** The published categories, shaped for a form dropdown. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
    const categories = await getCategories("false")
    return categories.map(({ id, name, nameEs, slug, icon }) => ({
        id,
        name,
        nameEs,
        slug,
        icon,
    }))
}

/** A category with the available items under it — what a discount's target picker needs. */
export type CategoryWithItems = {
    id: string
    name: string
    items: { id: string; name: string; nameEs: string | null }[]
}

/**
 * Cached for the same reason as `getCategories`: the discount pages are server
 * components, so without this every visit to `/discounts/[id]` or
 * `/discounts/new` opens a Postgres connection for a list that changes when
 * someone edits the menu, not when someone opens a discount.
 *
 * Same tags, so the same saves drop it: a category mutation revalidates
 * `CATEGORIES_CACHE_TAG` and a menu-item mutation revalidates "menu", and this
 * row carries both a category's name and its items.
 */
export const getCategoriesWithItems = unstable_cache(
    async (): Promise<CategoryWithItems[]> =>
        prisma.menuCategory.findMany({
            orderBy: { order: "asc" },
            select: {
                id: true,
                name: true,
                items: {
                    where: { available: true },
                    orderBy: { name: "asc" },
                    select: { id: true, name: true, nameEs: true },
                },
            },
        }),
    ["cms-categories-with-items"],
    { tags: [CATEGORIES_CACHE_TAG, "menu"], revalidate: 300 },
)
