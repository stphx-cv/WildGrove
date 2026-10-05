// ══════════════════════════════════════════════════════════════════
// Sage AI | The parts of a reply the code runs
// The decision model's steps go through here before the writer: the menu
// and a dish are loaded and paged by the code, from the database. After
// the writer, the blocks are put together in the order of the steps and
// the decision is kept in the message's metadata for the panel, never for
// the customer's browser.
// ══════════════════════════════════════════════════════════════════

import type { Prisma } from "@wildgrove/db"
import type { SageMenuMeta } from "./client-message"
import type { JevResult } from "./decide/jev-client"
import type { ResponsePlan } from "./decide/plan-response"
import { stepLabel } from "./decide/plan-response"
import { OFF_TOPIC_QUESTION_ID, type DecisionDish } from "./decide/questions"
import { loadMenuCards, type MenuCard } from "./menu-cards"
import { continueMenu, findLatestMenu } from "./menu-pages"
import { structuredBlock } from "./message-blocks"
import { dishesToShow } from "./chat-settings"
import type { StepOutcome } from "./step-briefs"

export type CodeSteps = {
  outcomes: StepOutcome[]
  /** Every card of the reply, menu and dish, in step order and without repeats. */
  cards: MenuCard[]
  /** The list behind the cards, for "See N more". */
  menu: SageMenuMeta | null
  /** The message whose list this reply continued; its button goes. */
  continuedFrom: string | null
}

function cardName(card: MenuCard, language: "en" | "es"): string {
  return language === "es" && card.nameEs ? card.nameEs : card.name
}

/**
 * Run the steps that belong to the code. `dishes` are the dishes the
 * decision model was asked about, on sale and in menu order.
 */
export async function runCodeSteps(
  plan: ResponsePlan,
  ctx: {
    sessionId: string
    dishes: readonly DecisionDish[]
    language: "en" | "es"
    /** The page's language, which the card links follow. */
    menuLocale: "en" | "es"
    /** Cards when the guest names no number. */
    usualCount: number
    /** The most cards one message may hold. */
    maxCount: number
    intentProbabilities: Record<string, number>
  },
): Promise<CodeSteps> {
  const outcomes: StepOutcome[] = []
  const cards: MenuCard[] = []
  let menu: SageMenuMeta | null = null
  let continuedFrom: string | null = null
  const addCards = (more: MenuCard[]) => {
    for (const card of more) if (!cards.some((c) => c.id === card.id)) cards.push(card)
  }

  for (const step of plan.steps) {
    switch (step.kind) {
      case "menu": {
        const take = dishesToShow(step.limit, ctx.usualCount, ctx.maxCount)
        if (step.scope === "more") {
          const latest = await findLatestMenu(ctx.sessionId)
          if (latest?.continuable) {
            const page = await continueMenu(ctx.sessionId, latest.id, take, ctx.menuLocale)
            if (page.status === "ok") {
              addCards(page.cards)
              menu = page.menu
              continuedFrom = latest.id
              outcomes.push({
                step: "menu",
                view: "list",
                page: "next",
                filtered: false,
                names: page.cards.map((card) => cardName(card, ctx.language)),
                total: page.menu.ids.length,
                remaining: page.remaining,
              })
              break
            }
          }
          if (latest) {
            outcomes.push({ step: "menu", view: "spent", total: latest.menu.ids.length })
            break
          }
          // Nothing shown before: "more" of nothing is the whole menu.
        }
        const filtered = step.scope === "filtered"
        const ids = filtered ? step.dishIds : ctx.dishes.map((dish) => dish.id)
        if (ids.length === 0) {
          outcomes.push({ step: "menu", view: "none", reason: filtered ? "filter" : "empty" })
          break
        }
        const pageIds = ids.slice(0, take)
        const pageCards = await loadMenuCards(pageIds, ctx.menuLocale)
        addCards(pageCards)
        menu = { ids, shown: pageIds.length }
        outcomes.push({
          step: "menu",
          view: "list",
          page: "first",
          filtered,
          names: pageCards.map((card) => cardName(card, ctx.language)),
          total: ids.length,
          remaining: ids.length - pageIds.length,
        })
        break
      }
      case "dish": {
        const dish = step.dishId ? ctx.dishes.find((d) => d.id === step.dishId) : undefined
        const [card] = dish ? await loadMenuCards([dish.id], ctx.menuLocale) : []
        if (!dish || !card) {
          outcomes.push({ step: "dish", dish: null })
          break
        }
        addCards([card])
        const es = ctx.language === "es"
        outcomes.push({
          step: "dish",
          dish: {
            name: es ? dish.nameEs : dish.nameEn,
            description: es ? dish.descriptionEs : dish.descriptionEn,
            tags: es && dish.tagsEs.length > 0 ? dish.tagsEs : dish.tagsEn,
            ingredients: card.ingredients ?? null,
          },
        })
        break
      }
      case "tiebreak":
        outcomes.push({ step: "tiebreak", candidates: step.candidates, probabilities: ctx.intentProbabilities })
        break
      case "human":
        outcomes.push({ step: "human", handover: step.handover })
        break
      default:
        outcomes.push({ step: step.kind })
    }
  }

  return { outcomes, cards, menu, continuedFrom }
}

/**
 * The blocks after the text, in the order of the steps: the cards where the
 * first step that shows dishes goes, the reservations where their step goes.
 */
export function composeBlocks(
  outcomes: readonly StepOutcome[],
  cards: readonly MenuCard[],
  reservations: unknown[] | null,
): string[] {
  const blocks: string[] = []
  let cardsPlaced = false
  let reservationsPlaced = false
  const placeCards = () => {
    if (!cardsPlaced && cards.length > 0) blocks.push(structuredBlock("menu-items", cards))
    cardsPlaced = true
  }
  const placeReservations = () => {
    if (!reservationsPlaced && reservations && reservations.length > 0) blocks.push(structuredBlock("reservation-list", reservations))
    reservationsPlaced = true
  }
  for (const outcome of outcomes) {
    if (outcome.step === "menu" || outcome.step === "dish") placeCards()
    if (outcome.step === "my_bookings") placeReservations()
    if (outcome.step === "tiebreak") {
      placeCards()
      placeReservations()
    }
  }
  placeCards()
  placeReservations()
  return blocks
}

const round = (p: number) => Math.round(p * 100) / 100

function roundedProbabilities(probabilities: Record<string, number> | undefined): Record<string, number> {
  return Object.fromEntries(Object.entries(probabilities ?? {}).map(([key, p]) => [key, round(p)]))
}

/** Dishes kept with their probability in the record; the rest only counted. */
const DISHES_KEPT = 15

/**
 * What the decision model answered and what the rules did with it, for the
 * panel's technical details and for GET /api/chat/status.
 */
export function decisionMetadata(input: {
  jev: JevResult
  plan: ResponsePlan
  dishes: readonly DecisionDish[]
  requestedModel: string
  window: number
  /** The language the reply was actually written in, after a loose greeting. */
  replyLanguage: "en" | "es" | "other"
  /** Where that language came from: greeting, message, conversation or page. */
  replyLanguageFrom: "greeting" | "message" | "conversation" | "page"
}): Prisma.InputJsonObject {
  const { jev, plan, dishes } = input
  const failedAttempt = jev.attempts.some((attempt) => !attempt.ok)
  const base = {
    model: jev.ok ? jev.model : input.requestedModel,
    via: jev.ok ? jev.via : null,
    status: !jev.ok ? "failed" : failedAttempt ? "fallback" : "ok",
    ms: jev.ms,
    attempts: jev.attempts.map((attempt) => ({ ...attempt })),
    steps: plan.steps.map(stepLabel),
    reason: plan.reason,
    window: input.window,
    replyLanguage: input.replyLanguage,
    replyLanguageFrom: input.replyLanguageFrom,
  }
  if (!jev.ok) return base

  const choice = (id: string) => {
    const answer = jev.answers[id]
    return answer?.type === "choice" ? { choice: answer.choice, probabilities: roundedProbabilities(answer.probabilities) } : null
  }
  const scored = dishes
    .map((dish, index) => {
      const answer = jev.answers[`dish_${index}`]
      return { id: dish.id, name: dish.name, p: answer?.type === "noul" ? round(answer.noul) : 0 }
    })
    .sort((a, b) => b.p - a.p)
  const rest = scored.slice(DISHES_KEPT)
  const offTopic = jev.answers[OFF_TOPIC_QUESTION_ID]

  return {
    ...base,
    ...(jev.costUsd !== undefined && { costUsd: jev.costUsd }),
    intent: choice("intent"),
    wants: Object.fromEntries(Object.entries(plan.wants).map(([intent, p]) => [intent, round(p ?? 0)])),
    offTopic: offTopic?.type === "noul" ? round(offTopic.noul) : 0,
    order: choice("order"),
    menuScope: choice("menu_scope"),
    menuCount: choice("menu_count"),
    language: choice("language"),
    dishes: scored.slice(0, DISHES_KEPT),
    ...(rest.length > 0 && { dishesBelow: { count: rest.length, max: rest[0].p } }),
  }
}
