// ══════════════════════════════════════════════════════════════════
// Sage AI | The next page of a menu shown in the chat
// A Sage message with dish cards keeps its whole list in metadata.menu.
// "See N more" and a follow-up like "is that all?" both bring the next
// page from here, and mark the message they continue so its button goes.
// ══════════════════════════════════════════════════════════════════

import { prisma, type Prisma } from "@wildgrove/db"
import { menuRemaining, readMenuMeta, type SageMenuMeta } from "./client-message"
import { loadMenuCards, type MenuCard } from "./menu-cards"

export type NextMenuPage =
  | { status: "ok"; cards: MenuCard[]; menu: SageMenuMeta; remaining: number }
  /** The message has no list, or nothing left to show. */
  | { status: "nothing" }
  /** Another request continued it first. */
  | { status: "taken" }

/** The ids of the next page and how many the list has shown after it. Pure. */
export function nextPageOf(menu: SageMenuMeta, pageSize: number): { pageIds: string[]; shown: number } {
  const pageIds = menu.ids.slice(menu.shown, menu.shown + pageSize)
  return { pageIds, shown: menu.shown + pageIds.length }
}

/**
 * Continue the menu of one Sage message of a session. The message is marked
 * as continued in the same write that checks it was not, so two clicks never
 * bring the same page twice. Dishes unpublished since the list was saved are
 * skipped.
 */
export async function continueMenu(
  sessionId: string,
  messageId: string,
  pageSize: number,
  language: "en" | "es",
): Promise<NextMenuPage> {
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, sessionId, role: "ASSISTANT" },
    select: { id: true, metadata: true },
  })
  const menu = message ? readMenuMeta(message.metadata) : null
  if (!message || !menu || menu.continued || menuRemaining(menu) === 0) return { status: "nothing" }

  const original = message.metadata as Prisma.InputJsonObject
  const claimed = await prisma.chatMessage.updateMany({
    where: { id: message.id, metadata: { equals: original } },
    data: { metadata: { ...original, menu: { ...menu, continued: true } } },
  })
  if (claimed.count === 0) return { status: "taken" }

  const { pageIds, shown } = nextPageOf(menu, pageSize)
  const cards = await loadMenuCards(pageIds, language)
  const next: SageMenuMeta = { ids: menu.ids, shown }
  return { status: "ok", cards, menu: next, remaining: menuRemaining(next) }
}

/**
 * The newest Sage message of a session with a menu list, the one the guest is
 * looking at, and whether it still has dishes to show. Null when the recent
 * conversation showed no menu.
 */
export async function findLatestMenu(
  sessionId: string,
): Promise<{ id: string; menu: SageMenuMeta; continuable: boolean } | null> {
  const recent = await prisma.chatMessage.findMany({
    where: { sessionId, role: "ASSISTANT" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, metadata: true },
  })
  for (const message of recent) {
    const menu = readMenuMeta(message.metadata)
    if (menu) return { id: message.id, menu, continuable: !menu.continued && menuRemaining(menu) > 0 }
  }
  return null
}

/** The sentence over a page brought by "See N more". */
export function menuMoreText(shownNow: number, remainingAfter: number, language: "en" | "es"): string {
  if (language === "es") {
    if (shownNow === 0) return "Esos platos ya no están disponibles."
    if (remainingAfter > 0) return shownNow === 1 ? "Aquí tienes 1 plato más." : `Aquí tienes ${shownNow} platos más.`
    return shownNow === 1 ? "Este es el último." : `Estos son los últimos ${shownNow}.`
  }
  if (shownNow === 0) return "Those dishes are no longer available."
  if (remainingAfter > 0) return shownNow === 1 ? "Here is 1 more dish." : `Here are ${shownNow} more dishes.`
  return shownNow === 1 ? "This is the last one." : `These are the last ${shownNow}.`
}
