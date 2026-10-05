// ══════════════════════════════════════════════════════════════════
// GET  /api/chat — List active/waiting chat sessions
// POST /api/chat — Admin sends a message to a session
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@wildgrove/db"
import { saveMessage } from "@wildgrove/core/chat/session"
import { createServiceClient } from '@wildgrove/core/clients/admin'

// InsForge admin client for Realtime broadcasts
function getInsforgeAdmin() {
  return createServiceClient()
}

// ── GET: List chat sessions ─────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  try {
    const sessions = await prisma.chatSession.findMany({
      where: {},
      include: {
        profile: {
          select: { name: true, email: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // last message preview
        },
        _count: { select: { messages: true } },
      },
      orderBy: [
        // WAITING first (highest priority)
        { status: "asc" },
        { updatedAt: "desc" },
      ],
    })

    const data = sessions.map((s) => ({
      id: s.id,
      sessionKey: s.sessionKey,
      status: s.status,
      tier: s.tier,
      customerName: s.profile?.name || "Anonymous",
      customerEmail: s.profile?.email || null,
      customerAvatar: s.profile?.avatarUrl || null,
      lastMessage: s.messages[0]?.content || null,
      lastMessageAt: s.messages[0]?.createdAt || s.updatedAt,
      messageCount: s._count.messages,
      createdAt: s.createdAt,
      isContactForm: s.sessionKey.startsWith("contact-"),
      blockedAt: s.blockedAt,
      blockedReason: s.blockedReason,
    }))

    return NextResponse.json({ success: true, data, callerRole: auth.role })
  } catch (error) {
    console.error("[admin/chat] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions." },
      { status: 500 }
    )
  }
}

// ── POST: Admin sends a message ─────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  try {
    const body = await req.json()
    const { sessionId, content } = body as {
      sessionId: string
      content: string
    }

    if (!sessionId || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: "sessionId and content are required." },
        { status: 400 }
      )
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      )
    }

    const insforgeAdmin = getInsforgeAdmin()
    const channel = insforgeAdmin.channel(`chat:session:${sessionId}`)

    // Auto-intervene: pause auto-responses when admin writes for the first time
    const needsIntervention =
      session.status !== "AGENT_JOINED" && session.status !== "RESOLVED"

    if (needsIntervention) {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: "AGENT_JOINED", tier: "HUMAN", adminId: auth.userId },
      })

      // System message
      const systemMsg =
        session.locale === "es"
          ? "Alguien del equipo entró al chat."
          : "Someone from the team joined the chat."
      const sysMessage = await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

      // Broadcast status + tier change, then system message
      try {
        await channel.send({
          type: "broadcast",
          event: "status-change",
          payload: { status: "AGENT_JOINED", tier: "HUMAN" },
        })
        await channel.send({
          type: "broadcast",
          event: "new-message",
          payload: { message: sysMessage },
        })
      } catch (rtError) {
        console.error("[admin/chat] Realtime broadcast error:", rtError)
      }
    }

    // Save admin message
    const message = await saveMessage(
      sessionId,
      "AGENT",
      content.trim(),
      "HUMAN"
    )

    // Broadcast the agent message
    try {
      await channel.send({
        type: "broadcast",
        event: "new-message",
        payload: { message },
      })
    } catch (rtError) {
      console.error("[admin/chat] Realtime broadcast error:", rtError)
    }

    return NextResponse.json({
      success: true,
      data: { message, intervened: needsIntervention },
    })
  } catch (error) {
    console.error("[admin/chat] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to send message." },
      { status: 500 }
    )
  }
}
