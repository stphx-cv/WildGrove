// ══════════════════════════════════════════════════════════════════
// POST /api/chat/sessions — List session summaries for given keys
// Used by the chat widget to populate the conversation list
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionKeys } = body as { sessionKeys: string[] }

    if (!Array.isArray(sessionKeys) || sessionKeys.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sessions: [] },
      })
    }

    // Limit to 50 sessions max
    const keys = sessionKeys.slice(0, 50)

    const sessions = await prisma.chatSession.findMany({
      where: { sessionKey: { in: keys } },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // only the last message for preview fallback
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
    })

    const summaries = sessions.map((s) => ({
      id: s.id,
      sessionKey: s.sessionKey,
      status: s.status,
      tier: s.tier,
      messageCount: s._count.messages,
      summary: s.summary ?? null,
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
    console.error("[chat/sessions] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list sessions." },
      { status: 500 }
    )
  }
}
