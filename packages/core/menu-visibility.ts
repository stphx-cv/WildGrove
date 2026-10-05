// ══════════════════════════════════════════════════════════════════
// Which dishes the storefront shows, and which it sells.
//
// Published: the dish is not a draft, and neither is its category.
// On sale:   published and available.
//
// The dish page shows a published dish, available or not. The related
// dishes, the static params, the sitemap, the home, adding to the cart and
// paying only take dishes on sale. Both are Prisma filters: combine them with
// the caller's own conditions under an AND, so neither side's OR replaces the
// other's.
// ══════════════════════════════════════════════════════════════════

import type { Prisma } from "@wildgrove/db"

export const publishedMenuItemWhere: Prisma.MenuItemWhereInput = {
    isDraft: false,
    OR: [{ categoryId: null }, { category: { isDraft: false } }],
}

export const onSaleMenuItemWhere: Prisma.MenuItemWhereInput = {
    AND: [publishedMenuItemWhere, { available: true }],
}
