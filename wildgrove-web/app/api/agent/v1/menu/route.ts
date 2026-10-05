// ══════════════════════════════════════════════════════════════════
// GET /api/agent/v1/menu — the published menu, for agents.
// Public, read-only, versioned.
// ══════════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server"
import { resolveMenuCategoryDisplay } from "@wildgrove/core/menu-category-display"
import { pickLocalized, itemSlug } from "@wildgrove/core/agent/markdown"
import { getAgentMenu } from "@wildgrove/core/agent/queries"
import { agentPrice, getAgentCurrency, getAgentDiscounts } from "@wildgrove/core/agent/pricing"
import { absoluteLocalizedUrl } from "@wildgrove/core/seo/alternates"
import { agentOk, agentError, localeFrom } from "../response"

export async function GET(request: NextRequest) {
    try {
        const locale = localeFrom(request.nextUrl.searchParams)
        const [categories, discounts, currency] = await Promise.all([getAgentMenu(), getAgentDiscounts(), getAgentCurrency()])

        return agentOk({
            locale,
            currency,
            categories: categories.map((cat) => ({
                slug: cat.slug,
                name: resolveMenuCategoryDisplay({
                    locale,
                    category: cat.name,
                    categoryEs: cat.nameEs,
                    categorySlug: cat.slug,
                }),
                items: cat.items.map((item) => {
                    const slug = itemSlug(item, locale)
                    return {
                        slug,
                        name: pickLocalized(item.name, item.nameEs, locale),
                        description: pickLocalized(
                            item.description,
                            item.descriptionEs,
                            locale
                        ),
                        price: agentPrice(item, discounts, currency),
                        tags:
                            (locale === "es" && item.tagsEs?.length
                                ? item.tagsEs
                                : item.tags) ?? [],
                        url: absoluteLocalizedUrl("/menu/[slug]" as never, locale, {
                            slug,
                        } as never),
                    }
                }),
            })),
        })
    } catch (error) {
        console.error("[agent/v1/menu]", error)
        return agentError("Internal server error", 500)
    }
}
