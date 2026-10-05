"use client"

// ══════════════════════════════════════════════════════════════════
// WebMCP — exposes Wild Grove's read-only tools to an agent driving
// this page in the browser.
//
// The same four tools the MCP server offers, reached through the public
// /api/agent/v1 endpoints so there is one contract, not two.
//
// The API is not in every browser. Everything here is behind a feature
// check: where `navigator.modelContext` is absent the component renders
// nothing and logs nothing.
// ══════════════════════════════════════════════════════════════════

import { useEffect } from "react"

interface ToolDefinition {
    name: string
    description: string
    inputSchema: Record<string, unknown>
    execute: (input: Record<string, unknown>) => Promise<{
        content: Array<{ type: "text"; text: string }>
    }>
}

interface ModelContext {
    provideContext: (context: { tools: ToolDefinition[] }) => void | Promise<void>
}

function hasModelContext(n: Navigator): n is Navigator & { modelContext: ModelContext } {
    const candidate = (n as Navigator & { modelContext?: unknown }).modelContext
    return (
        typeof candidate === "object" &&
        candidate !== null &&
        typeof (candidate as ModelContext).provideContext === "function"
    )
}

const asText = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
})

async function getJson(path: string): Promise<unknown> {
    const res = await fetch(path, { headers: { Accept: "application/json" } })
    return res.json()
}

/**
 * `locale` is a plain string because the layout has one: it is already
 * guarded there, and /api/agent/v1 falls back to the default locale for
 * anything it does not recognise. No cast needed to state that honestly.
 */
export function WebMcpTools({ locale }: { locale: string }) {
    useEffect(() => {
        if (typeof navigator === "undefined" || !hasModelContext(navigator)) return

        const tools: ToolDefinition[] = [
            {
                name: "search_menu",
                description:
                    "Dishes on Wild Grove's menu with prices, tags and links. Optionally filtered by a search term.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Text matched against dish names and descriptions.",
                        },
                    },
                },
                execute: async ({ query }) => {
                    const payload = (await getJson(
                        `/api/agent/v1/menu?locale=${locale}`
                    )) as {
                        data?: {
                            categories?: Array<{
                                name: string
                                items: Array<{ name: string; description: string }>
                            }>
                        }
                    }
                    const needle = String(query ?? "").trim().toLowerCase()
                    if (!needle) return asText(payload.data)

                    const categories = (payload.data?.categories ?? [])
                        .map((c) => ({
                            ...c,
                            items: c.items.filter((i) =>
                                `${i.name} ${i.description}`.toLowerCase().includes(needle)
                            ),
                        }))
                        .filter((c) => c.items.length > 0)
                    return asText({ ...payload.data, categories })
                },
            },
            {
                name: "get_venue_info",
                description:
                    "Opening hours, address, phone, email and social networks. Hours are Lima time.",
                inputSchema: { type: "object", properties: {} },
                execute: async () =>
                    asText(
                        ((await getJson(`/api/agent/v1/venue?locale=${locale}`)) as {
                            data?: unknown
                        }).data
                    ),
            },
            {
                name: "check_availability",
                description:
                    "Whether a party can still book a date and time. Read-only: it cannot create a reservation.",
                inputSchema: {
                    type: "object",
                    required: ["date", "time", "partySize"],
                    properties: {
                        date: { type: "string", description: "YYYY-MM-DD" },
                        time: { type: "string", description: "HH:MM, 24-hour, Lima time" },
                        partySize: { type: "integer", minimum: 1 },
                    },
                },
                execute: async ({ date, time, partySize }) => {
                    const query = new URLSearchParams({
                        date: String(date),
                        time: String(time),
                        partySize: String(partySize),
                    })
                    return asText(await getJson(`/api/agent/v1/availability?${query}`))
                },
            },
            {
                name: "get_reviews",
                description: "Approved guest reviews, newest first.",
                inputSchema: {
                    type: "object",
                    properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
                },
                execute: async ({ limit }) =>
                    asText(
                        ((await getJson(
                            `/api/agent/v1/reviews?limit=${Number(limit) || 10}`
                        )) as { data?: unknown }).data
                    ),
            },
        ]

        try {
            void navigator.modelContext.provideContext({ tools })
        } catch {
            // A browser that has the property but rejects the call is not an
            // error worth surfacing to a visitor who will never see these tools.
        }
    }, [locale])

    return null
}
