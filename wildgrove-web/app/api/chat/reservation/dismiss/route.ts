// ══════════════════════════════════════════════════════════════════
// POST /api/chat/reservation/dismiss
// The customer closed the in-chat reservation form themselves.
// Records that on the message that opened the form. No reply is written
// and no model is called. The draft stays in the browser; this only
// tells Sage, on the next message, that nothing was booked.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { ChatSessionNotOwnedError, getOwnedSession } from "@wildgrove/core/chat/session"
import { getAppSettings } from "@wildgrove/core/settings"
import { enforceLimit, chatLimiter, getClientIp } from "@wildgrove/core/rate-limit"

const schema = z.object({
  sessionKey: z.string().min(1).max(200),
})

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceLimit(chatLimiter, getClientIp(req), "Too many messages. Please wait a moment.")
    if (limited) return limited

    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 })
    }

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

    const session = await getOwnedSession(parsed.data.sessionKey, profileId)
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 })
    }
    if (session.blockedAt) {
      return NextResponse.json({ success: false, error: "blocked", blocked: true }, { status: 403 })
    }

    const recent = await prisma.chatMessage.findMany({
      where: { sessionId: session.id, role: "ASSISTANT" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, metadata: true },
    })
    const opened = recent.find((message) => asRecord(message.metadata)?.reservationForm === true)
    const metadata = opened ? asRecord(opened.metadata) : null
    if (opened && metadata && metadata.reservationFormDismissed !== true) {
      await prisma.chatMessage.update({
        where: { id: opened.id },
        data: {
          metadata: { ...metadata, reservationFormDismissed: true } as Prisma.InputJsonValue,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ChatSessionNotOwnedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 })
    }
    console.error("[chat/reservation/dismiss] POST error:", error)
    return NextResponse.json({ success: false, error: "Failed to close the reservation form." }, { status: 500 })
  }
}
