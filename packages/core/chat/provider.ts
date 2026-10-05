// ══════════════════════════════════════════════════════════════════
// Sage's AI client — resolved from AppSettings at request time
// Any OpenAI-compatible endpoint (OpenAI, OpenRouter, custom) works,
// so switching provider is a CMS change, not a deploy.
// ══════════════════════════════════════════════════════════════════

import { cache } from "react"
import { unstable_cache } from "next/cache"
import OpenAI from "openai"
import { prisma } from "@wildgrove/db"
import {
  AI_DEFAULTS,
  AI_PROVIDER_BASE_URLS,
  AI_PROVIDER_ENV_VARS,
  AI_PROVIDER_LABELS,
  isAiProvider,
  isValidCustomBaseUrl,
  type AiProvider,
} from "./ai-providers"
import { DEFAULT_SAGE_DECISION_MODEL, toSageMenuDefaultCount, toSageMenuPageSize } from "./chat-settings"

export type SageAiConfig = {
  provider: AiProvider
  baseUrl: string
  model: string
  /** Conversation titles. Falls back to `model` when the CMS leaves it blank. */
  summaryModel: string
  temperature: number
  maxTokens: number
  /** Cards when the guest names no number. Never above `menuMaxCount`. */
  menuDefaultCount: number
  /** The most dish cards one message may hold. */
  menuMaxCount: number
  /** The decision model that reads each message before Sage answers. */
  decisionModel: string
}

// Same "app-settings" tag the CMS drops on save (and pings the storefront for),
// so a provider change takes effect without a redeploy. Read separately from
// getAppSettings() so the storefront's every-page settings payload stays as it was.
const readAiConfig = unstable_cache(
  async function readAiConfig(): Promise<SageAiConfig> {
    const row = await prisma.appSettings.findUnique({
      where: { key: "global" },
      select: {
        aiProvider: true,
        aiBaseUrl: true,
        aiModel: true,
        aiSummaryModel: true,
        aiTemperature: true,
        aiMaxTokens: true,
        sageMenuPageSize: true,
        sageMenuDefaultCount: true,
        sageDecisionModel: true,
      },
    })

    const provider = isAiProvider(row?.aiProvider) ? row.aiProvider : AI_DEFAULTS.aiProvider
    const customBaseUrl = (row?.aiBaseUrl ?? "").trim()
    const model = (row?.aiModel ?? "").trim() || AI_DEFAULTS.aiModel

    return {
      provider,
      baseUrl: provider === "custom" ? customBaseUrl : AI_PROVIDER_BASE_URLS[provider],
      model,
      summaryModel: (row?.aiSummaryModel ?? "").trim() || model,
      // Decimal does not survive the cache's serialization — convert here, not at the call site.
      temperature: row?.aiTemperature != null ? Number(row.aiTemperature) : AI_DEFAULTS.aiTemperature,
      maxTokens: row?.aiMaxTokens ?? AI_DEFAULTS.aiMaxTokens,
      menuMaxCount: toSageMenuPageSize(row?.sageMenuPageSize),
      menuDefaultCount: toSageMenuDefaultCount(row?.sageMenuDefaultCount, toSageMenuPageSize(row?.sageMenuPageSize)),
      decisionModel: (row?.sageDecisionModel ?? "").trim() || DEFAULT_SAGE_DECISION_MODEL,
    }
  },
  ["sage-ai-config"],
  { tags: ["app-settings"], revalidate: 300 },
)

export const getSageAiConfig = cache(readAiConfig)

function resolveApiKey(provider: AiProvider): string {
  const key = (process.env[AI_PROVIDER_ENV_VARS[provider]] ?? "").trim()
  if (key) return key

  // A self-hosted endpoint (Ollama, vLLM) authenticates nothing; the SDK still
  // insists on a non-empty key, so give it one rather than refusing to start.
  if (provider === "custom") return "not-required"

  throw new Error(
    `Sage is configured to use ${AI_PROVIDER_LABELS[provider]}, but ${AI_PROVIDER_ENV_VARS[provider]} is not set on the server.`,
  )
}

// One client per resolved endpoint. The signature covers everything the
// constructor reads, so a CMS change swaps the client on the next request.
let cachedClient: { signature: string; client: OpenAI } | null = null

function buildClient(config: SageAiConfig): OpenAI {
  if (config.provider === "custom" && !isValidCustomBaseUrl(config.baseUrl)) {
    throw new Error(
      "Sage is configured to use a custom AI endpoint, but its base URL is missing or not a valid https URL.",
    )
  }

  const apiKey = resolveApiKey(config.provider)
  const signature = `${config.provider}|${config.baseUrl}|${apiKey}`
  if (cachedClient?.signature === signature) return cachedClient.client

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseUrl || undefined,
    // OpenRouter attributes usage to the site behind these two headers. They
    // are ignored by every other OpenAI-compatible endpoint.
    //
    // ASCII only, both of them. A header value is a ByteString, so any
    // character above 255 makes the request throw before it is sent, and the
    // chat answers with its contact-us fallback for every visitor. An em dash
    // here did exactly that, and it failed only for OpenRouter, because no
    // other provider is sent these headers.
    defaultHeaders:
      config.provider === "openrouter"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv",
            "X-Title": "Wild Grove Sage",
          }
        : undefined,
  })

  cachedClient = { signature, client }
  return client
}

export type SageAiRuntime = SageAiConfig & { client: OpenAI }

/**
 * The client plus the model and sampling parameters it should be called with.
 * Throws when the configured provider has no key on this server — the chat
 * route turns that into the usual "contact us" fallback and logs the reason.
 */
export async function getSageAi(): Promise<SageAiRuntime> {
  const config = await getSageAiConfig()
  return { ...config, client: buildClient(config) }
}
