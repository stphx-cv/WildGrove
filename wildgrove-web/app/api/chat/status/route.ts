// ══════════════════════════════════════════════════════════════════
// GET /api/chat/status
// Called by the CMS to know whether Sage can run: which keys are set on
// this server (yes or no, never a value) and the decision model's last
// answer and last failure. Bearer secret: REVALIDATE_SECRET, or
// INSFORGE_API_KEY if unset, as for /api/revalidate.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { bearerMatchesStorefrontSecret, storefrontRevalidateSecret } from "@wildgrove/core/revalidate-storefront"
import { readChatStatus } from "@wildgrove/core/chat/chat-status"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    if (!storefrontRevalidateSecret()) {
        return NextResponse.json({ success: false, error: "Status is not configured" }, { status: 503 })
    }
    if (!bearerMatchesStorefrontSecret(request.headers.get("authorization"))) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    try {
        return NextResponse.json({ success: true, data: await readChatStatus() })
    } catch (error) {
        console.error("[chat/status] GET error:", error)
        return NextResponse.json({ success: false, error: "Failed to read the chat status." }, { status: 500 })
    }
}
