import { isCalendarDateAfterMaxBookable } from "./reservation-dates-lima"

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export type ClosedTimeRange = { start: string; end: string }

export const DEFAULT_OPERATING_DAYS = [1, 2, 3, 4, 5, 6, 7] as const

/** Parse JSON from DB into valid same-day ranges (start < end, HH:MM). */
export function parseClosedTimeRanges(raw: unknown): ClosedTimeRange[] {
    if (!Array.isArray(raw)) return []
    const out: ClosedTimeRange[] = []
    for (const item of raw) {
        if (!item || typeof item !== "object") continue
        const rec = item as Record<string, unknown>
        const start = typeof rec.start === "string" ? rec.start : ""
        const end = typeof rec.end === "string" ? rec.end : ""
        const sm = timeToMinutes(start)
        const em = timeToMinutes(end)
        if (sm === null || em === null || sm >= em) continue
        out.push({ start, end })
    }
    return out
}

/** Max 20 ranges, sorted for stable compare/save */
export function normalizeClosedTimeRangesForStorage(raw: unknown): ClosedTimeRange[] {
    const parsed = parseClosedTimeRanges(raw)
    return parsed
        .slice(0, 20)
        .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

export function sortClosedTimeRanges(ranges: ClosedTimeRange[]): ClosedTimeRange[] {
    return [...ranges].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

export function closedRangesFullyInsideOpeningHours(
    openingTime: string,
    closingTime: string,
    ranges: ClosedTimeRange[],
): boolean {
    const o = timeToMinutes(openingTime)
    const c = timeToMinutes(closingTime)
    if (o === null || c === null) return ranges.length === 0
    for (const r of ranges) {
        const sm = timeToMinutes(r.start)
        const em = timeToMinutes(r.end)
        if (sm === null || em === null || sm < o || em > c) return false
    }
    return true
}

function closedRangesToMinuteSpans(ranges: ClosedTimeRange[]): Array<{ start: number; end: number }> {
    return ranges
        .map((r) => {
            const sm = timeToMinutes(r.start)
            const em = timeToMinutes(r.end)
            if (sm === null || em === null || sm >= em) return null
            return { start: sm, end: em }
        })
        .filter((x): x is { start: number; end: number } => x !== null)
}

/** Slot start minute falls inside [breakStart, breakEnd) → excluded */
export function isSlotStartInClosedRange(slotStartMinutes: number, ranges: ClosedTimeRange[]): boolean {
    const spans = closedRangesToMinuteSpans(ranges)
    return spans.some(({ start, end }) => slotStartMinutes >= start && slotStartMinutes < end)
}

export function parseOperatingDays(input: string | number[]): number[] {
    const days = Array.isArray(input)
        ? input
        : input.split(",").map((part) => Number.parseInt(part.trim(), 10))

    return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort((a, b) => a - b)
}

export function timeToMinutes(time: string): number | null {
    const match = TIME_RE.exec(time)
    if (!match) return null

    const hours = Number.parseInt(match[1], 10)
    const minutes = Number.parseInt(match[2], 10)
    return (hours * 60) + minutes
}

export function minutesToTime(totalMinutes: number): string {
    const normalized = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59))
    const hours = Math.floor(normalized / 60)
    const minutes = normalized % 60
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/** Slot starts from opening through closing (inclusive at closing minute); breaks remove any slot whose start falls in [start, end). */
export function generateTimeSlots(
    openingTime: string,
    closingTime: string,
    incrementMinutes: number,
    closedRanges: ClosedTimeRange[] = []
): string[] {
    const opening = timeToMinutes(openingTime)
    const closing = timeToMinutes(closingTime)

    if (
        opening === null ||
        closing === null ||
        !Number.isInteger(incrementMinutes) ||
        incrementMinutes <= 0 ||
        closing < opening
    ) {
        return []
    }

    const slots: string[] = []
    for (let current = opening; current <= closing; current += incrementMinutes) {
        if (isSlotStartInClosedRange(current, closedRanges)) continue
        slots.push(minutesToTime(current))
    }
    return slots
}

export function getWeekdayFromDate(dateStr: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null

    const middayLima = new Date(`${dateStr}T12:00:00-05:00`)
    if (Number.isNaN(middayLima.getTime())) return null

    const day = middayLima.getUTCDay() // 0=Sun, 1=Mon...6=Sat
    return day === 0 ? 7 : day // convert to 1=Mon...7=Sun
}

export function isOpenDay(dateStr: string, operatingDays: string | number[]): boolean {
    const weekday = getWeekdayFromDate(dateStr)
    if (weekday === null) return false
    const allowed = parseOperatingDays(operatingDays)
    return allowed.includes(weekday)
}

export function isValidSlotForSchedule(args: {
    date: string
    time: string
    openingTime: string
    closingTime: string
    timeSlotIncrement: number
    operatingDays: string | number[]
    closedTimeRanges?: ClosedTimeRange[] | unknown
}): boolean {
    const { date, time, openingTime, closingTime, timeSlotIncrement, operatingDays, closedTimeRanges } = args
    if (!isOpenDay(date, operatingDays)) return false

    const closed = parseClosedTimeRanges(closedTimeRanges ?? [])

    const slots = generateTimeSlots(openingTime, closingTime, timeSlotIncrement, closed)
    return slots.includes(time)
}

/**
 * Same rule as the reservation TimePicker: slot start (America/Lima wall time) must be
 * at or after `nowMs + advanceNoticeMs`.
 */
export function isSlotPastBookingCutoff(
    dateIso: string,
    slot: string,
    advanceNoticeMs: number,
    nowMs: number = Date.now(),
): boolean {
    const slotDateTime = new Date(`${dateIso}T${slot}:00-05:00`)
    if (Number.isNaN(slotDateTime.getTime())) return true
    return slotDateTime.getTime() < nowMs + advanceNoticeMs
}

/** True if at least one configured slot on `dateIso` is still bookable under the advance-notice rule. */
export function dateHasBookableTimeSlot(
    dateIso: string,
    options: {
        advanceNoticeMs: number
        openingTime: string
        closingTime: string
        timeSlotIncrement: number
        operatingDays: string | number[]
        closedTimeRanges?: ClosedTimeRange[]
        nowMs?: number
    },
): boolean {
    const {
        advanceNoticeMs,
        openingTime,
        closingTime,
        timeSlotIncrement,
        operatingDays,
        closedTimeRanges = [],
        nowMs = Date.now(),
    } = options

    if (!isOpenDay(dateIso, operatingDays)) return false

    const slots = generateTimeSlots(openingTime, closingTime, timeSlotIncrement, closedTimeRanges)
    if (slots.length === 0) return false

    return slots.some((slot) => !isSlotPastBookingCutoff(dateIso, slot, advanceNoticeMs, nowMs))
}

/** Why a reservation cannot take a date and time, one reason per check. */
export type ReservationSlotRejection =
    | "PARTY_TOO_LARGE"
    | "BEYOND_MAX_DATE"
    | "OUTSIDE_SCHEDULE"
    | "TOO_SOON"

/**
 * The checks a date, a time and a party size must pass before a reservation
 * takes a slot, in the order the booking form runs them: party size, the last
 * bookable day, the schedule (open days, opening hours, slot grid and closed
 * ranges), then advance notice. Returns the first one that fails, or null.
 *
 * Capacity is not checked here; that count runs under the slot lock, in
 * `reservation-occupy.ts`. Each caller keeps its own wording for each reason.
 */
export function reservationSlotRejection(
    settings: {
        maxPartySize: number
        maxDaysAhead: number
        openingTime: string
        closingTime: string
        timeSlotIncrement: number
        operatingDays: string | number[]
        closedTimeRanges?: ClosedTimeRange[] | unknown
        advanceReservationMs: number
    },
    request: { date: string; time: string; partySize: number },
    nowMs: number = Date.now(),
): ReservationSlotRejection | null {
    if (request.partySize > settings.maxPartySize) return "PARTY_TOO_LARGE"

    if (isCalendarDateAfterMaxBookable(request.date, settings.maxDaysAhead)) return "BEYOND_MAX_DATE"

    const slotIsAllowed = isValidSlotForSchedule({
        date: request.date,
        time: request.time,
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        timeSlotIncrement: settings.timeSlotIncrement,
        operatingDays: settings.operatingDays,
        closedTimeRanges: settings.closedTimeRanges,
    })
    if (!slotIsAllowed) return "OUTSIDE_SCHEDULE"

    if (isSlotPastBookingCutoff(request.date, request.time, settings.advanceReservationMs, nowMs)) return "TOO_SOON"

    return null
}

/**
 * The booking form's answer for each reason, reused by every endpoint that
 * moves a reservation so the same check reads the same everywhere. The
 * storefront passes the page's language; the panel keeps the English default.
 */
export function reservationSlotRejectionResponse(
    rejection: ReservationSlotRejection,
    maxPartySize: number,
    locale: "en" | "es" = "en",
): { error: string; status: number } {
    const es = locale === "es"
    switch (rejection) {
        case "PARTY_TOO_LARGE":
            return {
                error: es ? `El máximo de personas por reserva es ${maxPartySize}.` : `Maximum party size is ${maxPartySize}.`,
                status: 400,
            }
        case "BEYOND_MAX_DATE":
            return {
                error: es ? "La fecha está fuera del plazo de reservas permitido." : "Selected date is beyond the current booking window.",
                status: 400,
            }
        case "OUTSIDE_SCHEDULE":
            return {
                error: es
                    ? "La fecha u hora elegida está fuera de los días y horarios de atención."
                    : "Selected date/time is outside current booking schedule.",
                status: 400,
            }
        case "TOO_SOON":
            return {
                error: es
                    ? "Este horario es demasiado pronto para reservar. Por favor elige uno más tarde."
                    : "This time slot is too soon to book. Please choose a later time.",
                status: 422,
            }
    }
}
