// ══════════════════════════════════════════════════════════════════
// Lima calendar helpers (America/Lima, no DST) — booking date bounds
// ══════════════════════════════════════════════════════════════════

/** Today's calendar date in Lima as YYYY-MM-DD */
export function limaCalendarTodayIso(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

/**
 * Earliest calendar day (Lima) that can still meet the advance-notice rule,
 * evaluated in Lima calendar terms (same convention as the booking APIs).
 */
export function limaEarliestBookableDateIso(advanceNoticeMs: number, nowMs: number = Date.now()): string {
    return new Date(nowMs + advanceNoticeMs).toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

/** Add whole calendar days in Lima time (noon anchor avoids edge shifts). */
export function addCalendarDaysLima(dateIso: string, deltaDays: number): string {
    const base = new Date(`${dateIso}T12:00:00-05:00`)
    const next = new Date(base.getTime() + deltaDays * 24 * 60 * 60 * 1000)
    return next.toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

/**
 * Last calendar day (Lima) customers may choose: `limaCalendarTodayIso()` moved forward
 * by `maxDaysAhead` whole days. Example: maxDaysAhead = 1 → last day is tomorrow.
 */
export function limaMaxBookableDateIso(maxDaysAhead: number): string {
    const safe = Math.min(Math.max(Math.floor(maxDaysAhead), 1), 365)
    return addCalendarDaysLima(limaCalendarTodayIso(), safe)
}

/** YYYY-MM-DD lexicographic compare is valid for Lima en-CA strings */
export function isCalendarDateAfterMaxBookable(dateIso: string, maxDaysAhead: number): boolean {
    return dateIso > limaMaxBookableDateIso(maxDaysAhead)
}
