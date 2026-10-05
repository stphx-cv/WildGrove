// ══════════════════════════════════════════════════════════════════
// Chat Session Management — Create, resume, escalate, resolve
// ══════════════════════════════════════════════════════════════════

import type OpenAI from "openai"
import { prisma } from "@wildgrove/db"
import type { Prisma, ChatSession, ChatMessage } from "@wildgrove/db"
import { createAdminNotificationForAllAdmins } from "../admin-notifications"
import { writerCallExtras, type WriterCallExtras } from "./ai-providers"
import { getSageAi } from "./provider"

// ── Generate a short AI title for the conversation list ──────────
// Called fire-and-forget after the first AI response so it doesn't
// block the stream. Generates only once (when summary is null).
export async function generateAndSaveSummary(sessionId: string): Promise<void> {
  try {
    // Only generate if no summary exists yet
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { summary: true },
    })
    if (!session || session.summary) return

    // Fetch the first 6 messages (enough context for a title)
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: { role: true, content: true },
    })
    if (messages.length < 2) return

    const transcript = messages
      .map((m) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`)
      .join("\n")

    const ai = await getSageAi()
    const titleBody: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & WriterCallExtras = {
      // A title is three lines of context; the CMS can point it at a cheaper model.
      model: ai.summaryModel,
      messages: [
        {
          role: "system",
          content:
            "You are a conversation titler. Given a chat transcript, respond with a single short title (5–8 words max) that captures what the conversation is about. No punctuation at the end. No quotes. Just the title.",
        },
        { role: "user", content: transcript },
      ],
      // Reasoning counts against this cap; the title stays short because the prompt asks for it.
      max_tokens: 300,
      temperature: 0.3,
      ...writerCallExtras(ai.provider),
    }
    const res = await ai.client.chat.completions.create(titleBody)

    const summary = res.choices[0]?.message?.content?.trim()
    if (!summary) return

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { summary },
    })
  } catch {
    // silent — summary is best-effort, doesn't affect core functionality
  }
}

// ── A session that belongs to another account ────────────────────
// A key alone opens a guest session. Once a session is linked to a profile,
// only that profile reads it or writes to it.
export class ChatSessionNotOwnedError extends Error {
  constructor() {
    super("Session not found.")
    this.name = "ChatSessionNotOwnedError"
  }
}

// ── An existing session, only for whoever may open it ────────────
// The same rule as getOrCreateSession, without creating anything: null when
// no session has the key, and ChatSessionNotOwnedError when another account
// holds it.
export async function getOwnedSession(
  sessionKey: string,
  profileId?: string
): Promise<ChatSession | null> {
  const session = await prisma.chatSession.findUnique({ where: { sessionKey } })
  if (!session) return null
  if (session.profileId && session.profileId !== profileId) {
    throw new ChatSessionNotOwnedError()
  }
  return session
}

// ── Get or create a chat session ─────────────────────────────────
export async function getOrCreateSession(
  sessionKey: string,
  locale: string = "en",
  profileId?: string
): Promise<ChatSession & { messages: ChatMessage[] }> {
  // Try to resume existing session
  const existing = await prisma.chatSession.findUnique({
    where: { sessionKey },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50, // the last 50 messages, newest first here
      },
    },
  })

  if (existing) {
    // Oldest first, as the widget shows them.
    existing.messages.reverse()

    if (existing.profileId && existing.profileId !== profileId) {
      throw new ChatSessionNotOwnedError()
    }

    // If user just logged in, link profile to anonymous session
    if (profileId && !existing.profileId) {
      await prisma.chatSession.update({
        where: { id: existing.id },
        data: { profileId },
      })
    }
    return existing
  }

  // Create new session
  const created = await prisma.chatSession.create({
    data: {
      sessionKey,
      locale,
      profileId: profileId || undefined,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  return created
}

// ── Save a message to the session ────────────────────────────────
export async function saveMessage(
  sessionId: string,
  role: "USER" | "ASSISTANT" | "AGENT" | "SYSTEM",
  content: string,
  tier: "FAQ" | "AI" | "HUMAN" = "AI",
  metadata?: Prisma.InputJsonValue
): Promise<ChatMessage> {
  // Check if this is the first USER message (before saving)
  const isFirstUserMessage =
    role === "USER" &&
    (await prisma.chatMessage.count({ where: { sessionId, role: "USER" } })) === 0

  // Update session's updatedAt timestamp
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  })

  const createdMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
      tier,
      metadata: metadata || undefined,
    },
  })

  // Notify admins only when the first user message arrives
  if (isFirstUserMessage) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { sessionKey: true, profileId: true },
    })
    createAdminNotificationForAllAdmins({
      type: "CHAT_SESSION_CREATED",
      entityType: "CHAT_SESSION",
      entityId: sessionId,
      title: "New chat session started",
      message: "A new chat session has been created.",
      href: "/chat",
      metadata: {
        sessionId,
        sessionKey: session?.sessionKey ?? null,
        profileId: session?.profileId ?? null,
      },
    }).catch((e) => console.error("[chat/session] Create session notification error:", e))
  }

  return createdMessage
}

// ── Escalate to human agent ──────────────────────────────────────
export async function escalateToHuman(
  sessionId: string,
  locale: string = "en"
): Promise<ChatSession> {
  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: "WAITING",
      tier: "HUMAN",
    },
  })

  // Insert system message
  const systemMsg =
    locale === "es"
      ? "Esperando a alguien del equipo."
      : "Waiting for someone from the team."

  await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

  createAdminNotificationForAllAdmins({
    type: "CHAT_ESCALATED",
    entityType: "CHAT_SESSION",
    entityId: sessionId,
    title: "Chat escalated to human",
    message: "A customer is requesting a human agent.",
    href: "/chat",
    metadata: { sessionId, profileId: session.profileId ?? null },
  }).catch((e) => console.error("[chat/session] Escalation notification error:", e))

  return session
}

// ── Admin joins a session ────────────────────────────────────────
export async function adminJoinSession(
  sessionId: string,
  adminId: string,
  locale: string = "en"
): Promise<ChatSession> {
  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: "AGENT_JOINED",
      adminId,
    },
  })

  const systemMsg =
    locale === "es"
      ? "Alguien del equipo entró al chat."
      : "Someone from the team joined the chat."

  await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

  return session
}

// ── Resolve a session ────────────────────────────────────────────
export async function resolveSession(
  sessionId: string,
  locale: string = "en"
): Promise<ChatSession> {
  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: "RESOLVED" },
  })

  const systemMsg =
    locale === "es"
      ? "Esta conversación ha sido resuelta."
      : "This conversation has been resolved."

  await saveMessage(sessionId, "SYSTEM", systemMsg, "HUMAN")

  return session
}

// ── Rate limiting check ──────────────────────────────────────────
export async function checkRateLimit(
  sessionKey: string,
  windowMs: number = 60_000,
  maxMessages: number = 10
): Promise<boolean> {
  const count = await prisma.chatMessage.count({
    where: {
      session: { sessionKey },
      role: "USER",
      createdAt: { gte: new Date(Date.now() - windowMs) },
    },
  })
  return count < maxMessages
}

// ── AI-specific rate limiting ────────────────────────────────────
// A page brought by "See N more" calls no model, so it does not count.
// It is subtracted rather than filtered out: a JSON path filter drops the
// rows whose metadata is empty, and those are most of them.
export async function checkAIRateLimit(
  sessionId: string,
  windowMs: number = 5 * 60_000,
  maxAIResponses: number = 5
): Promise<boolean> {
  const where = {
    sessionId,
    tier: "AI" as const,
    role: "ASSISTANT" as const,
    createdAt: { gte: new Date(Date.now() - windowMs) },
  }
  const [all, menuPages] = await Promise.all([
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.count({ where: { ...where, metadata: { path: ["source"], equals: "menu_more" } } }),
  ])
  return all - menuPages < maxAIResponses
}
