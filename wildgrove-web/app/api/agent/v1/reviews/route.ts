// ══════════════════════════════════════════════════════════════════
// GET /api/agent/v1/reviews — approved guest reviews.
// ══════════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server"
import { getAgentReviews } from "@wildgrove/core/agent/queries"
import { agentOk, agentError } from "../response"

export async function GET(request: NextRequest) {
    try {
        const raw = Number(request.nextUrl.searchParams.get("limit") ?? 10)
        const limit = Math.min(50, Math.max(1, Number.isFinite(raw) ? Math.trunc(raw) : 10))

        const { reviews, total } = await getAgentReviews(limit)
        return agentOk({ total, count: reviews.length, reviews })
    } catch (error) {
        console.error("[agent/v1/reviews]", error)
        return agentError("Internal server error", 500)
    }
}
