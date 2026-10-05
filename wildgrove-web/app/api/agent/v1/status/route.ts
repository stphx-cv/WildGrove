// ══════════════════════════════════════════════════════════════════
// GET /api/agent/v1/status — health of the agent API.
// Declared as the `status` relation in /.well-known/api-catalog, so it
// has to exist rather than be asserted.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { getAgentVenueFacts } from "@wildgrove/core/agent/queries"

export async function GET() {
    // Reads the settings row: proves the database answers, not just the function.
    try {
        await getAgentVenueFacts("en")
        return NextResponse.json(
            { success: true, data: { status: "ok", version: "1.0.0" } },
            { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
        )
    } catch (error) {
        console.error("[agent/v1/status]", error)
        return NextResponse.json(
            { success: false, data: { status: "degraded", version: "1.0.0" } },
            { status: 503, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
        )
    }
}
