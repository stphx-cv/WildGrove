// Convenience wrapper around formatPublicOpeningHoursLines that takes
// the full AppSettings object so callers don't need to destructure.

import { formatPublicOpeningHoursLines } from "./public-opening-hours"
import type { getAppSettings } from "./settings"

type AppSettings = Awaited<ReturnType<typeof getAppSettings>>

export function formatOperatingHours(settings: AppSettings, locale: "en" | "es"): string[] {
    return formatPublicOpeningHoursLines(
        settings.operatingDays,
        settings.openingTime,
        settings.closingTime,
        settings.closedTimeRanges,
        settings.timeFormat,
        locale
    )
}
