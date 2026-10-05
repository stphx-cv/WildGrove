// ══════════════════════════════════════════════════════════════════
// GET /api/agent/v1/venue — opening hours and how to reach the place.
// ══════════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server"
import { getAgentVenueFacts } from "@wildgrove/core/agent/queries"
import { agentOk, agentError, localeFrom } from "../response"

export async function GET(request: NextRequest) {
    try {
        const locale = localeFrom(request.nextUrl.searchParams)
        const facts = await getAgentVenueFacts(locale)

        return agentOk({
            locale,
            name: "Wild Grove",
            timezone: "America/Lima",
            openingHours: facts.openingHours,
            address: facts.address,
            phone: facts.phone,
            email: facts.email,
            socials: facts.socials,
        })
    } catch (error) {
        console.error("[agent/v1/venue]", error)
        return agentError("Internal server error", 500)
    }
}
