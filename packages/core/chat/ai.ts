// ══════════════════════════════════════════════════════════════════
// Sage AI | The writer
// The decision model picks the steps and the code runs its own; this is
// the one call to the generative model that writes the reply's text. It
// gets a brief of what the code already did and, only when a step is its
// own, the tools of that step. It streams text; when it calls a tool, the
// tool runs and the model is called again with the result.
// The model and endpoint come from the CMS; see ./provider.
// ══════════════════════════════════════════════════════════════════

import type OpenAI from "openai"
import { getSageAi } from "./provider"
import { buildSystemPrompt, type UserContext } from "./system-prompt"
import { SAGE_TOOLS, executeTool, type SageToolName } from "./tools"
import { getTranslations } from "next-intl/server"
import { getAppSettings } from "../settings"
import {
    buildSageRestaurantIdentityMarkdown,
    buildSageUnknownContactHint,
} from "./sage-contact-prompt"
import { buildPageContextMarkdown } from "./page-context"
import { writerCallExtras, type WriterCallExtras } from "./ai-providers"
import { endsOnSentence, menuBlockNames, stripStructuredBlocks } from "./message-blocks"
import { latestReservationFormClosed } from "./decide/state"
import { initialBalanceAmountsFrom } from "../wallet/initial-balance"
import type { ChatMessage } from "@wildgrove/db"

export type SageChatContext = {
  pathname?: string | null
}

/** What the writer is asked to do, and with which tools. */
export type WriterBrief = {
  /** The steps of the reply, in order, as the code describes them. */
  brief: string
  tools: readonly SageToolName[]
  /** The apology when the decision model did not answer: no restaurant data, no history, no tools. */
  bare?: boolean
}

/**
 * Tool arguments come from the model, and models outside OpenAI's own line are
 * more willing to emit malformed JSON. A bad argument object costs one tool
 * call, not the whole conversation.
 */
function parseToolArguments(name: string, raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>
  } catch {
    console.error(`[chat] Malformed arguments for tool ${name}:`, raw)
    return null
  }
}

/**
 * A past Sage reply as the writer reads it: the text without the JSON
 * blocks, which carry prices the writer must not repeat. Which dishes were
 * shown is a separate private note, not a line of the reply, because the
 * writer copies lines it finds in its own past messages.
 */
function historyText(msg: ChatMessage): string {
  if (msg.role !== "ASSISTANT") return msg.content
  return stripStructuredBlocks(msg.content)
}

/** Dishes the website already showed, for follow-ups such as "the second one". */
function shownDishMemory(history: ChatMessage[], locale: "en" | "es"): string {
  const lines: string[] = []
  for (const msg of history) {
    if (msg.role !== "ASSISTANT") continue
    const names = menuBlockNames(msg.content, locale)
    if (names.length === 0) continue
    lines.push(names.map((name, index) => `${index + 1}. ${name}`).join("; "))
  }
  if (lines.length === 0) return ""
  return [
    "## DISHES THE WEBSITE ALREADY SHOWED",
    "Private. Use it for follow-ups such as \"the second one\". Never write this section, never write \"Showed dish cards\", and never put a list of dishes in parentheses.",
    ...lines,
  ].join("\n")
}

/**
 * The customer left the reservation form. Private, so the writer does not
 * ask about a form that is no longer there, and does not open it again
 * unless this message asks to book.
 */
function closedFormMemory(history: ChatMessage[]): string {
  if (!latestReservationFormClosed(history)) return ""
  return [
    "## RESERVATION FORM THE CUSTOMER CLOSED",
    "Private. The customer closed the reservation form themselves. No reservation was created. Do not ask whether they finished it or filled it in. Do not mention that form, and do not write [START_RESERVATION_FORM], unless this reply's task says the form is opening because they asked to book again or to open the form again.",
  ].join("\n")
}

/** Build the OpenAI message array from conversation state */
async function buildMessages(
  userMessage: string,
  history: ChatMessage[],
  locale: "en" | "es",
  writer: WriterBrief,
  userContext?: UserContext,
  sageContext?: SageChatContext,
  cardLanguage: "en" | "es" = locale,
): Promise<OpenAI.ChatCompletionMessageParam[]> {
  if (writer.bare) {
    const name = locale === "es" ? "Eres Sage, el asistente virtual de Wild Grove, un restaurante en Lima." : "You are Sage, the virtual assistant of Wild Grove, a restaurant in Lima."
    return [
      { role: "system", content: `${name}\n\n${writer.brief}` },
      { role: "user", content: userMessage },
    ]
  }

  const [settings, t, pageContextMarkdown] = await Promise.all([
    getAppSettings(),
    getTranslations({ locale, namespace: "common" }),
    buildPageContextMarkdown(sageContext?.pathname, locale),
  ])
  const systemPrompt = buildSystemPrompt(
    locale,
    userContext,
    buildSageRestaurantIdentityMarkdown(locale, settings),
    buildSageUnknownContactHint(locale, settings),
    {
      sageShareIngredients: settings.sageShareIngredients,
      portfolioDisclosure: t("portfolioDisclosure"),
      pageContextMarkdown,
      initialBalance: initialBalanceAmountsFrom(settings),
    }
  )

  const conversationMessages: OpenAI.ChatCompletionMessageParam[] = history
    .filter((msg) => msg.role === "USER" || msg.role === "ASSISTANT")
    .map((msg) => ({
      role: msg.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: historyText(msg),
    }))

  const memory = [shownDishMemory(history, cardLanguage), closedFormMemory(history)].filter(Boolean).join("\n\n")
  const system = memory
    ? `${systemPrompt}\n\n${writer.brief}\n\n${memory}`
    : `${systemPrompt}\n\n${writer.brief}`

  return [
    { role: "system" as const, content: system },
    ...conversationMessages,
    { role: "user" as const, content: userMessage },
  ]
}

// ── Max tool call rounds to prevent infinite loops ────────────────
const MAX_TOOL_ROUNDS = 5

/**
 * Yields objects with type info so the caller can distinguish tool activity from text.
 */
export type StreamEvent =
  | { type: "tool_start"; name: string }
  | { type: "tool_result"; name: string; result: string }
  | { type: "text_chunk"; text: string }
  /** The reply hit the token cap and a continuation round is about to start. */
  | { type: "continued" }
  /** Reasoning tokens the provider reported for one round, when it reports them. */
  | { type: "usage"; reasoningTokens: number }
  /** The last completion stopped because it hit the token cap, after one continuation. */
  | { type: "truncated" }

const CUTOFF_CONTINUATION =
  "The reply above was cut off by the length limit. Continue from the exact point it stopped, in the same language, and finish that thought in one or two short sentences. Do not repeat text already written. Start with the next characters themselves, never with an ellipsis. Do not add a contact line."

type PendingToolCall = { id: string; name: string; arguments: string }

/** A continuation that starts a new token needs a space when the cut left a word boundary. */
function needsJoinSpace(previous: string, next: string): boolean {
  const end = previous.trimEnd().slice(-1)
  const start = next.slice(0, 1)
  return /[\p{L}\p{N},;:]/u.test(end) && /[\p{L}\p{N}]/u.test(start)
}

/** Only spaces and dots so far: too early to tell an ellipsis from a real period. */
function seamUndecided(seam: string): boolean {
  return /^[\s.…]*$/u.test(seam)
}

/** A continuation often opens with "..." or "…"; without it the two parts read as one text. */
function dropLeadingEllipsis(seam: string): string {
  return seam.replace(/^\s*(?:\.{2,}|…)\s*/u, "")
}

export async function* getAIResponseStreamWithTools(
  userMessage: string,
  history: ChatMessage[],
  locale: "en" | "es",
  writer: WriterBrief,
  profileId?: string,
  userContext?: UserContext,
  menuLocale?: "en" | "es",
  sageContext?: SageChatContext
): AsyncGenerator<StreamEvent> {
  const [messages, ai] = await Promise.all([
    buildMessages(userMessage, history, locale, writer, userContext, sageContext, menuLocale ?? locale),
    getSageAi(),
  ])

  // Only the tools of this reply's steps: a reply about the menu cannot book.
  const allowed = new Set<string>(writer.tools)
  const tools = SAGE_TOOLS.filter((tool) => tool.type === "function" && allowed.has(tool.function.name))

  let rounds = 0
  let lengthContinuationUsed = false
  let finishingCutOff = false
  let carried = ""
  let pendingJoin = false
  let seam = ""
  const allMessages: OpenAI.ChatCompletionMessageParam[] = [...messages]

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++

    // One streamed call. Text goes out as it arrives; tool calls are
    // gathered, run, and answered in the next round. A reply cut off by
    // the token cap is continued once, without tools, so it can finish
    // the sentence it already started. The continuation gets the same cap:
    // reasoning counts against it, and a smaller one could be spent before
    // the first word.
    const body: OpenAI.Chat.ChatCompletionCreateParamsStreaming & WriterCallExtras = {
      model: ai.model,
      messages: allMessages,
      ...(tools.length > 0 && !finishingCutOff && { tools }),
      max_tokens: ai.maxTokens,
      temperature: ai.temperature,
      stream: true,
      ...writerCallExtras(ai.provider),
    }
    const stream = await ai.client.chat.completions.create(body)
    finishingCutOff = false

    let text = ""
    let finishReason: string | null = null
    const calls = new Map<number, PendingToolCall>()
    for await (const chunk of stream) {
      const reasoningTokens = chunk.usage?.completion_tokens_details?.reasoning_tokens
      if (typeof reasoningTokens === "number") {
        yield { type: "usage", reasoningTokens }
      }
      const choice = chunk.choices[0]
      if (!choice) continue
      if (choice.finish_reason) finishReason = choice.finish_reason
      const delta = choice.delta
      if (!delta) continue
      let piece = delta.content ?? ""
      // The start of a continuation is held until it is clear whether it opens with an ellipsis.
      if (piece && pendingJoin) {
        seam += piece
        piece = ""
        if (!seamUndecided(seam)) {
          piece = dropLeadingEllipsis(seam)
          if (needsJoinSpace(carried, piece)) piece = ` ${piece}`
          pendingJoin = false
          seam = ""
        }
      }
      if (piece) {
        text += piece
        yield { type: "text_chunk", text: piece }
      }
      for (const part of delta.tool_calls ?? []) {
        const pending = calls.get(part.index) ?? { id: "", name: "", arguments: "" }
        if (part.id) pending.id = part.id
        if (part.function?.name) pending.name += part.function.name
        if (part.function?.arguments) pending.arguments += part.function.arguments
        calls.set(part.index, pending)
      }
    }
    // A continuation that was only dots: a real period stays, an ellipsis goes.
    if (pendingJoin && seam) {
      const rest = dropLeadingEllipsis(seam).trim()
      pendingJoin = false
      seam = ""
      if (rest) {
        text += rest
        yield { type: "text_chunk", text: rest }
      }
    }

    if (calls.size === 0) {
      const unfinished = !endsOnSentence(text)
      if (finishReason === "length" && unfinished && !lengthContinuationUsed && text.trim()) {
        lengthContinuationUsed = true
        finishingCutOff = true
        carried = text
        pendingJoin = true
        yield { type: "continued" }
        allMessages.push({ role: "assistant", content: text })
        allMessages.push({ role: "user", content: CUTOFF_CONTINUATION })
        continue
      }
      if (finishReason === "length" && unfinished) yield { type: "truncated" }
      return
    }

    const toolCalls = [...calls.values()]
    allMessages.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    })

    for (const call of toolCalls) {
      yield { type: "tool_start", name: call.name }

      if (!allowed.has(call.name)) {
        allMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: `Error: ${call.name} is not available for this reply.`,
        })
        continue
      }
      const args = parseToolArguments(call.name, call.arguments)
      if (!args) {
        allMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Error: the arguments for this tool were not valid JSON. Ask the guest to rephrase.",
        })
        continue
      }
      if (call.name === "get_menu" && menuLocale) {
        args.language = menuLocale
      }
      if (call.name === "get_restaurant_info") {
        args.locale = locale
      }
      // A reservation keeps the page language, like the booking form does.
      if (call.name === "create_reservation") {
        args.locale = menuLocale ?? locale
      }
      const result = await executeTool(call.name, args, profileId)

      allMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      })

      yield { type: "tool_result", name: call.name, result }
    }
  }

  // Fallback if max rounds reached
  yield {
    type: "text_chunk",
    text:
      locale === "es"
        ? "No pude completar la respuesta. Inténtalo de nuevo."
        : "I couldn't finish the reply. Please try again.",
  }
}
