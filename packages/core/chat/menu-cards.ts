// ══════════════════════════════════════════════════════════════════
// Sage AI | Menu cards
// Every dish card in the chat is built here from database rows: the
// get_menu tool, Sage's replies and "See N more" all go through the same
// conversion, so a card never carries anything a model wrote.
// ══════════════════════════════════════════════════════════════════

import { prisma, type Prisma } from "@wildgrove/db"
import { getAppSettings } from "../settings"
import { loadActiveAutomaticDiscounts } from "../cart/active-automatic-discounts"
import { agentPrice, formatAgentPrice } from "../agent/pricing"
import { computeDiscountedPrice, getDiscountForItem } from "../menu-discounts"
import { onSaleMenuItemWhere } from "../menu-visibility"

/** The columns a card needs. */
export const MENU_CARD_SELECT = {
  id: true,
  slug: true,
  slugEs: true,
  name: true,
  nameEs: true,
  description: true,
  descriptionEs: true,
  prices: true,
  tags: true,
  tagsEs: true,
  tagColors: true,
  imageUrl: true,
  ingredients: true,
  ingredientsEs: true,
  categoryId: true,
  category: { select: { name: true, nameEs: true, slug: true } },
} satisfies Prisma.MenuItemSelect

export type MenuCardRow = Prisma.MenuItemGetPayload<{ select: typeof MENU_CARD_SELECT }>

type Prices = { PEN?: number; USD?: number }

/** One dish card, with both languages so the widget can follow a locale switch. */
export type MenuCard = {
  id: string
  slug: string
  name: string
  nameEs: string | null
  description: string
  descriptionEs: string | null
  prices: Prices
  /** The list price struck through and the discount label, only when a discount applies. */
  listPrices?: Prices
  discount?: { valueType: string; value: number; valueUsd: number | null }
  price: string
  category: string
  categoryEs: string | null
  categorySlug: string
  tags: string[]
  tagsEs: string[]
  tagColors: Record<string, string>
  imageUrl: string | null
  ingredients?: string[]
}

/**
 * Cards for the given rows, in their order. The price is the one checkout
 * charges: the same automatic discounts and the same pricing as the menu and
 * the agent surface. Ingredients go in only when the owner allows it.
 */
export async function menuCardsFromRows(rows: readonly MenuCardRow[], language: "en" | "es"): Promise<MenuCard[]> {
  if (rows.length === 0) return []
  const [{ sageShareIngredients }, discounts] = await Promise.all([
    getAppSettings(),
    loadActiveAutomaticDiscounts(),
  ])

  return rows.map((item) => {
    const listPrices = (item.prices ?? {}) as Prices
    const discount = getDiscountForItem(item, discounts)
    const prices = discount
      ? {
          ...(typeof listPrices.PEN === "number" && { PEN: computeDiscountedPrice(listPrices.PEN, discount, "PEN") }),
          ...(typeof listPrices.USD === "number" && { USD: computeDiscountedPrice(listPrices.USD, discount, "USD") }),
        }
      : listPrices
    return {
      id: item.id,
      slug: language === "es" && item.slugEs ? item.slugEs : item.slug,
      name: item.name,
      nameEs: item.nameEs ?? null,
      description: item.description,
      descriptionEs: item.descriptionEs ?? null,
      prices,
      ...(discount && {
        listPrices,
        discount: { valueType: discount.valueType, value: discount.value, valueUsd: discount.valueUsd },
      }),
      price: formatAgentPrice(agentPrice({ id: item.id, categoryId: item.categoryId, prices: listPrices }, discounts, "PEN")),
      category: item.category?.name ?? "",
      categoryEs: item.category?.nameEs ?? null,
      categorySlug: item.category?.slug ?? "",
      tags: item.tags,
      tagsEs: item.tagsEs,
      tagColors: (item.tagColors ?? {}) as Record<string, string>,
      imageUrl: item.imageUrl ?? null,
      ...(sageShareIngredients ? { ingredients: language === "es" ? item.ingredientsEs : item.ingredients } : {}),
    }
  })
}

/**
 * Cards for the given dish ids, in the order of the ids. A dish that is no
 * longer published or on sale is left out, so a list saved minutes ago can
 * lose one without showing it.
 */
export async function loadMenuCards(ids: readonly string[], language: "en" | "es"): Promise<MenuCard[]> {
  if (ids.length === 0) return []
  const rows = await prisma.menuItem.findMany({
    where: { AND: [onSaleMenuItemWhere, { id: { in: [...ids] } }] },
    select: MENU_CARD_SELECT,
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = ids.map((id) => byId.get(id)).filter((row): row is MenuCardRow => !!row)
  return menuCardsFromRows(ordered, language)
}

/** One dish exactly as get_menu returned it. */
export type MenuToolItem = { id: string } & Record<string, unknown>

/** Dishes of one get_menu result. Anything unparsable yields none. */
export function parseMenuToolItems(result: string): MenuToolItem[] {
  try {
    const parsed = JSON.parse(result) as { items?: unknown }
    if (!Array.isArray(parsed.items)) return []
    return parsed.items.filter(
      (item): item is MenuToolItem =>
        !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string",
    )
  } catch {
    return []
  }
}
