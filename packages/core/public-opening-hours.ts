// ══════════════════════════════════════════════════════════════════
// Public copy for opening hours — mirrors reservation schedule settings
// ══════════════════════════════════════════════════════════════════

import { formatWallClockSlotLabel } from "./app-datetime-format"
import { parseOperatingDays, type ClosedTimeRange } from "./reservation-schedule"

export const DAY_FULL_EN = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const
const DAY_FULL_ES = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
] as const

function groupConsecutive(sortedDays: number[]): number[][] {
    if (sortedDays.length === 0) return []
    const groups: number[][] = []
    let cur = [sortedDays[0]]
    for (let i = 1; i < sortedDays.length; i++) {
        const d = sortedDays[i]
        const prev = cur[cur.length - 1]
        if (d === prev + 1) cur.push(d)
        else {
            groups.push(cur)
            cur = [d]
        }
    }
    groups.push(cur)
    return groups
}

function formatDayGroup(group: number[], locale: "en" | "es"): string {
    const names = locale === "es" ? DAY_FULL_ES : DAY_FULL_EN
    const a = group[0]
    const b = group[group.length - 1]
    if (a === b) return names[a - 1]
    return `${names[a - 1]} - ${names[b - 1]}`
}

/**
 * Human-readable lines for Contact / marketing (from reservation schedule).
 * Respects CMS 12h/24h preference. Includes booking break windows when configured.
 */
export function formatPublicOpeningHoursLines(
    operatingDays: string,
    openingTime: string,
    closingTime: string,
    closedTimeRanges: ClosedTimeRange[],
    timeFormat: string,
    locale: "en" | "es"
): string[] {
    const days = parseOperatingDays(operatingDays)
    if (days.length === 0) return []

    const openL = formatWallClockSlotLabel(openingTime, timeFormat)
    const closeL = formatWallClockSlotLabel(closingTime, timeFormat)
    const groups = groupConsecutive(days)
    const lines = groups.map((g) => `${formatDayGroup(g, locale)}: ${openL} – ${closeL}`)

    const breaks = closedTimeRanges.filter((r) => (r.start ?? "").trim() && (r.end ?? "").trim())
    if (breaks.length > 0) {
        const parts = breaks.map(
            (r) =>
                `${formatWallClockSlotLabel(r.start, timeFormat)} – ${formatWallClockSlotLabel(r.end, timeFormat)}`
        )
        const sep = locale === "es" ? "; " : "; "
        const label = locale === "es" ? "Sin reservas" : "No bookings"
        lines.push(`${label}: ${parts.join(sep)}`)
    }

    return lines
}
