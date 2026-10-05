// ══════════════════════════════════════════════════════════════════
// POST   /api/chat/session — Create or resume a chat session
// GET    /api/chat/session — Fetch session messages
// DELETE /api/chat/session — Permanently delete a user's own session
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { getOrCreateSession, ChatSessionNotOwnedError } from "@wildgrove/core/chat/session"
import { toClientMessage } from "@wildgrove/core/chat/client-message"
import { prisma } from "@wildgrove/db"

function getInsforgeAdmin() {
  return createServiceClient()
}

// ── POST: Create or resume session ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionKey, locale = "en" } = body as {
      sessionKey?: string
      locale?: string
    }

    if (!sessionKey || typeof sessionKey !== "string") {
      return NextResponse.json(
        { success: false, error: "sessionKey is required." },
        { status: 400 }
      )
    }

    // Check if user is authenticated
    let profileId: string | undefined
    try {
      const insforge = await createClient()
      const { data: { user } } = await insforge.auth.getUser()
      if (user) profileId = user.id
    } catch {
      // Anonymous user — no auth, that's fine
    }

    const session = await getOrCreateSession(sessionKey, locale, profileId)

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          tier: session.tier,
          locale: session.locale,
          blockedAt: session.blockedAt,
        },
        messages: session.messages.map(toClientMessage),
      },
    })
  } catch (error) {
    if (error instanceof ChatSessionNotOwnedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    console.error("[chat/session] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create or resume session." },
      { status: 500 }
    )
  }
}

// ── PATCH: Hide session from user's view (stays in DB for admin) ─
export async function PATCH(req: NextRequest) {
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

    const body = await req.json()
    const { sessionKey } = body as { sessionKey?: string }

    if (!sessionKey || typeof sessionKey !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing sessionKey" },
        { status: 400 }
      )
    }

    // Find session and verify it belongs to this user
    const session = await prisma.chatSession.findFirst({
      where: { sessionKey, profileId: user.id },
      select: { id: true },
    })

    if (!session) {
      // Not found or not owned — treat as success (idempotent)
      return NextResponse.json({ success: true })
    }

    // Mark as hidden — session stays in DB, admin can still see it
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { hiddenByUser: true },
    })

    // Broadcast so all other open devices for this user react immediately
    try {
      const insforgeAdmin = getInsforgeAdmin()
      const channel = insforgeAdmin.channel(`user:chat:${user.id}`)
      await channel.send({
        type: "broadcast",
        event: "session-deleted",
        payload: { sessionKey },
      })
    } catch (rtError) {
      console.error("[chat/session] Realtime broadcast error:", rtError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[chat/session] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to hide session." },
      { status: 500 }
    )
  }
}

// ── GET: Fetch session messages ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionKey = searchParams.get("sessionKey")

    if (!sessionKey) {
      return NextResponse.json(
        { success: false, error: "sessionKey is required." },
        { status: 400 }
      )
    }

    let profileId: string | undefined
    try {
      const insforge = await createClient()
      const { data: { user } } = await insforge.auth.getUser()
      if (user) profileId = user.id
    } catch {
      // Anonymous user — no auth, that's fine
    }

    const session = await getOrCreateSession(sessionKey, undefined, profileId)

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          tier: session.tier,
          locale: session.locale,
          blockedAt: session.blockedAt,
        },
        messages: session.messages.map(toClientMessage),
      },
    })
  } catch (error) {
    if (error instanceof ChatSessionNotOwnedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    console.error("[chat/session] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch session." },
      { status: 500 }
    )
  }
}
