// ══════════════════════════════════════════════════════════════════
// Realtime: push order status updates to the customer's browser
// (InsForge broadcast — same pattern as admin notifications / tickets)
// ══════════════════════════════════════════════════════════════════

import { createServiceClient } from '../clients/admin'
import {
  USER_ORDERS_REALTIME_EVENT,
  userOrdersChannelName,
  type UserOrderStatusPayload,
} from "./userOrdersRealtimeShared"

function getInsforgeAdmin() {
  return createServiceClient()
}

/** Fire-and-forget from OrderService; errors are logged only in debug scenarios */
export async function broadcastUserOrderStatus(
  profileId: string,
  payload: UserOrderStatusPayload,
) {
  const insforge = getInsforgeAdmin()
  const result = await insforge.channel(userOrdersChannelName(profileId)).send({
    type: "broadcast",
    event: USER_ORDERS_REALTIME_EVENT,
    payload,
  })
  if (result !== "ok") {
    console.warn("[broadcastUserOrderStatus] send returned", result, payload.orderId)
  }
}
