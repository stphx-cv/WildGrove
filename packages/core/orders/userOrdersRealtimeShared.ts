// ══════════════════════════════════════════════════════════════════
// User orders — InsForge Realtime (shared constants, safe for client)
// ══════════════════════════════════════════════════════════════════

export const USER_ORDERS_REALTIME_EVENT = "order-status" as const

export interface UserOrderStatusPayload {
  orderId: string
  status: string
}

export function userOrdersChannelName(profileId: string) {
  return `user:orders:${profileId}`
}
