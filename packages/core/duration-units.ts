// ══════════════════════════════════════════════════════════════════
// Duration units — the value + unit pairs AppSettings stores
// ══════════════════════════════════════════════════════════════════
//
// `advanceReservation` and `reservationDuration` are both stored as a number
// plus a unit string. The conversion lives here rather than in settings.ts so
// that reservation-capacity.ts can use it without importing settings.ts, which
// imports the capacity default in return.

export type DurationUnit = "minutes" | "hours" | "days" | "weeks"

const UNIT_MS: Record<DurationUnit, number> = {
    minutes: 60 * 1000,
    hours:   60 * 60 * 1000,
    days:    24 * 60 * 60 * 1000,
    weeks:   7 * 24 * 60 * 60 * 1000,
}

/** Unknown units fall back to hours, the default in the schema. */
export function durationToMs(value: number, unit: string): number {
    return value * (UNIT_MS[unit as DurationUnit] ?? UNIT_MS.hours)
}
