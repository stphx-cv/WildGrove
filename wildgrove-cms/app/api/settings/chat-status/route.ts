// ══════════════════════════════════════════════════════════════════
// GET /api/settings/chat-status — ADMIN or OWNER
// Whether the storefront has the keys Sage needs, and the decision model's
// last answer and last failure. The panel holds no AI key: it asks the
// storefront, which answers yes or no for each one.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { fetchStorefrontChatStatus } from "@wildgrove/core/chat/storefront-chat-status"

export const dynamic = "force-dynamic"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const status = await fetchStorefrontChatStatus()
    if (!status) {
        return NextResponse.json({ success: false, error: "The storefront did not answer." }, { status: 502 })
    }
    return NextResponse.json({ success: true, data: status })
}
