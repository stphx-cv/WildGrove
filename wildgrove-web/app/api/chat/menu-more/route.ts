// ══════════════════════════════════════════════════════════════════
// POST /api/chat/menu-more
// "See N more" under Sage's dish cards: the next page of that message's
// list, as a new Sage message. The code writes it; no model is called, and
// it does not count toward the conversation's AI replies.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { ChatSessionNotOwnedError, getOwnedSession, saveMessage } from "@wildgrove/core/chat/session"
import { continueMenu, menuMoreText } from "@wildgrove/core/chat/menu-pages"
import { structuredBlock } from "@wildgrove/core/chat/message-blocks"
import { toClientMessage } from "@wildgrove/core/chat/client-message"
import { getSageAiConfig } from "@wildgrove/core/chat/provider"
import { getAppSettings } from "@wildgrove/core/settings"
import { enforceLimit, chatLimiter, getClientIp } from "@wildgrove/core/rate-limit"

const schema = z.object({
  sessionKey: z.string().min(1).max(200),
  messageId: z.string().min(1).max(100),
  locale: z.enum(["en", "es"]).optional().default("en"),
})

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceLimit(chatLimiter, getClientIp(req), "Too many messages. Please wait a moment.")
    if (limited) return limited

    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 })
    }
    const { sessionKey, messageId, locale } = parsed.data

    const { chatMode } = await getAppSettings()
    if (chatMode === "off") {
      return NextResponse.json({ success: false, error: "chat_off" }, { status: 403 })
    }

    let profileId: string | undefined
    try {
      const insforge = await createClient()
      const { data: { user } } = await insforge.auth.getUser()
      if (user) profileId = user.id
    } catch {
      // A guest opens a session by its key alone.
    }

    const session = await getOwnedSession(sessionKey, profileId)
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 })
    }
    if (session.blockedAt) {
      return NextResponse.json({ success: false, error: "blocked", blocked: true }, { status: 403 })
    }

    const { menuDefaultCount } = await getSageAiConfig()
    const page = await continueMenu(session.id, messageId, menuDefaultCount, locale)
    if (page.status !== "ok") {
      // Nothing left, or another click already brought this page.
      return NextResponse.json({ success: false, error: "no_more" }, { status: 409 })
    }

    const text = menuMoreText(page.cards.length, page.remaining, locale)
    const content = page.cards.length > 0 ? `${text}\n\n${structuredBlock("menu-items", page.cards)}` : text
    const message = await saveMessage(session.id, "ASSISTANT", content, "AI", {
      source: "menu_more",
      menu: page.menu,
    })

    return NextResponse.json({ success: true, data: { message: toClientMessage(message) } })
  } catch (error) {
    if (error instanceof ChatSessionNotOwnedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 })
    }
    console.error("[chat/menu-more] POST error:", error)
    return NextResponse.json({ success: false, error: "Failed to load more dishes." }, { status: 500 })
  }
}
