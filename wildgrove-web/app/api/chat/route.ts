// ══════════════════════════════════════════════════════════════════
// POST /api/chat — Main chat endpoint (streaming)
// Returns NDJSON stream: AI responses stream live, human escalation when needed
// ══════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import {
  getOrCreateSession,
  saveMessage,
  escalateToHuman,
  checkRateLimit,
  checkAIRateLimit,
  generateAndSaveSummary,
} from "@wildgrove/core/chat/session"
import { getAIResponseStreamWithTools } from "@wildgrove/core/chat/ai"
import { getSageAiConfig } from "@wildgrove/core/chat/provider"
import type { UserContext } from "@wildgrove/core/chat/system-prompt"
import { detectMessageLanguage, fixedTextLocale, previousReplyLanguage, resolveReplyLanguage } from "@wildgrove/core/chat/detect-language"
import { prisma } from "@wildgrove/db"
import { sendChatSupportEmail } from "@wildgrove/core/email"
import { getAppSettings } from "@wildgrove/core/settings"
import {
  buildChatErrorUserMessage,
  buildChatFallbackUserMessage,
} from "@wildgrove/core/chat/sage-contact-prompt"
import { enforceLimit, chatLimiter, getClientIp } from "@wildgrove/core/rate-limit"
import { dishesToShow } from "@wildgrove/core/chat/chat-settings"
import { parseMenuToolItems, type MenuCard } from "@wildgrove/core/chat/menu-cards"
import { toClientMessage } from "@wildgrove/core/chat/client-message"
import { createEmDashStream, dropClosingHelpOffer, dropUnfinishedTail, replaceEmDashes, stripStructuredBlocks } from "@wildgrove/core/chat/message-blocks"
import type { ChatMessage } from "@wildgrove/db"
import { askJev } from "@wildgrove/core/chat/decide/jev-client"
import { DECISION_HISTORY_WINDOW, buildJevState, latestReservationFormClosed, turnsFromMessages } from "@wildgrove/core/chat/decide/state"
import { buildJevQuestions, loadDecisionDishes } from "@wildgrove/core/chat/decide/questions"
import { planResponse } from "@wildgrove/core/chat/decide/plan-response"
import { composeBlocks, decisionMetadata, runCodeSteps } from "@wildgrove/core/chat/reply"
import { buildFallbackText, buildWriterBrief, fixedApology, fixedDecline, looksLikePrice } from "@wildgrove/core/chat/step-briefs"
import { initialBalanceAmountsFrom, initialBalanceStrings } from "@wildgrove/core/wallet/initial-balance"

// ── Admin Realtime broadcasts ───────────────────────────────────
function getInsforgeAdmin() {
  return createServiceClient()
}

async function broadcastAdminMessage(sessionId: string, message: unknown) {
  try {
    const channel = getInsforgeAdmin().channel(`admin:chat:${sessionId}`)
    await channel.send({
      type: "broadcast",
      event: "new-message",
      payload: { message },
    })
  } catch (err) {
    console.error("[chat] Admin broadcast error:", err)
  }
}

async function broadcastAdminStatusChange(sessionId: string, status: string, tier: string) {
  try {
    const channel = getInsforgeAdmin().channel(`admin:chat:${sessionId}`)
    await channel.send({
      type: "broadcast",
      event: "status-change",
      payload: { status, tier },
    })
  } catch (err) {
    console.error("[chat] Admin status broadcast error:", err)
  }
}

// Broadcast a message to the user's own channel (for cross-device real-time sync)
async function broadcastToUserChannel(sessionId: string, message: ChatMessage) {
  try {
    const channel = getInsforgeAdmin().channel(`chat:session:${sessionId}`)
    await channel.send({
      type: "broadcast",
      event: "new-message",
      payload: { message: toClientMessage(message) },
    })
  } catch (err) {
    console.error("[chat] User channel broadcast error:", err)
  }
}

// Marker that Sage AI includes when the user confirms they want a human agent
const ESCALATION_MARKER = "[CONNECT_HUMAN]"
// Marker that Sage AI includes to trigger the in-chat reservation form
const RESERVATION_FORM_MARKER = "[START_RESERVATION_FORM]"

/** Send one NDJSON line through a stream controller */
/**
 * The customer can leave the page while Sage writes, and the browser closes
 * the stream. The reply is still finished and saved, so the customer finds
 * it on coming back: a closed stream is not a failure of the model.
 */
function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: Record<string, unknown>
) {
  const line = encoder.encode(JSON.stringify(data) + "\n")
  try {
    controller.enqueue(line)
  } catch {
    // Nobody is reading any more.
  }
}

function closeStream(controller: ReadableStreamDefaultController) {
  try {
    controller.close()
  } catch {
    // Already closed by the browser.
  }
}

function extractReservationListFromToolResult(result: string): unknown[] | null {
  try {
    const parsed = JSON.parse(result) as { reservations?: unknown }
    if (!Array.isArray(parsed.reservations) || parsed.reservations.length === 0) return null

    const normalized = parsed.reservations
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : "",
        date: typeof entry.date === "string" ? entry.date : "",
        partySize: typeof entry.partySize === "number" ? entry.partySize : 0,
        notes: typeof entry.notes === "string" ? entry.notes : null,
        status: typeof entry.status === "string" ? entry.status : "PENDING",
      }))
      .filter((entry) => entry.id && entry.date && entry.partySize > 0)

    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}

/**
 * Email the team the last messages of a conversation that just went to a
 * person. Fire and forget: the customer's reply does not wait for the mail.
 */
async function emailTeamAboutHandover(
  sessionId: string,
  profileId: string | null,
  locale: "en" | "es",
): Promise<void> {
  const recentMsgs = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 6,
  })

  const profile = profileId
    ? await prisma.profile.findUnique({
        where: { id: profileId },
        select: { firstName: true, lastName: true, email: true },
      })
    : null

  sendChatSupportEmail({
    customerName: profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
      : null,
    customerEmail: profile?.email || null,
    sessionId,
    messages: recentMsgs.reverse().map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    locale,
  }).catch((err) =>
    console.error("[chat] Support email error:", err)
  )
}

export async function POST(req: NextRequest) {
  try {
    // ── Per-IP rate limit (primary; can't be bypassed by rotating sessionKey) ──
    const limited = await enforceLimit(
      chatLimiter,
      getClientIp(req),
      "Too many messages. Please wait a moment.",
    )
    if (limited) return limited

    const body = await req.json()
    const { sessionKey, message, locale: pageLocale = "en", pathname } = body as {
      sessionKey: string
      message: string
      locale?: string
      pathname?: string | null
    }
    const sagePathname =
      typeof pathname === "string" && pathname.length > 0 && pathname.length <= 200
        ? pathname
        : undefined
    const normalizedPageLocale: "en" | "es" = pageLocale === "es" ? "es" : "en"

    // ── Validate input ─────────────────────────────────────────
    if (!sessionKey || typeof sessionKey !== "string") {
      return Response.json(
        { success: false, error: "sessionKey is required." },
        { status: 400 }
      )
    }
    if (!message || typeof message !== "string") {
      return Response.json(
        { success: false, error: "message is required." },
        { status: 400 }
      )
    }
    if (message.length > 500) {
      return Response.json(
        { success: false, error: "Message too long (max 500 characters)." },
        { status: 400 }
      )
    }

    const appSettings = await getAppSettings()

    // ── Chat switched off: nothing is saved ───────────────────
    if (appSettings.chatMode === "off") {
      return Response.json({ success: false, error: "chat_off" }, { status: 403 })
    }

    // ── Rate limit ─────────────────────────────────────────────
    const withinLimit = await checkRateLimit(sessionKey)
    if (!withinLimit) {
      return Response.json(
        { success: false, error: "Too many messages. Please wait a moment." },
        { status: 429 }
      )
    }

    // ── Get/create session & check auth ────────────────────────
    let profileId: string | undefined
    let userContext: UserContext | undefined
    try {
      const insforge = await createClient()
      const { data: { user } } = await insforge.auth.getUser()
      if (user) {
        profileId = user.id
        const profile = await prisma.profile.findUnique({
          where: { id: user.id },
          select: { firstName: true, email: true },
        })
        userContext = {
          isAuthenticated: true,
          firstName: profile?.firstName ?? undefined,
          email: profile?.email ?? undefined,
        }
      } else {
        userContext = { isAuthenticated: false }
      }
    } catch {
      userContext = { isAuthenticated: false }
    }

    const session = await getOrCreateSession(sessionKey, normalizedPageLocale, profileId)

    // Fixed sentences follow the previous Sage reply when it was English or
    // Spanish. The page is the fallback when there is no such reply.
    const previousAssistant = await prisma.chatMessage.findFirst({
      where: { sessionId: session.id, role: "ASSISTANT" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    })
    const replyLocale = detectMessageLanguage(
      message,
      fixedTextLocale(previousAssistant?.metadata, normalizedPageLocale),
    )

    // ── Tier 3: reject blocked sessions ───────────────────────
    if (session.blockedAt) {
      return Response.json(
        { success: false, error: "blocked", blocked: true },
        { status: 403 }
      )
    }

    // ── Tier 3: detect rapid message spam (5+ USER msgs in 10s) ─
    const recentSpamCount = await prisma.chatMessage.count({
      where: {
        sessionId: session.id,
        role: "USER",
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
    })
    if (recentSpamCount >= 5) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { blockedAt: new Date(), blockedReason: "rapid_message_spam" },
      })
      if (session.profileId) {
        await prisma.chatSession.updateMany({
          where: { profileId: session.profileId, blockedAt: null },
          data: { blockedAt: new Date(), blockedReason: "rapid_message_spam" },
        })
      }
      return Response.json(
        { success: false, error: "blocked", blocked: true },
        { status: 403 }
      )
    }

    // ── Save user message ──────────────────────────────────────
    const userMessage = await saveMessage(
      session.id,
      "USER",
      message.trim(),
      session.tier
    )

    // ── If already in HUMAN tier, don't auto-reply ─────────────
    if (session.tier === "HUMAN") {
      // Notify admin of the new user message in real-time
      broadcastAdminMessage(session.id, userMessage).catch(() => {})
      // Sync to other user devices in real-time
      broadcastToUserChannel(session.id, userMessage).catch(() => {})

      return Response.json({
        success: true,
        data: {
          userMessage: toClientMessage(userMessage),
          assistantMessage: null,
          session: { id: session.id, status: session.status, tier: session.tier },
        },
      })
    }

    // ── Team-only mode: the first message goes to a person ─────
    // Also a conversation Sage had before the owner switched to this mode.
    // No AI is called and no key is needed.
    if (appSettings.chatMode === "staff") {
      const updatedSession = await escalateToHuman(session.id, replyLocale)
      const systemMsg = await prisma.chatMessage.findFirst({
        where: { sessionId: session.id, role: "SYSTEM" },
        orderBy: { createdAt: "desc" },
      })

      broadcastAdminMessage(session.id, userMessage).catch(() => {})
      broadcastToUserChannel(session.id, userMessage).catch(() => {})
      broadcastAdminStatusChange(session.id, "WAITING", "HUMAN").catch(() => {})
      if (systemMsg) broadcastAdminMessage(session.id, systemMsg).catch(() => {})
      emailTeamAboutHandover(session.id, session.profileId, replyLocale).catch((err) =>
        console.error("[chat] Support email error:", err)
      )

      return Response.json({
        success: true,
        data: {
          userMessage: toClientMessage(userMessage),
          assistantMessage: null,
          systemMessage: systemMsg ? toClientMessage(systemMsg) : null,
          session: { id: updatedSession.id, status: updatedSession.status, tier: updatedSession.tier },
        },
      })
    }

    // ── AI (gpt-4o-mini) — STREAMING ─────────────────────────
    const aiAllowed = await checkAIRateLimit(session.id, 5 * 60_000, 12)
    if (!aiAllowed) {
      const fallbackMsg = buildChatFallbackUserMessage(replyLocale, appSettings)

      const assistantMessage = await saveMessage(session.id, "ASSISTANT", fallbackMsg, "AI")

      // Notify admin of both messages in real-time
      broadcastAdminMessage(session.id, userMessage).catch(() => {})
      broadcastAdminMessage(session.id, assistantMessage).catch(() => {})
      // Sync to other user devices in real-time
      broadcastToUserChannel(session.id, userMessage).catch(() => {})
      broadcastToUserChannel(session.id, assistantMessage).catch(() => {})

      return Response.json({
        success: true,
        data: {
          userMessage: toClientMessage(userMessage),
          assistantMessage: toClientMessage(assistantMessage),
          session: { id: session.id, status: session.status, tier: session.tier },
        },
      })
    }

    // The conversation before this message, oldest last here. The message
    // just saved is left out: both the decision model and the writer get it
    // on its own.
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id, id: { not: userMessage.id } },
      orderBy: { createdAt: "desc" },
      take: DECISION_HISTORY_WINDOW,
    })
    history.reverse()

    // Return a streaming NDJSON response
    const encoder = new TextEncoder()
    const authenticated = !!userContext?.isAuthenticated

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. Emit user message saved
          sendEvent(controller, encoder, {
            type: "user_saved",
            message: toClientMessage(userMessage),
          })
          // Notify admin of the new user message in real-time
          broadcastAdminMessage(session.id, userMessage).catch(() => {})
          // Sync to other user devices in real-time
          broadcastToUserChannel(session.id, userMessage).catch(() => {})

          // 2. Emit session info
          sendEvent(controller, encoder, {
            type: "session",
            session: { id: session.id, status: session.status, tier: "AI" },
          })

          sendEvent(controller, encoder, { type: "stream_start" })

          // 3. The decision model reads the message and the rules pick the steps.
          const trimmed = message.trim()
          const [dishes, aiConfig] = await Promise.all([loadDecisionDishes(normalizedPageLocale), getSageAiConfig()])
          const state = buildJevState({
            currentMessage: trimmed,
            turns: turnsFromMessages(history, normalizedPageLocale),
            topic: session.summary,
          })
          const jev = await askJev(state, buildJevQuestions(dishes), aiConfig.decisionModel)
          const plan = planResponse({ answers: jev.ok ? jev.answers : null, dishes, mode: appSettings.chatMode })
          if (!jev.ok) console.error("[chat] Decision model did not answer:", JSON.stringify(jev.attempts))
          const languageAnswer = jev.ok && jev.answers.language?.type === "choice" ? jev.answers.language : null
          const resolvedLanguage = resolveReplyLanguage(
            trimmed,
            normalizedPageLocale,
            languageAnswer,
            previousReplyLanguage(history),
          )
          const replyLanguage = resolvedLanguage.language
          // Fixed sentences exist only in English and Spanish. Another language
          // keeps those, and the cards, in the language of the page.
          const contentLocale = replyLanguage === "other" ? normalizedPageLocale : replyLanguage
          const promptLocale = replyLanguage === "es" ? "es" : "en"

          // 4. The code runs its steps: the menu and a dish come from the database.
          if (plan.steps.some((step) => step.kind === "menu" || step.kind === "dish")) {
            sendEvent(controller, encoder, { type: "tool_activity", tool: "get_menu" })
          }
          const intentAnswer = jev.ok ? jev.answers.intent : undefined
          const code = await runCodeSteps(plan, {
            sessionId: session.id,
            dishes,
            language: contentLocale,
            menuLocale: normalizedPageLocale,
            usualCount: aiConfig.menuDefaultCount,
            maxCount: aiConfig.menuMaxCount,
            intentProbabilities: intentAnswer?.type === "choice" ? intentAnswer.probabilities : {},
          })

          // 5. One call to the generative model writes the text of every step.
          const briefContext = {
            language: replyLanguage,
            pageLocale: normalizedPageLocale,
            authenticated,
            shareIngredients: appSettings.sageShareIngredients,
            reservationFormClosed: latestReservationFormClosed(history),
          }
          const writer = buildWriterBrief(code.outcomes, briefContext)
          let fullResponse = ""
          const emDashStream = createEmDashStream()
          let writerFailed = false
          let truncated = false
          let continued = false
          let reasoningTokens = 0
          let sawReasoning = false
          let reservationCreated = false
          const toolsCalled: string[] = []
          // Cards from get_menu in a tie-break; the code shows them, never the model.
          const tiebreakMenuItems: MenuCard[] = []
          let latestReservationList: unknown[] | null = null
          const writerStart = Date.now()

          // A message unrelated to Wild Grove gets the fixed refusal. The
          // writer is not called, so it cannot answer the sum or the poem.
          if (plan.steps[0]?.kind === "decline") {
            fullResponse = fixedDecline(contentLocale)
            sendEvent(controller, encoder, { type: "chunk", text: fullResponse })
          } else {
            try {
              for await (const event of getAIResponseStreamWithTools(
                trimmed,
                history,
                promptLocale,
                writer,
                profileId,
                userContext,
                normalizedPageLocale,
                { pathname: sagePathname }
              )) {
                if (event.type === "tool_start") {
                  toolsCalled.push(event.name)
                  sendEvent(controller, encoder, {
                    type: "tool_activity",
                    tool: event.name,
                  })
                  if (event.name === "create_reservation") {
                    reservationCreated = true
                  }
                } else if (event.type === "text_chunk") {
                  const spoken = emDashStream.push(event.text)
                  fullResponse += spoken
                  if (spoken) sendEvent(controller, encoder, { type: "chunk", text: spoken })
                } else if (event.type === "truncated") {
                  truncated = true
                } else if (event.type === "continued") {
                  continued = true
                } else if (event.type === "usage") {
                  reasoningTokens += event.reasoningTokens
                  sawReasoning = true
                } else if (event.type === "tool_result") {
                  if (event.name === "get_menu") {
                    tiebreakMenuItems.push(...(parseMenuToolItems(event.result) as unknown as MenuCard[]))
                  } else if (event.name === "get_user_reservations") {
                    latestReservationList = extractReservationListFromToolResult(event.result)
                  }
                }
              }
              const tail = emDashStream.flush()
              if (tail) {
                fullResponse += tail
                sendEvent(controller, encoder, { type: "chunk", text: tail })
              }
            } catch (aiError) {
              console.error("[chat] AI stream error:", aiError)
              writerFailed = true
            }
          }
          const writerMs = Date.now() - writerStart

          // 6. Put the reply together. Markers are read from what the model
          // wrote, before any of its text is replaced.
          const wantsEscalation = fullResponse.includes(ESCALATION_MARKER)
          const markerForm = fullResponse.includes(RESERVATION_FORM_MARKER)
          let text = replaceEmDashes(stripStructuredBlocks(
            fullResponse.replace(ESCALATION_MARKER, "").replace(RESERVATION_FORM_MARKER, "")
          ))
          const beforeTail = text.trimEnd()
          if (truncated) text = dropUnfinishedTail(text)
          const dropped = truncated && text.length < beforeTail.length
          text = dropClosingHelpOffer(text)

          // A get_menu in a tie-break becomes the reply's list, paged like the menu.
          let cards = code.cards
          let menu = code.menu
          if (cards.length === 0 && tiebreakMenuItems.length > 0) {
            const unique = tiebreakMenuItems.filter((item, i, all) => all.findIndex((other) => other.id === item.id) === i)
            cards = unique.slice(0, dishesToShow(plan.menuLimit, aiConfig.menuDefaultCount, aiConfig.menuMaxCount))
            menu = { ids: unique.map((item) => item.id), shown: cards.length }
          }

          // The price guard: the saved text never carries something shaped like a price.
          // The two starting test balance amounts are the only figures allowed through.
          const priceGuard =
            !writerFailed &&
            looksLikePrice(text, initialBalanceStrings(initialBalanceAmountsFrom(appSettings)))
          const hasCodeResult = cards.length > 0 || code.outcomes.some((o) => o.step === "book")
          let fallbackText = false
          if (writerFailed || priceGuard || !text) {
            fallbackText = true
            if (plan.steps[0]?.kind === "apology") {
              text = fixedApology(contentLocale)
            } else if (writerFailed && !hasCodeResult) {
              text = buildChatErrorUserMessage(contentLocale, appSettings)
            } else {
              text = buildFallbackText(code.outcomes, { ...briefContext, reservationsListed: !!latestReservationList })
            }
          }
          const finalResponse = [text, ...composeBlocks(code.outcomes, cards, latestReservationList)].join("\n\n")

          // The form opens when the code decided to book, or when a tie-break
          // wrote the marker; only for someone logged in. After the customer
          // closed the form themselves, a tie-break marker does not open it
          // again. A new request to book still does, because that step is book.
          const formClosedByCustomer = latestReservationFormClosed(history)
          const reservationFormTriggered =
            authenticated &&
            (code.outcomes.some((o) => o.step === "book") || (markerForm && !formClosedByCustomer))

          const metadata = {
            decision: decisionMetadata({
              jev,
              plan,
              dishes,
              requestedModel: aiConfig.decisionModel,
              window: DECISION_HISTORY_WINDOW,
              replyLanguage,
              replyLanguageFrom: resolvedLanguage.from,
            }),
            writer: {
              model: aiConfig.model,
              ms: writerMs,
              tools: [...writer.tools],
              called: toolsCalled,
              priceGuard,
              fallbackText,
              ...(writerFailed && { failed: true }),
              ...(continued && { continued: true }),
              ...(dropped && { dropped: true }),
              ...(sawReasoning && { reasoningTokens }),
            },
            ...(menu && { menu }),
            ...(reservationFormTriggered && { reservationForm: true }),
          }

          // 7. Save the complete response to DB
          const assistantMessage = await saveMessage(session.id, "ASSISTANT", finalResponse, "AI", metadata)

          // 8. Emit stream end with saved message + flags
          sendEvent(controller, encoder, {
            type: "stream_end",
            message: toClientMessage(assistantMessage),
            reservationCreated,
            reservationFormTriggered,
            ...(code.continuedFrom && { menuContinued: code.continuedFrom }),
          })
          // Generate a short summary title for the conversation list (fire and forget)
          generateAndSaveSummary(session.id).catch(() => {})
          // Notify admin of the AI response in real-time
          broadcastAdminMessage(session.id, assistantMessage).catch(() => {})
          // Sync AI response to other user devices in real-time
          broadcastToUserChannel(session.id, assistantMessage).catch(() => {})

          // 9. If the AI decided to escalate, trigger it now. Only the mixed
          // mode has a team behind Sage, and only a step about a person or
          // a tie-break was given the handover rules.
          const handoverStep = plan.steps.some((step) => step.kind === "human" || step.kind === "tiebreak")
          if (wantsEscalation && handoverStep && appSettings.chatMode === "mixed" && session.tier !== "HUMAN") {
            const updatedSession = await escalateToHuman(
              session.id,
              contentLocale
            )
            const systemMsg = await prisma.chatMessage.findFirst({
              where: { sessionId: session.id, role: "SYSTEM" },
              orderBy: { createdAt: "desc" },
            })

            sendEvent(controller, encoder, {
              type: "escalation",
              session: {
                id: updatedSession.id,
                status: updatedSession.status,
                tier: updatedSession.tier,
              },
              systemMessage: systemMsg ? toClientMessage(systemMsg) : null,
            })
            // Notify admin of escalation and system message in real-time
            broadcastAdminStatusChange(session.id, "WAITING", "HUMAN").catch(() => {})
            if (systemMsg) broadcastAdminMessage(session.id, systemMsg).catch(() => {})

            // Send email notification to admin (fire and forget)
            await emailTeamAboutHandover(session.id, session.profileId, contentLocale)
          }

          closeStream(controller)
        } catch (error) {
          console.error("[chat] Stream error:", error)
          sendEvent(controller, encoder, {
            type: "error",
            error: "Something went wrong.",
          })
          closeStream(controller)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[chat] POST error:", error)
    return Response.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
