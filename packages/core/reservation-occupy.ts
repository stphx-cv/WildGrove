// ══════════════════════════════════════════════════════════════════
// Reservation capacity — writing into a slot
// ══════════════════════════════════════════════════════════════════
//
// Every write that puts a reservation into a slot goes through
// `occupyReservationSlot`: a new booking from the form, the chat form or Sage,
// and a customer or staff member moving one. Counting the slot and writing the
// row are two statements, and two requests that both count before either
// writes would both see the last free table. The count and the write therefore
// run inside one transaction that first takes a PostgreSQL advisory lock, so a
// second writer waits until the first has committed and then counts again.
//
// One lock key for every reservation, not one per day or per slot. The overlap
// window is `reservationDuration`, which can be longer than a day, so two
// bookings on different dates can compete for the same tables. Reservations
// arrive a few per minute; queueing them costs nothing noticeable.
//
// The count goes through the transaction, never through the shared client.
// Each process opens 2 connections by default: if the transaction holding the
// lock asked the shared client for the count, it would need a second
// connection while another request holds that one waiting for the lock, and
// neither would move.
//
// For the same reason, writers inside one process take turns before they open
// the transaction. A request waiting for the lock holds a connection the whole
// time, so two of them in one process would leave a third request, of any
// kind, with no connection to start from; Prisma gives up on starting a
// transaction after 2 seconds. With the in-process turn, each process has at
// most one connection waiting on the lock, and the other one stays free.
//
// The transaction waits at most 5 seconds for a connection and lives at most
// 15. Inside it, PostgreSQL gives up waiting for the lock after 10 seconds,
// before Prisma would roll the transaction back under it, and a writer that
// could not get its turn in time is answered as busy instead of failing.
//
// Cancelling frees a table and does not come through here.

import { prisma, type Prisma } from "@wildgrove/db"
import { getSlotCapacityAt } from "./reservation-capacity-query"
import type { ReservationCapacitySettings, SlotCapacity } from "./reservation-capacity"

/** Advisory lock key shared by every reservation write ("WGRS"). */
const RESERVATION_SLOT_LOCK_KEY = 0x57475253

// Kept on globalThis so every route bundle in the process shares one queue,
// as the Prisma client does.
const globalForSlot = globalThis as unknown as { reservationSlotTurn?: Promise<unknown> }

/** Runs `run` after every earlier writer in this process has finished. */
function inProcessTurn<T>(run: () => Promise<T>): Promise<T> {
    const previous = globalForSlot.reservationSlotTurn ?? Promise.resolve()
    const turn = previous.then(run, run)
    globalForSlot.reservationSlotTurn = turn.catch(() => undefined)
    return turn
}

export type OccupySlotResult<T> =
    | { occupied: true; value: T }
    | { occupied: false; capacity: SlotCapacity }
    | { occupied: false; busy: true }

/**
 * PostgreSQL's lock_timeout (55P03), or Prisma giving up on the transaction
 * (P2028): the lock stayed taken for longer than a request should wait.
 */
function isSlotLockTimeout(error: unknown): boolean {
    if (!error || typeof error !== "object") return false
    const e = error as { code?: unknown; meta?: { code?: unknown }; message?: unknown }
    if (e.code === "P2028" || e.meta?.code === "55P03") return true
    return typeof e.message === "string" && /lock timeout/i.test(e.message)
}

/**
 * Counts the slot and, if a table is left, runs `write` in the same
 * transaction, under the reservation lock. When the slot is full nothing is
 * written and the caller answers with its usual "fully booked" response,
 * which is also the answer when the lock could not be had in time (`busy`).
 *
 * `excludeReservationId` is the reservation being moved, so it does not count
 * against the slot it moves into.
 */
export async function occupyReservationSlot<T>(input: {
    settings: ReservationCapacitySettings
    slotStart: Date
    excludeReservationId?: string
    write: (tx: Prisma.TransactionClient) => Promise<T>
}): Promise<OccupySlotResult<T>> {
    return inProcessTurn(() => prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`
        // Released by PostgreSQL when this transaction commits or rolls back.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RESERVATION_SLOT_LOCK_KEY}::bigint)`

        const capacity = await getSlotCapacityAt({
            settings: input.settings,
            slotStart: input.slotStart,
            excludeReservationId: input.excludeReservationId,
            db: tx,
        })
        if (!capacity.available) return { occupied: false as const, capacity }

        return { occupied: true as const, value: await input.write(tx) }
    }, { maxWait: 5000, timeout: 15000 }).catch((error: unknown): OccupySlotResult<T> => {
        if (isSlotLockTimeout(error)) return { occupied: false, busy: true }
        throw error
    }))
}
