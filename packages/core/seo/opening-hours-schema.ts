// ══════════════════════════════════════════════════════════════════
// schema.org OpeningHoursSpecification, built from the reservation schedule.
//
// The JSON-LD in the root layout used to carry hard-coded hours that
// disagreed with what the reservations page, the agent API and the markdown
// representation publish. The structured data is what an assistant reads
// without opening the page, so it now comes from the same CMS settings that
// formatPublicOpeningHoursLines() already reads. One source.
// ══════════════════════════════════════════════════════════════════

import { DAY_FULL_EN } from "../public-opening-hours"
import { parseOperatingDays } from "../reservation-schedule"

export interface OpeningHoursSpecification {
    "@type": "OpeningHoursSpecification"
    dayOfWeek: string[]
    opens: string
    closes: string
}

/**
 * One specification covering every operating day. Empty when no day is
 * configured, so the caller can leave the property out instead of publishing
 * an empty array. Booking breaks are not "closed" and are not represented.
 */
export function openingHoursSpecification(
    operatingDays: string,
    openingTime: string,
    closingTime: string
): OpeningHoursSpecification[] {
    const days = parseOperatingDays(operatingDays)
    if (days.length === 0) return []

    return [
        {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: days.map((d) => DAY_FULL_EN[d - 1]),
            opens: openingTime,
            closes: closingTime,
        },
    ]
}
