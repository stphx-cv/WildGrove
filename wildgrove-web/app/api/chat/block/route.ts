// ══════════════════════════════════════════════════════════════════
// POST /api/chat/block — Client-triggered Tier 3 session block
// Called by ChatProvider when 3+ Tier-1 rate-limit hits accumulate.
// Marks the session (and all sessions of the same profile) as blocked.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionKey, reason } = body as { sessionKey?: string; reason?: string }

    if (!sessionKey || typeof sessionKey !== "string") {
      return NextResponse.json({ success: false, error: "sessionKey is required." }, { status: 400 })
    }

    const session = await prisma.chatSession.findUnique({
      where: { sessionKey },
      select: { id: true, profileId: true, blockedAt: true },
    })

    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 })
    }

    if (session.blockedAt) {
      return NextResponse.json({ success: true })
    }

    const blockData = {
      blockedAt: new Date(),
      blockedReason: typeof reason === "string" ? reason.slice(0, 200) : "client_tier3",
    }

    await prisma.chatSession.update({
      where: { id: session.id },
      data: blockData,
    })

    // Block all other sessions of the same authenticated user
    if (session.profileId) {
      await prisma.chatSession.updateMany({
        where: { profileId: session.profileId, blockedAt: null },
        data: blockData,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[chat/block] POST error:", error)
    return NextResponse.json({ success: false, error: "Failed to block session." }, { status: 500 })
  }
}
