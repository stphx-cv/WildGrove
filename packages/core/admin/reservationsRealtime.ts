// ══════════════════════════════════════════════════════════════════
// Admin reservations — InsForge broadcast helpers (server-only)
// ══════════════════════════════════════════════════════════════════

import { createServiceClient } from '../clients/admin'
import {
  ADMIN_RESERVATIONS_LIST_CHANNEL,
  ADMIN_RESERVATION_CREATED_EVENT,
  ADMIN_RESERVATION_UPDATED_EVENT,
  adminReservationDetailChannel,
  type AdminReservationRealtimePayload,
} from "./reservationsRealtimeShared"

function getInsforgeAdmin() {
  return createServiceClient()
}

async function sendBroadcast(
  channelName: string,
  event: string,
  payload: AdminReservationRealtimePayload,
) {
  const result = await getInsforgeAdmin().channel(channelName).send({
    type: "broadcast",
    event,
    payload,
  })
  if (result !== "ok") {
    console.warn(`[reservationsRealtime] ${event} on ${channelName} returned`, result)
  }
}

/** New reservation in the queue — refresh sidebar badge and list. */
export async function broadcastAdminReservationCreated(reservationId: string) {
  const payload: AdminReservationRealtimePayload = { reservationId }
  await Promise.allSettled([
    sendBroadcast(ADMIN_RESERVATIONS_LIST_CHANNEL, ADMIN_RESERVATION_CREATED_EVENT, payload),
    sendBroadcast(
      adminReservationDetailChannel(reservationId),
      ADMIN_RESERVATION_CREATED_EVENT,
      payload,
    ),
  ])
}

/** Customer or admin updated a reservation — refresh detail + badges. */
export async function broadcastAdminReservationUpdated(reservationId: string) {
  const payload: AdminReservationRealtimePayload = { reservationId }
  await Promise.allSettled([
    sendBroadcast(ADMIN_RESERVATIONS_LIST_CHANNEL, ADMIN_RESERVATION_UPDATED_EVENT, payload),
    sendBroadcast(
      adminReservationDetailChannel(reservationId),
      ADMIN_RESERVATION_UPDATED_EVENT,
      payload,
    ),
  ])
}
