// ══════════════════════════════════════════════════════════════════
// Sage AI | What the decision model reads
// The state is the customer's message and the conversation before it,
// reduced to what a question needs: text without JSON blocks, cut short,
// and for Sage's replies what they did (which dishes they showed, whether
// they opened the reservation form, and whether the customer closed it).
// Jev reads numbers, image URLs and prices poorly, and loses precision
// with text no question needs.
// ══════════════════════════════════════════════════════════════════

import type { ChatMessage } from "@wildgrove/db"
import { menuRemaining, readMenuMeta } from "../client-message"
import { menuBlockNames, stripStructuredBlocks } from "../message-blocks"

/** Messages of the conversation the model reads. Chosen by the evaluation in scripts/sage-decisions-eval/. */
export const DECISION_HISTORY_WINDOW = 10

/** Characters kept of each message. */
export const DECISION_TEXT_LIMIT = 300

export type JevTurn = {
  from: "customer" | "sage" | "staff"
  text: string
  /** Dish names Sage showed as cards in this message. */
  shownDishes?: string[]
  /** Dishes of that list Sage had not shown yet. */
  moreDishes?: number
  openedReservationForm?: boolean
  /** The customer closed that form themselves. No reservation was created. */
  closedReservationForm?: boolean
}

export type JevState = {
  current_message: string
  conversation: { from: JevTurn["from"]; text: string; did?: string }[]
  topic?: string
}

function cut(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > DECISION_TEXT_LIMIT ? `${clean.slice(0, DECISION_TEXT_LIMIT - 1)}…` : clean
}

/** What a Sage message did, in words. */
function describeActions(turn: JevTurn): string | undefined {
  const parts: string[] = []
  if (turn.shownDishes && turn.shownDishes.length > 0) {
    // Numbered, so "the second one" has something to point at.
    parts.push(`showed dish cards: ${turn.shownDishes.map((name, i) => `${i + 1}. ${name}`).join("; ")}`)
    if (turn.moreDishes && turn.moreDishes > 0) {
      parts.push(`${turn.moreDishes} more dishes of that list not shown yet`)
    }
  }
  if (turn.closedReservationForm) {
    parts.push("opened the reservation form; the customer closed it themselves and no reservation was created")
  } else if (turn.openedReservationForm) {
    parts.push("opened the reservation form")
  }
  return parts.length > 0 ? parts.join("; ") : undefined
}

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  return metadata as Record<string, unknown>
}

/**
 * The latest time Sage opened the reservation form, and whether the customer
 * then closed it. History is oldest first. A later opening replaces an older close.
 */
export function latestReservationFormClosed(
  rows: readonly Pick<ChatMessage, "role" | "metadata">[],
): boolean {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    if (row.role !== "ASSISTANT") continue
    const metadata = metadataRecord(row.metadata)
    if (metadata?.reservationForm !== true) continue
    return metadata.reservationFormDismissed === true
  }
  return false
}

export function buildJevState(input: {
  currentMessage: string
  turns: readonly JevTurn[]
  topic?: string | null
  window?: number
}): JevState {
  const window = input.window ?? DECISION_HISTORY_WINDOW
  const recent = window > 0 ? input.turns.slice(-window) : []
  return {
    current_message: cut(input.currentMessage),
    conversation: recent.map((turn) => {
      const did = turn.from === "sage" ? describeActions(turn) : undefined
      return { from: turn.from, text: cut(turn.text), ...(did && { did }) }
    }),
    ...(input.topic?.trim() && { topic: cut(input.topic) }),
  }
}

/**
 * Chat rows, oldest first, as turns. System notices are left out; a staff
 * member's messages are kept, since a person may have been in the middle.
 */
export function turnsFromMessages(
  rows: readonly Pick<ChatMessage, "role" | "content" | "metadata">[],
  language: "en" | "es",
): JevTurn[] {
  const turns: JevTurn[] = []
  for (const row of rows) {
    if (row.role === "SYSTEM") continue
    if (row.role === "USER") {
      turns.push({ from: "customer", text: row.content })
      continue
    }
    if (row.role === "AGENT") {
      turns.push({ from: "staff", text: row.content })
      continue
    }
    const menu = readMenuMeta(row.metadata)
    const shownDishes = menuBlockNames(row.content, language)
    const metadata = metadataRecord(row.metadata) ?? {}
    const openedReservationForm = metadata.reservationForm === true
    const closedReservationForm = openedReservationForm && metadata.reservationFormDismissed === true
    turns.push({
      from: "sage",
      text: stripStructuredBlocks(row.content),
      ...(shownDishes.length > 0 && { shownDishes }),
      // Once continued, the rest came in a later message, which says so itself.
      ...(menu && !menu.continued && menuRemaining(menu) > 0 && { moreDishes: menuRemaining(menu) }),
      ...(openedReservationForm && { openedReservationForm: true }),
      ...(closedReservationForm && { closedReservationForm: true }),
    })
  }
  return turns
}
