// ══════════════════════════════════════════════════════════════════
// Sage AI | What the storefront knows about its keys and the decision model
// The keys live only in the storefront's environment. The panel asks
// through GET /api/chat/status and gets yes or no, never a value. The
// last answer and the last failure of the decision model are read from
// the metadata Sage saves with each reply, so nothing else is stored.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "@wildgrove/db"
import { AI_PROVIDER_ENV_VARS } from "./ai-providers"
import { getSageAiConfig } from "./provider"
import { OPENROUTER_API_KEY_ENV, TYPESAFE_API_KEY_ENV, type ChatStatus } from "./chat-settings"

function hasEnv(name: string): boolean {
  return (process.env[name] ?? "").trim() !== ""
}

type DecisionMeta = {
  status?: unknown
  via?: unknown
  attempts?: unknown
}

function readDecision(metadata: unknown): DecisionMeta | null {
  if (!metadata || typeof metadata !== "object") return null
  const decision = (metadata as { decision?: unknown }).decision
  return decision && typeof decision === "object" ? (decision as DecisionMeta) : null
}

/** The reason of the first attempt that failed, as the decision client recorded it. */
function firstFailureReason(decision: DecisionMeta): string {
  if (Array.isArray(decision.attempts)) {
    for (const attempt of decision.attempts) {
      if (attempt && typeof attempt === "object" && (attempt as { ok?: unknown }).ok === false) {
        const reason = (attempt as { reason?: unknown }).reason
        if (typeof reason === "string") return reason
      }
    }
  }
  return "unknown"
}

async function latestWithStatus(statuses: string[]) {
  return prisma.chatMessage.findFirst({
    where: {
      role: "ASSISTANT",
      OR: statuses.map((status) => ({ metadata: { path: ["decision", "status"], equals: status } })),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, metadata: true },
  })
}

export async function readChatStatus(): Promise<ChatStatus> {
  const writerKeys = {
    openai: hasEnv(AI_PROVIDER_ENV_VARS.openai),
    openrouter: hasEnv(AI_PROVIDER_ENV_VARS.openrouter),
    // A self-hosted endpoint may take no key at all; its base URL is checked when saved.
    custom: true,
  }

  const [config, answered, failed] = await Promise.all([
    getSageAiConfig(),
    latestWithStatus(["ok", "fallback"]),
    latestWithStatus(["fallback", "failed"]),
  ])

  const answeredDecision = answered ? readDecision(answered.metadata) : null
  const failedDecision = failed ? readDecision(failed.metadata) : null

  return {
    writerKey: writerKeys[config.provider],
    writerKeys,
    decisionKeys: {
      openrouter: hasEnv(OPENROUTER_API_KEY_ENV),
      typesafe: hasEnv(TYPESAFE_API_KEY_ENV),
    },
    lastDecision:
      answered && answeredDecision
        ? { at: answered.createdAt.toISOString(), via: typeof answeredDecision.via === "string" ? answeredDecision.via : "unknown" }
        : null,
    lastFailure:
      failed && failedDecision
        ? { at: failed.createdAt.toISOString(), reason: firstFailureReason(failedDecision) }
        : null,
  }
}
