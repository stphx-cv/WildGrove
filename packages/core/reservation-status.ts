// ══════════════════════════════════════════════════════════════════
// The status changes an admin can make to a reservation.
//
// The panel's reservation page offers these and the admin API route
// enforces them, so both read this one table. A cancelled reservation can
// be reopened; a completed one is final.
// ══════════════════════════════════════════════════════════════════

export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"

export const RESERVATION_STATUS_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["COMPLETED", "CANCELLED"],
    CANCELLED: ["PENDING"],
    COMPLETED: [],
}

/** The statuses a reservation can move to from `status`, not counting staying put. */
export function nextReservationStatuses(status: string): readonly ReservationStatus[] {
    return RESERVATION_STATUS_TRANSITIONS[status as ReservationStatus] ?? []
}

export function canChangeReservationStatus(from: string, to: string): boolean {
    return nextReservationStatuses(from).includes(to as ReservationStatus)
}
