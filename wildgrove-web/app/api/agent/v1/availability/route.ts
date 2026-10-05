// ══════════════════════════════════════════════════════════════════
// GET /api/agent/v1/availability — can a party still book this slot?
// Never returns any reservation detail, only the count of free seats.
// ══════════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server"
import { z } from "zod"
import { getAgentAvailability } from "@wildgrove/core/agent/queries"
import { agentOk, agentError } from "../response"

const querySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:MM"),
    partySize: z.coerce.number().int().min(1),
})

export async function GET(request: NextRequest) {
    try {
        const parsed = querySchema.safeParse(
            Object.fromEntries(request.nextUrl.searchParams)
        )

        if (!parsed.success) {
            return agentError(
                parsed.error.issues.map((i) => i.message).join("; "),
                400
            )
        }

        const outcome = await getAgentAvailability(parsed.data)
        if (!outcome.ok) return agentError(outcome.reason, 400)

        return agentOk(
            {
                date: parsed.data.date,
                time: parsed.data.time,
                partySize: parsed.data.partySize,
                available: outcome.available,
                slotsLeft: outcome.slotsLeft,
            },
            // Bookings change by the minute; a five-minute cache would lie.
            0
        )
    } catch (error) {
        console.error("[agent/v1/availability]", error)
        return agentError("Internal server error", 500)
    }
}
