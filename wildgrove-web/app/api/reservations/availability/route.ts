// ══════════════════════════════════════════════════════════════════
// GET /api/reservations/availability
// Checks if a time slot is available for a given date + party size.
// Never returns reservation details — only availability status.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { getAppSettings } from "@wildgrove/core/settings"
import { isSlotPastBookingCutoff, isValidSlotForSchedule } from "@wildgrove/core/reservation-schedule"
import { isCalendarDateAfterMaxBookable } from "@wildgrove/core/reservation-dates-lima"
import { getSlotCapacity } from "@wildgrove/core/reservation-capacity-query"

import type { ApiResponse } from "@wildgrove/core/types"

const querySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
    partySize: z.coerce.number().int().min(1),
})

interface AvailabilityData {
    available: boolean
    slotsLeft: number
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const parsed = querySchema.safeParse(
            Object.fromEntries(searchParams)
        )

        if (!parsed.success) {
            const response: ApiResponse = {
                success: false,
                error: "Invalid query parameters",
            }
            return NextResponse.json(response, { status: 400 })
        }

        const { date, time, partySize } = parsed.data
        const settings = await getAppSettings()
        const { advanceReservationMs, maxPartySize } = settings
        if (partySize > maxPartySize) {
            const response: ApiResponse = {
                success: false,
                error: `Maximum party size is ${maxPartySize}.`,
            }
            return NextResponse.json(response, { status: 400 })
        }

        if (isCalendarDateAfterMaxBookable(date, settings.maxDaysAhead)) {
            const response: ApiResponse = {
                success: false,
                error: "Selected date is beyond the current booking window.",
            }
            return NextResponse.json(response, { status: 400 })
        }

        const slotIsAllowed = isValidSlotForSchedule({
            date,
            time,
            openingTime: settings.openingTime,
            closingTime: settings.closingTime,
            timeSlotIncrement: settings.timeSlotIncrement,
            operatingDays: settings.operatingDays,
            closedTimeRanges: settings.closedTimeRanges,
        })

        if (!slotIsAllowed) {
            const response: ApiResponse = {
                success: false,
                error: "This slot is outside the current schedule.",
            }
            return NextResponse.json(response, { status: 400 })
        }

        // Too soon to book is not available, whatever the capacity says. Reported the
        // same way the chat tool reports it rather than as a 400, because the answer
        // depends on the clock and not on the request being malformed.
        if (isSlotPastBookingCutoff(date, time, advanceReservationMs)) {
            const response: ApiResponse<AvailabilityData> = {
                success: true,
                data: { available: false, slotsLeft: 0 },
            }
            return NextResponse.json(response)
        }

        const { available, slotsLeft } = await getSlotCapacity({ settings, date, time })

        const data: AvailabilityData = { available, slotsLeft }

        const response: ApiResponse<AvailabilityData> = {
            success: true,
            data,
        }
        return NextResponse.json(response)
    } catch (error) {
        console.error("[availability]", error)
        const response: ApiResponse = {
            success: false,
            error: "Internal server error",
        }
        return NextResponse.json(response, { status: 500 })
    }
}
