// ══════════════════════════════════════════════════════════════════
// GET /api/config
// Public endpoint — returns app configuration needed by client
// components (no auth required, safe to expose).
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { getAppSettings } from "@wildgrove/core/settings"

export async function GET() {
    const {
        advanceReservationEnabled,
        advanceReservationMs,
        maxPartySize,
        timeSlotIncrement,
        openingTime,
        closingTime,
        operatingDays,
        maxDaysAhead,
        closedTimeRanges,
        timeFormat,
    } = await getAppSettings()

    return NextResponse.json({
        advanceReservationEnabled,
        advanceReservationMs,
        maxPartySize,
        timeSlotIncrement,
        openingTime,
        closingTime,
        operatingDays,
        maxDaysAhead,
        closedTimeRanges,
        timeFormat,
    })
}
