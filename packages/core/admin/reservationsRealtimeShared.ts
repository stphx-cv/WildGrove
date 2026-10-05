// ══════════════════════════════════════════════════════════════════
// Admin reservations — InsForge Realtime constants (client-safe)
// ══════════════════════════════════════════════════════════════════

export const ADMIN_RESERVATIONS_LIST_CHANNEL = "admin:reservations" as const

export const ADMIN_RESERVATION_CREATED_EVENT = "reservation-created" as const
export const ADMIN_RESERVATION_UPDATED_EVENT = "reservation-updated" as const

export function adminReservationDetailChannel(reservationId: string) {
  return `admin:reservation:${reservationId}`
}

export type AdminReservationRealtimePayload = {
  reservationId: string
}
