// ══════════════════════════════════════════════════════════════════
// Drop Data Cache tags in this app and on the storefront.
// CMS `revalidateTag` cannot reach wildgrove.cv — that hop is the ping.
// ══════════════════════════════════════════════════════════════════

import { revalidateTag } from "next/cache"
import { pingStorefrontRevalidate } from "@wildgrove/core/revalidate-storefront"
import { CATEGORIES_CACHE_TAG } from "@/lib/cache-tags"

export async function revalidatePublic(...tags: string[]): Promise<void> {
    const unique = [...new Set(tags)]
    for (const tag of unique) {
        revalidateTag(tag, "default")
    }

    const remote = [...unique]
    if (unique.includes(CATEGORIES_CACHE_TAG) && !remote.includes("menu")) {
        remote.push("menu")
    }
    await pingStorefrontRevalidate(remote)
}
