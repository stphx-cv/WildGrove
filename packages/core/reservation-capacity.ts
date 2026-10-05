// ══════════════════════════════════════════════════════════════════
// Reservation capacity — the rules, shared by every caller
// ══════════════════════════════════════════════════════════════════
//
// How many reservations a time slot still accepts. The booking form, the
// reschedule endpoint, the availability endpoint, the Sage chat tools and the
// agent API all ask this question, and they all ask it here: one limit, one
// window, one way of counting.
//
// Two details decide whether the count is right:
//
//  1. The window is `reservationDuration`, how long a table stays occupied. It
//     is not `advanceReservationMs`, which is the minimum advance notice
//     ("book at least 2 hours ahead") and is 0 whenever advance notice is
//     disabled in the CMS. A zero-length window counts nothing and removes the
//     capacity limit without saying so, which is why the duration falls back to
//     `timeSlotIncrement` and can never be zero.
//
//  2. The test is interval overlap, not which reservations *start* inside the
//     window. A booking at 18:30 still holds a table at 19:00, so the 19:00
//     slot has to see it.
//
// This file holds the rules and nothing else, so the CMS Settings page — a
// client component — can import the range and the default. The Prisma read
// lives in `reservation-capacity-query.ts`.

import { durationToMs } from "./duration-units"

/** Used when no `AppSettings` row exists yet, and as the column default. */
export const DEFAULT_MAX_RESERVATIONS_PER_SLOT = 8

/** Accepted range for the CMS field and the settings API. */
export const MAX_RESERVATIONS_PER_SLOT_RANGE = { min: 1, max: 100 } as const

/** The slice of `getAppSettings()` these rules need. */
export interface ReservationCapacitySettings {
    timeSlotIncrement: number
    reservationDurationEnabled: boolean
    reservationDurationValue: number
    reservationDurationUnit: string
    maxReservationsPerSlot: number
}

export interface SlotCapacity {
    /** Concurrent reservations the slot accepts. */
    capacity: number
    /** Reservations already overlapping the slot. */
    taken: number
    /** `capacity - taken`, never negative. */
    slotsLeft: number
    available: boolean
}

/**
 * How long a reservation occupies a table, in milliseconds.
 *
 * Falls back to one slot increment when the duration is disabled, and to 30
 * minutes if the increment is nonsense. **Never returns 0** — a zero-width
 * window matches no rows and switches the capacity limit off.
 */
export function reservationDurationMs(settings: ReservationCapacitySettings): number {
    if (settings.reservationDurationEnabled) {
        const configured = durationToMs(
            settings.reservationDurationValue,
            settings.reservationDurationUnit,
        )
        if (configured > 0) return configured
    }

    const increment = Math.floor(settings.timeSlotIncrement)
    return (increment > 0 ? increment : 30) * 60 * 1000
}

/** Concurrent reservations a slot accepts, clamped to the CMS range. */
export function maxReservationsPerSlot(settings: ReservationCapacitySettings): number {
    const configured = Math.floor(settings.maxReservationsPerSlot)
    if (!Number.isFinite(configured)) return DEFAULT_MAX_RESERVATIONS_PER_SLOT
    return Math.min(
        Math.max(configured, MAX_RESERVATIONS_PER_SLOT_RANGE.min),
        MAX_RESERVATIONS_PER_SLOT_RANGE.max,
    )
}

/**
 * A Lima-local date + time as the UTC instant stored in `Reservation.date`.
 * Lima is UTC-5 with no DST. Parsing without the offset reads the *server's*
 * timezone, and the container sets TZ=UTC explicitly, so it would be five hours
 * off. The offset is written here rather than inherited from the host, because a
 * host that is not UTC would move every stored reservation instead of failing.
 */
export function limaSlotStart(date: string, time: string): Date {
    return new Date(`${date}T${time}:00-05:00`)
}

/**
 * The open instant range whose reservation starts overlap a booking at
 * `slotStart`.
 *
 * Both the new booking and each existing one occupy `durationMs`, so they
 * overlap when an existing start falls strictly inside
 * `(slotStart - durationMs, slotStart + durationMs)`. A reservation that ends
 * exactly as the slot begins does not overlap it, and neither does one that
 * begins exactly as the slot ends.
 */
export function slotOverlapWindow(
    slotStart: Date,
    durationMs: number,
): { windowStart: Date; windowEnd: Date } {
    return {
        windowStart: new Date(slotStart.getTime() - durationMs),
        windowEnd: new Date(slotStart.getTime() + durationMs),
    }
}

/** Turns a counted overlap into the answer callers return. */
export function slotCapacityFromCount(
    settings: ReservationCapacitySettings,
    taken: number,
): SlotCapacity {
    const capacity = maxReservationsPerSlot(settings)
    return {
        capacity,
        taken,
        slotsLeft: Math.max(0, capacity - taken),
        available: taken < capacity,
    }
}
