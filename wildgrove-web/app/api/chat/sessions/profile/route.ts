// ══════════════════════════════════════════════════════════════════
// GET /api/chat/sessions/profile — Fetch chat sessions for auth user
// Used for cross-device session sync (load history on new devices)
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"

export async function GET() {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    const sessions = await prisma.chatSession.findMany({
      where: { profileId: user.id, hiddenByUser: false },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    })

    const summaries = sessions.map((s) => ({
      id: s.id,
      sessionKey: s.sessionKey,
      status: s.status,
      tier: s.tier,
      messageCount: s._count.messages,
      lastMessage: s.messages[0]
        ? {
            content: s.messages[0].content.slice(0, 80),
            role: s.messages[0].role,
          }
        : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { sessions: summaries },
    })
  } catch (error) {
    console.error("[chat/sessions/profile] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions." },
      { status: 500 }
    )
  }
}
