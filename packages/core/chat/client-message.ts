// ══════════════════════════════════════════════════════════════════
// Sage AI | What the storefront receives for a chat message
// A ChatMessage row carries its session id and a metadata field with
// Sage's decisions and the full list behind a paged menu. None of that
// is for the customer's browser, so every storefront route answers with
// this shape instead of the row.
// ══════════════════════════════════════════════════════════════════

import type { ChatMessage } from "@wildgrove/db"
import { stripShownDishAside } from "./message-blocks"

/** The dishes behind a message with menu cards: every id in order, and how many it showed. */
export type SageMenuMeta = {
  ids: string[]
  shown: number
  /** Set once "See more" or a follow-up question brought the next page. */
  continued?: boolean
}

export type ClientChatMessage = {
  id: string
  role: ChatMessage["role"]
  content: string
  tier: ChatMessage["tier"]
  createdAt: Date
  /** Present while the message's menu has dishes it did not show yet. */
  menuMore?: { remaining: number }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** The menu list of a message's metadata, or null when it has none or it is malformed. */
export function readMenuMeta(metadata: unknown): SageMenuMeta | null {
  if (!isRecord(metadata) || !isRecord(metadata.menu)) return null
  const { ids, shown, continued } = metadata.menu
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null
  if (typeof shown !== "number" || !Number.isInteger(shown) || shown < 0) return null
  return { ids, shown: Math.min(shown, ids.length), ...(continued === true && { continued: true }) }
}

/** Dishes of the list the message has not shown. */
export function menuRemaining(menu: SageMenuMeta): number {
  return Math.max(0, menu.ids.length - menu.shown)
}

export function toClientMessage(
  row: Pick<ChatMessage, "id" | "role" | "content" | "tier" | "createdAt" | "metadata">,
): ClientChatMessage {
  const menu = readMenuMeta(row.metadata)
  const remaining = menu && !menu.continued ? menuRemaining(menu) : 0
  return {
    id: row.id,
    role: row.role,
    content: stripShownDishAside(row.content),
    tier: row.tier,
    createdAt: row.createdAt,
    ...(remaining > 0 && { menuMore: { remaining } }),
  }
}
