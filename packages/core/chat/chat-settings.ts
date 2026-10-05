// ══════════════════════════════════════════════════════════════════
// The chat's settings — shared constants and validation
// No runtime imports: the CMS validates settings with this file
// without pulling in Prisma.
// ══════════════════════════════════════════════════════════════════

/**
 * off    | no chat: no bubble, and the routes that take a message refuse it
 * staff  | the first message hands the conversation to the team; no AI, no keys
 * sage   | Sage always answers; asked for a person, it gives the contact channels
 * mixed  | Sage answers and can hand the conversation to the team
 */
export const CHAT_MODES = ["off", "staff", "sage", "mixed"] as const

export type ChatMode = (typeof CHAT_MODES)[number]

/** A clone without AI keys still has a chat that works, answered from the panel. */
export const DEFAULT_CHAT_MODE: ChatMode = "staff"

export function isChatMode(value: unknown): value is ChatMode {
  return typeof value === "string" && (CHAT_MODES as readonly string[]).includes(value)
}

export function toChatMode(value: unknown): ChatMode {
  return isChatMode(value) ? value : DEFAULT_CHAT_MODE
}

/** The modes where Sage answers, and so the ones that need the AI keys. */
export function chatModeUsesSage(mode: ChatMode): boolean {
  return mode === "sage" || mode === "mixed"
}

/**
 * Dish cards in one message. The maximum is what a message may never pass.
 * The usual amount is what Sage shows when the guest does not name a number.
 * Both mirror the column defaults in schema.prisma.
 */
export const SAGE_MENU_PAGE_SIZE_RANGE = { min: 1, max: 12 } as const
export const DEFAULT_SAGE_MENU_PAGE_SIZE = 8
export const DEFAULT_SAGE_MENU_DEFAULT_COUNT = 4

function inMenuCardRange(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SAGE_MENU_PAGE_SIZE_RANGE.min &&
    value <= SAGE_MENU_PAGE_SIZE_RANGE.max
}

/** The most cards one message may hold. */
export function toSageMenuPageSize(value: unknown): number {
  return inMenuCardRange(value) ? value : DEFAULT_SAGE_MENU_PAGE_SIZE
}

/** Cards Sage shows on its own. A stored amount above the maximum is cut down to it. */
export function toSageMenuDefaultCount(value: unknown, maximum: number): number {
  const cap = toSageMenuPageSize(maximum)
  if (inMenuCardRange(value)) return Math.min(value, cap)
  return Math.min(DEFAULT_SAGE_MENU_DEFAULT_COUNT, cap)
}

/**
 * How many cards this message shows. A number the guest named wins, and
 * nothing passes the maximum. No number means the usual amount.
 */
export function dishesToShow(named: number | null, usual: number, maximum: number): number {
  const cap = toSageMenuPageSize(maximum)
  const voluntary = toSageMenuDefaultCount(usual, cap)
  if (named == null || !Number.isInteger(named) || named < 1) return voluntary
  return Math.min(named, cap)
}

/**
 * Pinned to a version, not an alias: the thresholds in
 * packages/core/chat/decide/plan-response.ts were tuned against it.
 */
export const DEFAULT_SAGE_DECISION_MODEL = "typesafe/jev-1.13"

/** The env var the decision model's fallback key lives in. The primary is OPENROUTER_API_KEY. */
export const TYPESAFE_API_KEY_ENV = "TYPESAFE_API_KEY"
export const OPENROUTER_API_KEY_ENV = "OPENROUTER_API_KEY"

/** What the storefront reports about the keys and the decision model, yes or no only. */
export type ChatStatus = {
  /** The key of the provider the panel has selected for Sage's writer. */
  writerKey: boolean
  /** The same, for every provider, so a change of provider can be checked before it is saved. */
  writerKeys: { openai: boolean; openrouter: boolean; custom: boolean }
  decisionKeys: { openrouter: boolean; typesafe: boolean }
  lastDecision: { at: string; via: string } | null
  lastFailure: { at: string; reason: string } | null
}
