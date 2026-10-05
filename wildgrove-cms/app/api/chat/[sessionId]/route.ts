// ══════════════════════════════════════════════════════════════════
// GET    /api/chat/[sessionId] — Fetch all messages for a session
// PATCH  /api/chat/[sessionId] — Update session status (resolve)
// DELETE /api/chat/[sessionId] — Permanently delete (OWNER only)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@wildgrove/db"
import { resolveSession, saveMessage } from "@wildgrove/core/chat/session"
import { createServiceClient } from '@wildgrove/core/clients/admin'

function getInsforgeAdmin() {
  return createServiceClient()
}

// ── GET: Fetch session messages ─────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  try {
    const { sessionId } = await params

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        profile: {
          select: { name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          tier: session.tier,
          locale: session.locale,
          createdAt: session.createdAt,
          customer: session.profile
            ? {
                name: session.profile.name,
                email: session.profile.email,
                phone: session.profile.phoneNumber,
                avatar: session.profile.avatarUrl,
              }
            : null,
        },
        messages: session.messages,
      },
    })
  } catch (error) {
    console.error("[admin/chat/[sessionId]] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch session." },
      { status: 500 }
    )
  }
}

// ── PATCH: Update session status ────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  try {
    const { sessionId } = await params
    const body = await req.json()
    const { action } = body as { action: "resolve" | "resume" | "pause" | "cancel" | "unblock" }

    if (action !== "resolve" && action !== "resume" && action !== "pause" && action !== "cancel" && action !== "unblock") {
      return NextResponse.json(
        { success: false, error: "Invalid action." },
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

    // ── Unblock session (and all sessions of same profile) ──────
    if (action === "unblock") {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { blockedAt: null, blockedReason: null },
      })
      if (session.profileId) {
        await prisma.chatSession.updateMany({
          where: { profileId: session.profileId },
          data: { blockedAt: null, blockedReason: null },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (action === "cancel") {
      const updatedSession = await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: "CANCELLED" },
      })

      const systemMsg =
        session.locale === "es"
          ? "Esta conversación ha sido cerrada por el equipo."
          : "This conversation has been closed by our team."
      await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

      try {
        await channel.send({
          type: "broadcast",
          event: "status-change",
          payload: { status: "CANCELLED", tier: session.tier },
        })
      } catch (rtError) {
        console.error("[admin/chat] Realtime broadcast error:", rtError)
      }

      return NextResponse.json({
        success: true,
        data: {
          session: {
            id: updatedSession.id,
            status: updatedSession.status,
            tier: updatedSession.tier,
          },
        },
      })
    }

    if (action === "pause") {
      // Pause Sage: take over session without sending a message yet
      const updatedSession = await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: "AGENT_JOINED", tier: "HUMAN", adminId: auth.userId },
      })

      const systemMsg =
        session.locale === "es"
          ? "Las respuestas automáticas de Sage han sido desactivadas temporalmente."
          : "Sage's automatic responses have been temporarily disabled."
      const sysMessage = await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

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

      return NextResponse.json({
        success: true,
        data: {
          session: {
            id: updatedSession.id,
            status: updatedSession.status,
            tier: updatedSession.tier,
          },
          sysMessage,
        },
      })
    }

    if (action === "resume") {
      // Resume auto-responses: set back to ACTIVE + AI tier
      const updatedSession = await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: "ACTIVE", tier: "AI", adminId: null },
      })

      const systemMsg =
        session.locale === "es"
          ? "Las respuestas automáticas de Sage han sido reactivadas."
          : "Sage's automatic responses have been re-enabled."
      const sysMessage = await saveMessage(sessionId, "SYSTEM", systemMsg, "AI")

      try {
        await channel.send({
          type: "broadcast",
          event: "status-change",
          payload: { status: "ACTIVE", tier: "AI" },
        })
        await channel.send({
          type: "broadcast",
          event: "new-message",
          payload: { message: sysMessage },
        })
      } catch (rtError) {
        console.error("[admin/chat] Realtime broadcast error:", rtError)
      }

      return NextResponse.json({
        success: true,
        data: {
          session: {
            id: updatedSession.id,
            status: updatedSession.status,
            tier: updatedSession.tier,
          },
          sysMessage,
        },
      })
    }

    // action === "resolve"
    const updatedSession = await resolveSession(sessionId, session.locale)

    try {
      await channel.send({
        type: "broadcast",
        event: "status-change",
        payload: { status: "RESOLVED", tier: "HUMAN" },
      })
    } catch (rtError) {
      console.error("[admin/chat] Realtime broadcast error:", rtError)
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: updatedSession.id,
          status: updatedSession.status,
          tier: updatedSession.tier,
        },
      },
    })
  } catch (error) {
    console.error("[admin/chat/[sessionId]] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update session." },
      { status: 500 }
    )
  }
}

// ── DELETE: Permanently delete session + all messages (OWNER only) ──
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  if (auth.role !== "OWNER") {
    return NextResponse.json(
      { success: false, error: "Only OWNER can permanently delete conversations." },
      { status: 403 }
    )
  }

  try {
    const { sessionId } = await params

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      )
    }

    // Explicitly delete messages first (safety net if DB cascade isn't applied)
    await prisma.chatMessage.deleteMany({ where: { sessionId } })
    await prisma.chatSession.delete({ where: { id: sessionId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/chat/[sessionId]] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete session." },
      { status: 500 }
    )
  }
}
