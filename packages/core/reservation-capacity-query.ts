// ══════════════════════════════════════════════════════════════════
// Reservation capacity — the Prisma read
// ══════════════════════════════════════════════════════════════════
//
// Server-only half of `reservation-capacity.ts`. The rules live there so the
// CMS Settings page, a client component, can import the range and the default
// without pulling `@wildgrove/db` into the browser bundle.

import { prisma, type Prisma } from "@wildgrove/db"
import {
    limaSlotStart,
    reservationDurationMs,
    slotCapacityFromCount,
    slotOverlapWindow,
    type ReservationCapacitySettings,
    type SlotCapacity,
} from "./reservation-capacity"

/** Statuses that hold a table. CANCELLED and COMPLETED free it. */
const OCCUPYING_STATUSES = ["PENDING", "CONFIRMED"] as const

/**
 * Capacity left in one slot, for a Lima-local date and time. The single answer
 * every caller uses.
 *
 * `excludeReservationId` skips the reservation being rescheduled, so it does
 * not count against the slot it is moving into.
 */
export async function getSlotCapacity(input: {
    settings: ReservationCapacitySettings
    date: string
    time: string
    excludeReservationId?: string
}): Promise<SlotCapacity> {
    return getSlotCapacityAt({
        settings: input.settings,
        slotStart: limaSlotStart(input.date, input.time),
        excludeReservationId: input.excludeReservationId,
    })
}

/**
 * Same answer for a slot start already converted to a UTC instant. Callers
 * that walk a whole day of slots have the instant in hand already.
 *
 * `db` is the transaction to count through. The writer holding the slot lock
 * passes its own (see `reservation-occupy.ts`); every other caller reads
 * through the shared client.
 */
export async function getSlotCapacityAt(input: {
    settings: ReservationCapacitySettings
    slotStart: Date
    excludeReservationId?: string
    db?: Prisma.TransactionClient
}): Promise<SlotCapacity> {
    const { windowStart, windowEnd } = slotOverlapWindow(
        input.slotStart,
        reservationDurationMs(input.settings),
    )

    const taken = await (input.db ?? prisma).reservation.count({
        where: {
            date: { gt: windowStart, lt: windowEnd },
            status: { in: [...OCCUPYING_STATUSES] },
            ...(input.excludeReservationId ? { NOT: { id: input.excludeReservationId } } : {}),
        },
    })

    return slotCapacityFromCount(input.settings, taken)
}
