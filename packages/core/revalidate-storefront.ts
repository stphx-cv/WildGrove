// ══════════════════════════════════════════════════════════════════
// Cross-app Data Cache invalidation.
//
// The CMS and the storefront are two separate processes. `revalidateTag` in one
// does not reach the other, so a CMS save on its own refreshes only the panel.
// The CMS pings this helper; the storefront route `/api/revalidate` applies the
// tags. Auth is `REVALIDATE_SECRET`, falling back to `INSFORGE_API_KEY` which
// both apps already hold.
// ══════════════════════════════════════════════════════════════════

import { timingSafeEqual } from "node:crypto"
import { siteUrl } from "./urls"

const EXACT_TAGS = new Set([
    "menu",
    "discounts",
    "app-settings",
    "reviews",
    "product-reviews",
])

export function isStorefrontCacheTag(tag: string): boolean {
    if (EXACT_TAGS.has(tag)) return true
    if (tag.startsWith("product-rating:")) return true
    if (tag.startsWith("product-reviews:")) return true
    return false
}

function revalidateSecret(): string | null {
    const dedicated = process.env.REVALIDATE_SECRET?.trim()
    if (dedicated) return dedicated
    const fallback = process.env.INSFORGE_API_KEY?.trim()
    return fallback || null
}

/** Secret the storefront route and the CMS ping both read. */
export function storefrontRevalidateSecret(): string | null {
    return revalidateSecret()
}

/**
 * Whether an Authorization header carries the shared secret. The storefront
 * routes the CMS calls (`/api/revalidate`, `/api/chat/status`) check it here.
 */
export function bearerMatchesStorefrontSecret(header: string | null): boolean {
    const secret = revalidateSecret()
    if (!secret || !header?.startsWith("Bearer ")) return false
    const a = Buffer.from(header.slice("Bearer ".length))
    const b = Buffer.from(secret)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
}

/**
 * Ask wildgrove.cv to drop the given Data Cache tags. No-ops without a secret
 * or when every tag is CMS-only. Failures are logged, never thrown: a CMS save
 * must not 500 because the storefront was unreachable.
 */
export async function pingStorefrontRevalidate(tags: string[]): Promise<void> {
    const secret = revalidateSecret()
    const allowed = [...new Set(tags)].filter(isStorefrontCacheTag)
    if (!secret || allowed.length === 0) return

    try {
        const res = await fetch(`${siteUrl()}/api/revalidate`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ tags: allowed }),
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
        })
        if (!res.ok) {
            console.error("[revalidate-storefront] storefront answered", res.status)
        }
    } catch (error) {
        console.error("[revalidate-storefront]", error)
    }
}
