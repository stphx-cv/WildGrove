// ══════════════════════════════════════════════════════════════════
// POST /api/chat/migrate — Link orphaned guest sessions to a user
// Called by the chat widget after the user logs in or registers
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
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

    // 2. Get the session key from the request body
    const body = await request.json()
    const { sessionKey } = body

    if (!sessionKey || typeof sessionKey !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing sessionKey" },
        { status: 400 }
      )
    }

    // 3. Find the guest session (no profileId linked)
    const session = await prisma.chatSession.findFirst({
      where: {
        sessionKey,
        profileId: null, // Only migrate orphaned sessions
      },
    })

    if (!session) {
      // No orphaned session found — either already migrated or doesn't exist
      return NextResponse.json({ success: true, migrated: false })
    }

    // 4. Link the session to the user's profile
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { profileId: user.id },
    })

    return NextResponse.json({
      success: true,
      migrated: true,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("[chat/migrate] Error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
