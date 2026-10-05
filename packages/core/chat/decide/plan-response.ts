// ══════════════════════════════════════════════════════════════════
// Sage AI | From the decision model's answers to the steps of a reply
// A pure function: the same answers always give the same steps, so the
// evaluation in scripts/sage-decisions-eval/ replays it without the
// server. The thresholds below were set by that evaluation against the
// pinned model version; a new version means running it again.
// ══════════════════════════════════════════════════════════════════

import type { ChatMode } from "../chat-settings"
import type { JevAnswer, JevChoiceAnswer } from "./jev-client"
import {
  INTENTS,
  MENU_COUNT_MAX,
  MENU_SCOPES,
  OFF_TOPIC_QUESTION_ID,
  REQUEST_INTENTS,
  dishQuestionId,
  wantsQuestionId,
  type Intent,
  type MenuScope,
  type RequestIntent,
} from "./questions"

/** A yes at or above this counts as asked for. */
export const WANT_THRESHOLD = 0.5
/** A dish at or above this fits what the guest asked for. */
export const DISH_THRESHOLD = 0.5
/** A yes at or above this, with nothing else asked, is refused. */
export const OFF_TOPIC_THRESHOLD = 0.5
/** The explicit order is trusted at or above this. */
export const ORDER_THRESHOLD = 0.5
/** How many of the likeliest intents the tie-break gets tools for. */
export const TIEBREAK_CANDIDATES = 3

/** Resolved at once, with data: these go first. */
const IMMEDIATE: readonly RequestIntent[] = ["menu", "dish", "my_bookings", "promotions", "info"]
/** They go on over the next messages: these go last. */
const CONVERSATIONAL: readonly RequestIntent[] = ["book", "human"]

export type Step =
  | { kind: "menu"; scope: MenuScope; dishIds: string[]; /** Dishes they asked to see, or null when they named no number. */ limit: number | null }
  | { kind: "dish"; dishId: string | null }
  | { kind: "book" }
  | { kind: "my_bookings" }
  | { kind: "promotions" }
  | { kind: "info" }
  /** With a team behind Sage the guest is handed over; without one, given the contact channels. */
  | { kind: "human"; handover: boolean }
  | { kind: "greeting" }
  /** Only something unrelated to Wild Grove: a fixed refusal, with no writer. */
  | { kind: "decline" }
  /** Nothing clear, or two things that both go on over the next messages. */
  | { kind: "tiebreak"; candidates: Intent[] }
  /** The decision model did not answer. */
  | { kind: "apology" }

export type PlanReason =
  | "jev_failed"
  | "single"
  | "several_ordered"
  | "several_default_order"
  | "two_conversational"
  | "nothing_clear"
  | "off_topic"

export type ResponsePlan = {
  steps: Step[]
  reason: PlanReason
  /** The yes of every intent, for the record. */
  wants: Partial<Record<RequestIntent, number>>
  /** Dishes at or above the threshold, likeliest first. */
  matchingDishes: { id: string; p: number }[]
  /** How many dishes they asked to see. Null when the message names no number. */
  menuLimit: number | null
}

export type PlanInput = {
  answers: Record<string, JevAnswer> | null
  /** The dishes the questions asked about, in the same order. */
  dishes: readonly { id: string }[]
  mode: ChatMode
}

function noul(answers: Record<string, JevAnswer>, id: string): number {
  const answer = answers[id]
  return answer?.type === "noul" ? answer.noul : 0
}

function choice(answers: Record<string, JevAnswer>, id: string): JevChoiceAnswer | null {
  const answer = answers[id]
  return answer?.type === "choice" ? answer : null
}

/** The label of a step in the evaluation and the panel: "menu:filtered", "book". */
export function stepLabel(step: Step): string {
  return step.kind === "menu" ? `menu:${step.scope}` : step.kind
}

/** The number of dishes they asked to see, when that answer clears the threshold. */
export function menuLimitFrom(answers: Record<string, JevAnswer> | null): number | null {
  if (!answers) return null
  const answer = choice(answers, "menu_count")
  if (!answer || answer.choice === "none") return null
  const named = Number(answer.choice)
  if (!Number.isInteger(named) || named < 1 || named > MENU_COUNT_MAX) return null
  if ((answer.probabilities[answer.choice] ?? 0) < WANT_THRESHOLD) return null
  return named
}

export function planResponse(input: PlanInput): ResponsePlan {
  const { answers, dishes, mode } = input
  if (!answers) return { steps: [{ kind: "apology" }], reason: "jev_failed", wants: {}, matchingDishes: [], menuLimit: null }

  const menuLimit = menuLimitFrom(answers)

  const wants: Partial<Record<RequestIntent, number>> = {}
  for (const intent of REQUEST_INTENTS) wants[intent] = noul(answers, wantsQuestionId(intent))

  const matchingDishes = dishes
    .map((dish, index) => ({ id: dish.id, p: noul(answers, dishQuestionId(index)) }))
    .filter((dish) => dish.p >= DISH_THRESHOLD)
    .sort((a, b) => b.p - a.p)

  let asked = REQUEST_INTENTS.filter((intent) => (wants[intent] ?? 0) >= WANT_THRESHOLD)
  // A greeting beside a stronger request is part of that request. When the
  // greeting itself is the strongest yes, the other yeses are noise on a
  // greeting (a misspelled "hola") and the reply is only the greeting.
  if (asked.includes("greeting") && asked.length > 1) {
    const greeting = wants.greeting ?? 0
    const others = asked.filter((intent) => intent !== "greeting")
    const strongestOther = Math.max(...others.map((intent) => wants[intent] ?? 0))
    asked = greeting > strongestOther ? ["greeting"] : others
  }

  const scopeAnswer = choice(answers, "menu_scope")
  const scope: MenuScope =
    scopeAnswer && (MENU_SCOPES as readonly string[]).includes(scopeAnswer.choice) ? (scopeAnswer.choice as MenuScope) : "full"

  // A named dish asked about as a menu question ("do you have lomo saltado?")
  // is one question about one dish, not a list.
  if (asked.includes("menu") && asked.includes("dish") && scope === "filtered" && matchingDishes.length <= 1) {
    asked = asked.filter((intent) => intent !== "menu")
  }

  const intentAnswer = choice(answers, "intent")
  const likeliest = (intentAnswer
    ? INTENTS.filter((intent) => intent !== "other").sort(
        (a, b) => (intentAnswer.probabilities[b] ?? 0) - (intentAnswer.probabilities[a] ?? 0),
      )
    : []
  ).slice(0, TIEBREAK_CANDIDATES)

  // Something unrelated, with nothing about the restaurant beside it. A
  // message that also asks for something of the restaurant gets that, and
  // the system prompt's rule covers the unrelated part.
  if (asked.length === 0 && noul(answers, OFF_TOPIC_QUESTION_ID) >= OFF_TOPIC_THRESHOLD) {
    return { steps: [{ kind: "decline" }], reason: "off_topic", wants, matchingDishes, menuLimit }
  }

  if (asked.length === 0) {
    return { steps: [{ kind: "tiebreak", candidates: likeliest }], reason: "nothing_clear", wants, matchingDishes, menuLimit }
  }

  const conversational = asked.filter((intent) => CONVERSATIONAL.includes(intent))
  if (conversational.length >= 2) {
    return { steps: [{ kind: "tiebreak", candidates: conversational }], reason: "two_conversational", wants, matchingDishes, menuLimit }
  }

  // Resolved-at-once first, then what goes on over the next messages; an
  // explicit order from the guest moves its request to the front.
  const byDefault = [...IMMEDIATE, "greeting" as const, ...CONVERSATIONAL].filter((intent) => asked.includes(intent))
  const orderAnswer = choice(answers, "order")
  const first =
    asked.length > 1 &&
    orderAnswer &&
    asked.includes(orderAnswer.choice as RequestIntent) &&
    (orderAnswer.probabilities[orderAnswer.choice] ?? 0) >= ORDER_THRESHOLD
      ? (orderAnswer.choice as RequestIntent)
      : null
  const ordered = first ? [first, ...byDefault.filter((intent) => intent !== first)] : byDefault

  const steps = ordered.map((intent): Step => {
    switch (intent) {
      case "menu":
        return {
          kind: "menu",
          scope,
          dishIds: scope === "filtered" ? matchingDishes.map((dish) => dish.id) : [],
          limit: menuLimit,
        }
      case "dish":
        return { kind: "dish", dishId: matchingDishes[0]?.id ?? null }
      case "human":
        return { kind: "human", handover: mode === "mixed" }
      default:
        return { kind: intent }
    }
  })

  return {
    steps,
    reason: asked.length === 1 ? "single" : first ? "several_ordered" : "several_default_order",
    wants,
    matchingDishes,
    menuLimit,
  }
}
