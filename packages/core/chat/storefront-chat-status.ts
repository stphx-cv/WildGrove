// ══════════════════════════════════════════════════════════════════
// The panel's view of the storefront's chat keys
// The panel holds no AI key. It asks the storefront, with the same shared
// secret as the cache ping, and gets only yes or no for each key.
// ══════════════════════════════════════════════════════════════════

import { storefrontRevalidateSecret } from "../revalidate-storefront"
import { siteUrl } from "../urls"
import type { ChatStatus } from "./chat-settings"

/** The storefront's answer, or null when it cannot be asked or does not answer. */
export async function fetchStorefrontChatStatus(): Promise<ChatStatus | null> {
  const secret = storefrontRevalidateSecret()
  if (!secret) return null

  try {
    const res = await fetch(`${siteUrl()}/api/chat/status`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      console.error("[chat-status] storefront answered", res.status)
      return null
    }
    const json = (await res.json()) as { success?: boolean; data?: ChatStatus }
    return json.success && json.data ? json.data : null
  } catch (error) {
    console.error("[chat-status]", error)
    return null
  }
}
