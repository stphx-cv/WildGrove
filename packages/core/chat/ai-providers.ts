// ══════════════════════════════════════════════════════════════════
// Sage's model providers — shared constants and validation
// No runtime imports: the CMS validates settings with this file
// without pulling in Prisma or the OpenAI SDK.
// ══════════════════════════════════════════════════════════════════

export const AI_PROVIDERS = ["openai", "openrouter", "custom"] as const

export type AiProvider = (typeof AI_PROVIDERS)[number]

/** Fixed endpoints. "custom" reads its base URL from AppSettings.aiBaseUrl. */
export const AI_PROVIDER_BASE_URLS: Record<AiProvider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
}

/** The env var each provider takes its key from. The key is never stored in the database. */
export const AI_PROVIDER_ENV_VARS: Record<AiProvider, string> = {
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  custom: "AI_PROVIDER_API_KEY",
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  custom: "Custom (OpenAI-compatible)",
}

/** Mirrors the column defaults in schema.prisma. */
export const AI_DEFAULTS = {
  aiProvider: "openai" as AiProvider,
  aiBaseUrl: "",
  aiModel: "gpt-4o-mini",
  aiSummaryModel: "",
  aiTemperature: 0.7,
  aiMaxTokens: 1600,
} as const

export const AI_TEMPERATURE_RANGE = { min: 0, max: 2 } as const
export const AI_MAX_TOKENS_RANGE = { min: 100, max: 4000 } as const

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value)
}

/**
 * A custom endpoint must be an absolute http(s) URL. Plain http is allowed only
 * for loopback hosts, so a self-hosted model can be reached in development
 * without opening the door to an unencrypted call over the public internet.
 */
export function isValidCustomBaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol === "https:") return true
  if (url.protocol !== "http:") return false
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"
}

/**
 * Model IDs are passed straight to the provider, so they are only checked for
 * shape: no spaces, no path traversal, and short enough to be a real ID.
 * OpenRouter uses "vendor/model", OpenAI uses "gpt-4o-mini".
 */
export function isValidModelId(value: string): boolean {
  return value.length > 0 && value.length <= 120 && /^[A-Za-z0-9._:/-]+$/.test(value)
}

/**
 * Extra fields on a call to the model that writes.
 * That model does not decide anything, Jev already did, and reasoning spent
 * the token cap before the reply was written. This model requires reasoning
 * and its default effort is the highest, so the call asks for the lowest
 * effort it accepts. OpenAI and a custom endpoint are left unchanged: they
 * reject parameters they do not know.
 */
export type OpenRouterReasoning = { effort: "low" }

/** Present only for OpenRouter. An empty object leaves the other providers unchanged. */
export type WriterCallExtras = { reasoning?: OpenRouterReasoning }

export function writerCallExtras(provider: AiProvider): WriterCallExtras {
  if (provider === "openrouter") return { reasoning: { effort: "low" } }
  return {}
}
