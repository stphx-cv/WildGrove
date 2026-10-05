// ══════════════════════════════════════════════════════════════════
// POST /api/revalidate
// Called by the CMS after a save so storefront Data Cache tags drop.
// Bearer secret: REVALIDATE_SECRET, or INSFORGE_API_KEY if unset.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod"
import {
    bearerMatchesStorefrontSecret,
    isStorefrontCacheTag,
    storefrontRevalidateSecret,
} from "@wildgrove/core/revalidate-storefront"

const bodySchema = z.object({
    tags: z.array(z.string().min(1).max(80)).min(1).max(20),
})

export async function POST(request: NextRequest) {
    const secret = storefrontRevalidateSecret()
    if (!secret) {
        return NextResponse.json({ success: false, error: "Revalidate is not configured" }, { status: 503 })
    }
    if (!bearerMatchesStorefrontSecret(request.headers.get("authorization"))) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    let json: unknown
    try {
        json = await request.json()
    } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 })
    }

    const tags = [...new Set(parsed.data.tags)].filter(isStorefrontCacheTag)
    if (tags.length === 0) {
        return NextResponse.json({ success: false, error: "No allowed tags" }, { status: 400 })
    }

    // Expire at once instead of stale-while-revalidate, so the first request
    // after a save already reads the new rows.
    for (const tag of tags) {
        revalidateTag(tag, { expire: 0 })
    }

    return NextResponse.json({ success: true, data: { tags } })
}
