"use client"

// ══════════════════════════════════════════════════════════════════
// SageDecisionDetails — what the decision model answered for one reply
// Reads the metadata Sage saves with each reply: one line under the
// message, and the full answer when the line is clicked. Only the panel
// shows it, and only with the "technical details" setting on.
// ══════════════════════════════════════════════════════════════════

import { memo, useMemo, useState, type ReactNode } from "react"

type Choice = { choice: string; probabilities: Record<string, number> } | null
type Attempt = { via: string; ok: boolean; ms: number; reason?: string }

type Decision = {
  model?: string
  via?: string | null
  status?: "ok" | "fallback" | "failed"
  ms?: number
  attempts?: Attempt[]
  steps?: string[]
  reason?: string
  intent?: Choice
  wants?: Record<string, number>
  offTopic?: number
  order?: Choice
  menuScope?: Choice
  menuCount?: Choice
  language?: Choice
  replyLanguage?: "en" | "es" | "other"
  replyLanguageFrom?: "greeting" | "message" | "conversation" | "page"
  dishes?: { id: string; name: string; p: number }[]
  dishesBelow?: { count: number; max: number }
}

type Writer = {
  model?: string
  ms?: number
  priceGuard?: boolean
  fallbackText?: boolean
  failed?: boolean
  called?: string[]
  continued?: boolean
  dropped?: boolean
  reasoningTokens?: number
}

/** The same threshold the storefront's rules use for a dish. */
const DISH_THRESHOLD = 0.5

const VIA_LABELS: Record<string, string> = { openrouter: "OpenRouter", typesafe: "TypeSafe, the fallback key" }
const REASON_LABELS: Record<string, string> = {
  single: "one request",
  several_ordered: "several requests, in the order the guest gave",
  several_default_order: "several requests, the ones answered at once first",
  two_conversational: "two requests that both go on over the next messages: tie-break",
  nothing_clear: "nothing clear: tie-break",
  off_topic: "unrelated to Wild Grove: fixed refusal",
  jev_failed: "the decision model did not answer: apology",
}

const REPLY_FROM: Record<string, string> = {
  greeting: "from the greeting",
  message: "from the message",
  conversation: "from the conversation",
  page: "from the page",
}

const pct = (p: number) => `${Math.round(p * 100)}%`
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`

function topOf(choice: Choice): [string, number] | null {
  if (!choice) return null
  const entries = Object.entries(choice.probabilities).sort((a, b) => b[1] - a[1])
  return entries[0] ?? null
}

function choiceLine(choice: Choice, limit = 3): string {
  if (!choice) return "—"
  const entries = Object.entries(choice.probabilities).sort((a, b) => b[1] - a[1])
  const shown = entries.slice(0, limit).map(([key, p]) => `${key} ${pct(p)}`)
  const rest = entries.slice(limit).reduce((sum, [, p]) => sum + p, 0)
  return rest >= 0.01 ? `${shown.join(" · ")} · others ${pct(rest)}` : shown.join(" · ")
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <span className="opacity-60">{label}</span>
      <span className="break-words">{children}</span>
    </div>
  )
}

export const SageDecisionDetails = memo(function SageDecisionDetails({
  metadata,
  cardCount,
}: {
  metadata: Record<string, unknown> | null | undefined
  /** Dish cards in this message. */
  cardCount: number
}) {
  const [open, setOpen] = useState(false)
  const decision = metadata?.decision as Decision | undefined
  const writer = metadata?.writer as Writer | undefined

  const summary = useMemo(() => {
    if (!decision) return null
    const parts: string[] = []
    if (decision.status === "failed") {
      parts.push("Decision model did not answer: apology sent")
    } else {
      const intent = topOf(decision.intent ?? null)
      if (intent) parts.push(`${intent[0]} ${pct(intent[1])}`)
      const steps = decision.steps ?? []
      if (steps.some((step) => step.startsWith("menu"))) {
        const scope = topOf(decision.menuScope ?? null)
        if (scope) parts.push(`${scope[0]} ${pct(scope[1])}`)
      }
      if (cardCount > 0) parts.push(`${cardCount} ${cardCount === 1 ? "dish" : "dishes"}`)
      if (steps.includes("tiebreak")) parts.push("tie-break")
      if (steps.includes("decline")) parts.push("off topic: refused")
      if (decision.status === "fallback") parts.push("answered by the fallback key")
    }
    if (typeof decision.ms === "number") parts.push(seconds(decision.ms))
    return parts.join(" · ")
  }, [decision, cardCount])

  if (!decision || !summary) return null

  const wants = Object.entries(decision.wants ?? {})
    .filter(([, p]) => p >= 0.2)
    .sort((a, b) => b[1] - a[1])
  const dishes = decision.dishes ?? []
  const listed = dishes.filter((dish) => dish.p >= 0.05)
  const unlisted = dishes.length - listed.length + (decision.dishesBelow?.count ?? 0)
  const failures = (decision.attempts ?? []).filter((attempt) => !attempt.ok)
  // The dish answers decide something only for a filtered menu or one dish.
  const dishesUsed = (decision.steps ?? []).some((step) => step === "menu:filtered" || step === "dish")

  return (
    <div className="mt-1.5 text-[11px] leading-relaxed">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="opacity-70 hover:opacity-100 underline decoration-dotted underline-offset-2 text-left"
      >
        {summary}
      </button>
      {open && (
        <div className="mt-1.5 space-y-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-2 font-mono">
          <p className="font-semibold">
            Jev · {decision.model ?? "—"} · {decision.via ? `via ${VIA_LABELS[decision.via] ?? decision.via}` : "no answer"}
            {typeof decision.ms === "number" && ` · ${decision.ms} ms`}
          </p>
          {failures.length > 0 && (
            <Row label="Failed">
              {failures.map((attempt) => `${VIA_LABELS[attempt.via] ?? attempt.via}: ${attempt.reason ?? "error"}`).join(" · ")}
            </Row>
          )}
          {decision.status !== "failed" && (
            <>
              <Row label="Intent">{choiceLine(decision.intent ?? null)}</Row>
              <Row label="Asked for">{wants.length > 0 ? wants.map(([intent, p]) => `${intent} ${p.toFixed(2)}`).join(" · ") : "nothing above 0.20"}</Row>
              {typeof decision.offTopic === "number" && <Row label="Off topic">{decision.offTopic.toFixed(2)}</Row>}
              <Row label="Order">{choiceLine(decision.order ?? null, 2)}</Row>
              <Row label="Scope">{choiceLine(decision.menuScope ?? null)}</Row>
              <Row label="Count">{choiceLine(decision.menuCount ?? null, 2)}</Row>
              <Row label="Language">
                {choiceLine(decision.language ?? null)}
                {decision.replyLanguage && decision.language?.choice !== decision.replyLanguage
                  ? ` · used ${decision.replyLanguage}`
                  : ""}
                {decision.replyLanguageFrom
                  ? ` · ${REPLY_FROM[decision.replyLanguageFrom] ?? decision.replyLanguageFrom}`
                  : ""}
              </Row>
              <Row label="Dishes">
                {listed.length > 0
                  ? listed.map((dish) => `${dishesUsed && dish.p >= DISH_THRESHOLD ? "✓ " : ""}${dish.name} ${pct(dish.p)}`).join(" · ")
                  : "none above 5%"}
                {!dishesUsed && " (not used: no filter in this reply)"}
                {unlisted > 0 &&
                  ((decision.dishesBelow?.max ?? 0) >= 0.05
                    ? ` · (${unlisted} more, none above ${pct(decision.dishesBelow?.max ?? 0)})`
                    : ` · (${unlisted} more, all below 5%)`)}
              </Row>
            </>
          )}
          <Row label="Steps">
            {(decision.steps ?? []).join(", ") || "—"}
            {decision.reason && ` (${REASON_LABELS[decision.reason] ?? decision.reason})`}
          </Row>
          {writer && (
            <p className="pt-1 font-semibold">
              Writer · {writer.model ?? "—"}
              {typeof writer.ms === "number" && ` · ${seconds(writer.ms)}`}
              {` · price guard: ${writer.priceGuard ? "triggered" : "did not trigger"}`}
              {writer.failed ? " · the writer failed" : ""}
              {writer.fallbackText ? " · text written by the code" : ""}
              {writer.called && writer.called.length > 0 ? ` · tools: ${writer.called.join(", ")}` : ""}
              {writer.continued ? " · cut by the token limit, continued" : ""}
              {writer.dropped ? " · cut by the token limit, trimmed to the last full sentence" : ""}
              {typeof writer.reasoningTokens === "number" ? ` · reasoning: ${writer.reasoningTokens} tokens` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  )
})
