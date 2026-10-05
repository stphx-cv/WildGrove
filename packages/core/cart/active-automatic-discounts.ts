// ══════════════════════════════════════════════════════════════════
// The AUTOMATIC discounts active right now, for every storefront surface.
//
// The menu grid, the dish page, its related dishes, the home, the cart and its
// price, the quote, the checkout, the agent surface and Sage all read this one
// list, so what a guest sees and what they pay come from the same data.
//
// A discount counts when it is AUTOMATIC, active, not a draft and not parked
// (`applyToNone`). The rows are cached under the "discounts" tag, which the
// admin discount routes invalidate, with 300s as the fallback. The quote and
// the checkout pass `fresh: true` and read the same query without the cache,
// so what is charged never waits on that invalidation arriving. The
// validFrom/validUntil window is applied on every call, over the rows, so a
// discount starts and ends on time without anyone editing it.
// ══════════════════════════════════════════════════════════════════

import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import type { ActiveMenuDiscount } from "../menu-discounts"

type AutomaticDiscountRow = { discount: ActiveMenuDiscount; validFrom: string | null }

// Oldest first, so two discounts of the same scope resolve to the same one
// wherever `getDiscountForItem` picks between them.
async function queryAutomaticDiscountRows(): Promise<AutomaticDiscountRow[]> {
  const rows = await prisma.discount.findMany({
    where: {
      type: "AUTOMATIC",
      active: true,
      isDraft: false,
      applyToNone: false,
    },
    select: {
      id: true,
      name: true,
      description: true,
      valueType: true,
      value: true,
      valueUsd: true,
      menuItemId: true,
      categoryId: true,
      categoryIds: true,
      excludedItemIds: true,
      validFrom: true,
      validUntil: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })

  return rows.map((d) => ({
    discount: {
      id: d.id,
      name: d.name,
      description: d.description,
      type: "AUTOMATIC" as const,
      valueType: d.valueType as "PERCENTAGE" | "FIXED_AMOUNT",
      value: Number(d.value),
      valueUsd: d.valueUsd == null ? null : Number(d.valueUsd),
      menuItemId: d.menuItemId,
      categoryId: d.categoryId,
      categoryIds: d.categoryIds,
      excludedItemIds: d.excludedItemIds,
      validUntil: d.validUntil?.toISOString() ?? null,
    },
    validFrom: d.validFrom?.toISOString() ?? null,
  }))
}

const loadCachedAutomaticDiscountRows = unstable_cache(
  queryAutomaticDiscountRows,
  ["automatic-discounts"],
  { tags: ["discounts"], revalidate: 300 }
)

export async function loadActiveAutomaticDiscounts(
  options: { fresh?: boolean } = {}
): Promise<ActiveMenuDiscount[]> {
  const rows = options.fresh
    ? await queryAutomaticDiscountRows()
    : await loadCachedAutomaticDiscountRows()
  const now = Date.now()

  return rows
    .filter(
      ({ discount, validFrom }) =>
        (validFrom === null || new Date(validFrom).getTime() <= now) &&
        (discount.validUntil === null || new Date(discount.validUntil).getTime() >= now)
    )
    .map(({ discount }) => discount)
}
