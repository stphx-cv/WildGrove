// ══════════════════════════════════════════════════════════════════
// Sage AI | The decision model's client
// Jev reads a state and typed questions and answers each one with a
// probability. It does not write text. It is called with fetch, first
// through OpenRouter's decisions API and, when that key is missing,
// fails or takes longer than 2 seconds, through TypeSafe's own API with
// an optional second key. When both fail the caller gets every attempt
// with its reason, and Sage apologizes instead of guessing.
// ══════════════════════════════════════════════════════════════════

import { OPENROUTER_API_KEY_ENV, TYPESAFE_API_KEY_ENV } from "../chat-settings"

export const JEV_ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/alpha/decisions",
  typesafe: "https://api.typesafe.ai/v1/systemone",
} as const

export type JevVia = keyof typeof JEV_ENDPOINTS

/** Instructions and criteria may be text or structured data the question cites by field name. */
type JevText = string | Record<string, unknown> | unknown[]

export type JevQuestion =
  | { type: "noul"; instructions: JevText; criteria?: { true?: JevText; false?: JevText } }
  | { type: "choice"; instructions: JevText; criteria: Record<string, JevText | null> }

export type JevNoulAnswer = { type: "noul"; noul: number }
export type JevChoiceAnswer = { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
export type JevAnswer = JevNoulAnswer | JevChoiceAnswer

export type JevAttempt = {
  via: JevVia
  ok: boolean
  ms: number
  /** no_key | timeout | network | http_<status> | bad_response */
  reason?: string
}

export type JevResult =
  | {
      ok: true
      via: JevVia
      /** The dated build that answered, as the API reports it. */
      model: string
      ms: number
      answers: Record<string, JevAnswer>
      attempts: JevAttempt[]
      costUsd?: number
    }
  | { ok: false; ms: number; attempts: JevAttempt[] }

export type JevOptions = {
  /** Per attempt. The plan fixes it at 2 seconds. */
  timeoutMs?: number
  /** Only for tests: other URLs for the two APIs. */
  endpoints?: Partial<Record<JevVia, string>>
}

const DEFAULT_TIMEOUT_MS = 2000

/**
 * The name TypeSafe's own API takes: without OpenRouter's "typesafe/" prefix,
 * and with ".0" on a version that has no patch number ("jev-1.13" is
 * "jev-1.13.0" there). Aliases such as "jev-latest" pass through.
 */
export function typesafeModelName(model: string): string {
  const bare = model.replace(/^~/, "").replace(/^typesafe\//, "")
  return /^jev-\d+\.\d+$/.test(bare) ? `${bare}.0` : bare
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

/** The answers, if every question got one of its own type; otherwise null. */
function readAnswers(body: unknown, questions: Record<string, JevQuestion>): Record<string, JevAnswer> | null {
  if (!body || typeof body !== "object") return null
  const answers = (body as { answers?: unknown }).answers
  if (!answers || typeof answers !== "object") return null
  const out: Record<string, JevAnswer> = {}
  for (const [id, question] of Object.entries(questions)) {
    const answer = (answers as Record<string, unknown>)[id] as Record<string, unknown> | undefined
    if (!answer || answer.type !== question.type) return null
    if (question.type === "noul") {
      if (!isProbability(answer.noul)) return null
      out[id] = { type: "noul", noul: answer.noul }
    } else {
      const probabilities = answer.probabilities
      if (typeof answer.choice !== "string" || !probabilities || typeof probabilities !== "object") return null
      out[id] = {
        type: "choice",
        choice: answer.choice,
        probabilities: probabilities as Record<string, number>,
        confidence: isProbability(answer.confidence) ? answer.confidence : 0,
      }
    }
  }
  return out
}

async function attempt(
  via: JevVia,
  url: string,
  key: string,
  body: Record<string, unknown>,
  questions: Record<string, JevQuestion>,
  timeoutMs: number,
): Promise<{ attempt: JevAttempt; answers?: Record<string, JevAnswer>; model?: string; costUsd?: number }> {
  const start = Date.now()
  const elapsed = () => Date.now() - start
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // OpenRouter attributes usage to the site behind these two. ASCII
        // only: a header is a ByteString, as in provider.ts.
        ...(via === "openrouter" && {
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv",
          "X-Title": "Wild Grove Sage",
        }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    })
    if (!res.ok) return { attempt: { via, ok: false, ms: elapsed(), reason: `http_${res.status}` } }
    const json: unknown = await res.json()
    const answers = readAnswers(json, questions)
    if (!answers) return { attempt: { via, ok: false, ms: elapsed(), reason: "bad_response" } }
    const reported = json as { model?: unknown; usage?: { cost?: unknown } }
    return {
      attempt: { via, ok: true, ms: elapsed() },
      answers,
      model: typeof reported.model === "string" ? reported.model : String(body.model),
      costUsd: typeof reported.usage?.cost === "number" ? reported.usage.cost : undefined,
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : ""
    const reason = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network"
    return { attempt: { via, ok: false, ms: elapsed(), reason } }
  }
}

/**
 * Ask every question in one call. OpenRouter first, then TypeSafe; each gets
 * `timeoutMs`, so with both keys failing the answer takes at most twice that.
 */
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  model: string,
  options: JevOptions = {},
): Promise<JevResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const start = Date.now()
  const attempts: JevAttempt[] = []

  const order: { via: JevVia; key: string; model: string }[] = [
    { via: "openrouter", key: (process.env[OPENROUTER_API_KEY_ENV] ?? "").trim(), model },
    { via: "typesafe", key: (process.env[TYPESAFE_API_KEY_ENV] ?? "").trim(), model: typesafeModelName(model) },
  ]

  for (const target of order) {
    if (!target.key) {
      attempts.push({ via: target.via, ok: false, ms: 0, reason: "no_key" })
      continue
    }
    const url = options.endpoints?.[target.via] ?? JEV_ENDPOINTS[target.via]
    const result = await attempt(target.via, url, target.key, { model: target.model, state, questions }, questions, timeoutMs)
    attempts.push(result.attempt)
    if (result.answers) {
      return {
        ok: true,
        via: target.via,
        model: result.model ?? target.model,
        ms: Date.now() - start,
        answers: result.answers,
        attempts,
        ...(result.costUsd !== undefined && { costUsd: result.costUsd }),
      }
    }
  }

  return { ok: false, ms: Date.now() - start, attempts }
}
