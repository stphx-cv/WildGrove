// ══════════════════════════════════════════════════════════════════
// App-wide date / time display — driven by AppSettings (CMS General)
// Restaurant context: Lima (no DST). Use this TZ for reservation UX.
// ══════════════════════════════════════════════════════════════════

export const APP_DATETIME_TIMEZONE = "America/Lima"

const VALID_DATE_FORMATS = new Set(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"])

export type AppDateFormatPreference = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
export type AppTimeFormatPreference = "12h" | "24h"

export function normalizeDateFormatPreference(value: string | undefined): AppDateFormatPreference {
    if (value && VALID_DATE_FORMATS.has(value)) return value as AppDateFormatPreference
    return "DD/MM/YYYY"
}

export function normalizeTimeFormatPreference(value: string | undefined): AppTimeFormatPreference {
    return value === "12h" ? "12h" : "24h"
}

/** Calendar date only (no weekday), using CMS “Date format” preference */
export function formatAppDate(
    date: Date,
    dateFormat: string,
    timeZone: string = APP_DATETIME_TIMEZONE,
): string {
    const df = normalizeDateFormatPreference(dateFormat)
    const opts: Intl.DateTimeFormatOptions = { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }
    if (df === "YYYY-MM-DD") {
        return date.toLocaleDateString("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    }
    if (df === "MM/DD/YYYY") {
        return date.toLocaleDateString("en-US", opts)
    }
    return date.toLocaleDateString("en-GB", opts)
}

/** Clock time using CMS “Time format” (12h / 24h) */
export function formatAppTime(
    date: Date,
    timeFormat: string,
    timeZone: string = APP_DATETIME_TIMEZONE,
): string {
    const tf = normalizeTimeFormatPreference(timeFormat)
    if (tf === "24h") {
        return date.toLocaleTimeString("en-GB", {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })
    }
    return date.toLocaleTimeString("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
}

export function formatAppDateFromIso(
    iso: string,
    dateFormat: string,
    timeZone: string = APP_DATETIME_TIMEZONE,
): string {
    return formatAppDate(new Date(iso), dateFormat, timeZone)
}

export function formatAppTimeFromIso(
    iso: string,
    timeFormat: string,
    timeZone: string = APP_DATETIME_TIMEZONE,
): string {
    return formatAppTime(new Date(iso), timeFormat, timeZone)
}

/**
 * Label for a booking slot string "HH:mm" (24h wall clock from schedule).
 * Values sent to the API stay in 24h; this is display-only.
 */
export function formatWallClockSlotLabel(hhmm: string, timeFormat: string): string {
    const tf = normalizeTimeFormatPreference(timeFormat)
    const parts = hhmm.trim().split(":")
    const h = Number(parts[0])
    const m = Number(parts[1])
    if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
    if (tf === "24h") {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    }
    const period = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

/** e.g. "Wednesday, 21/04/2026" — weekday from locale + numeric date from CMS */
export function formatAppWeekdayAndDate(
    date: Date,
    dateFormat: string,
    weekdayLocale: string,
    timeZone: string = APP_DATETIME_TIMEZONE,
): string {
    const weekday = date.toLocaleDateString(weekdayLocale, { weekday: "long", timeZone })
    return `${weekday}, ${formatAppDate(date, dateFormat, timeZone)}`
}

export function formatAppWeekdayAndDateFromIso(
    iso: string,
    dateFormat: string,
    weekdayLocale: string,
    timeZone: string = APP_DATETIME_TIMEZONE,
): string {
    return formatAppWeekdayAndDate(new Date(iso), dateFormat, weekdayLocale, timeZone)
}

/**
 * Returns the start and end of a calendar day in Lima timezone as UTC Date objects.
 * Critical for "Revenue today" to match the restaurant's local timezone.
 */
export function getLimaDayBounds(date: Date = new Date()): { start: Date; end: Date } {
    const tz = APP_DATETIME_TIMEZONE
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
    const [y, m, d] = fmt.format(date).split("-").map(Number)
    // Build midnight Lima time → convert to UTC via parsing an ISO string with explicit TZ
    const limaDateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const startUtc = new Date(`${limaDateStr}T00:00:00-05:00`) // Lima is UTC-5 (no DST)
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
    return { start: startUtc, end: endUtc }
}
