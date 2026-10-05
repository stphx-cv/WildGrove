// ══════════════════════════════════════════════════════════════════
// POST   /api/chat/escalate — Escalate session to human agent
// DELETE /api/chat/escalate — Cancel a pending human request
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { escalateToHuman, saveMessage } from "@wildgrove/core/chat/session"
import { toClientMessage } from "@wildgrove/core/chat/client-message"
import { getAppSettings } from "@wildgrove/core/settings"
import { prisma } from "@wildgrove/db"

export async function POST(req: NextRequest) {
  try {
    // No chat, or Sage alone with no team behind it: nobody to hand over to.
    const { chatMode } = await getAppSettings()
    if (chatMode === "off") {
      return NextResponse.json({ success: false, error: "chat_off" }, { status: 403 })
    }
    if (chatMode === "sage") {
      return NextResponse.json({ success: false, error: "human_unavailable" }, { status: 403 })
    }

    const body = await req.json()
    const { sessionId, sessionKey } = body as { sessionId: string; sessionKey: string }

    if (!sessionId || !sessionKey) {
      return NextResponse.json(
        { success: false, error: "sessionId and sessionKey are required." },
        { status: 400 }
      )
    }

    // Verify the session belongs to this sessionKey (security check)
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.sessionKey !== sessionKey) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      )
    }

    // Already escalated
    if (session.tier === "HUMAN") {
      return NextResponse.json({
        success: true,
        data: {
          session: {
            id: session.id,
            status: session.status,
            tier: session.tier,
          },
          systemMessage: null,
        },
      })
    }

    const updatedSession = await escalateToHuman(sessionId, session.locale)

    // Get the system message that was just inserted
    const systemMessage = await prisma.chatMessage.findFirst({
      where: { sessionId, role: "SYSTEM" },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: updatedSession.id,
          status: updatedSession.status,
          tier: updatedSession.tier,
        },
        systemMessage: systemMessage ? toClientMessage(systemMessage) : null,
      },
    })
  } catch (error) {
    console.error("[chat/escalate] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to escalate session." },
      { status: 500 }
    )
  }
}

// ── DELETE: Cancel a pending human agent request ─────────────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, sessionKey, locale = "en" } = body as {
      sessionId: string
      sessionKey: string
      locale?: string
    }

    if (!sessionId || !sessionKey) {
      return NextResponse.json(
        { success: false, error: "sessionId and sessionKey are required." },
        { status: 400 }
      )
    }

    // Verify the session belongs to this sessionKey (security check)
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, sessionKey: true, status: true, tier: true },
    })

    if (!session || session.sessionKey !== sessionKey) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      )
    }

    // Only cancel if still waiting for an agent
    if (session.tier !== "HUMAN" || session.status === "RESOLVED") {
      return NextResponse.json({ success: true, data: { cancelled: false } })
    }

    // Resolve the session and add a system message
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: "RESOLVED" },
    })

    const systemMsg =
      locale === "es"
        ? "La solicitud de agente fue cancelada por el usuario."
        : "The agent request was cancelled by the user."

    await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

    return NextResponse.json({ success: true, data: { cancelled: true } })
  } catch (error) {
    console.error("[chat/escalate] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to cancel escalation." },
      { status: 500 }
    )
  }
}
