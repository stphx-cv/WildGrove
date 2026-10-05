// GET /api/reservation-config — public, returns booking constraint settings
import { NextResponse } from "next/server"
import { getAppSettings } from "@wildgrove/core/settings"

export async function GET() {
    const settings = await getAppSettings()
    return NextResponse.json({
        advanceNoticeMs: settings.advanceReservationMs,
        dateFormat: settings.dateFormat,
        timeFormat: settings.timeFormat,
    })
}
