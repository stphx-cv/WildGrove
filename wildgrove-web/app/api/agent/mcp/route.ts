// ══════════════════════════════════════════════════════════════════
// Wild Grove MCP server — POST /api/agent/mcp
//
// Streamable HTTP, stateless, read-only. Every tool answers with data
// already public on the site, so there is nothing here to authenticate:
// a token guarding a menu would protect nothing.
//
// Imported through the SDK's web-standard transport, which speaks
// Request/Response. The SDK also ships express and hono transports; not
// importing them keeps both frameworks out of the serverless bundle.
// ══════════════════════════════════════════════════════════════════

import { z } from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { resolveMenuCategoryDisplay } from "@wildgrove/core/menu-category-display"
import { agentPrice, formatAgentPrice, getAgentCurrency, getAgentDiscounts } from "@wildgrove/core/agent/pricing"
import { pickLocalized, itemSlug } from "@wildgrove/core/agent/markdown"
import {
    getAgentMenu,
    getAgentVenueFacts,
    getAgentAvailability,
    getAgentReviews,
} from "@wildgrove/core/agent/queries"
import { absoluteLocalizedUrl } from "@wildgrove/core/seo/alternates"

const localeArg = z
    .enum(["en", "es"])
    .default("en")
    .describe("Language for names and descriptions.")

function text(body: string) {
    return { content: [{ type: "text" as const, text: body }] }
}

function buildServer(): McpServer {
    const server = new McpServer({ name: "wildgrove", version: "1.0.0" })

    server.registerTool(
        "search_menu",
        {
            title: "Search the menu",
            description:
                "Dishes on Wild Grove's published menu, with today's price (after any automatic discount), tags and a link to each dish. Optionally filtered by a search term matched against names and descriptions.",
            inputSchema: {
                query: z
                    .string()
                    .optional()
                    .describe("Free text to match against dish names and descriptions."),
                locale: localeArg,
            },
        },
        async ({ query, locale }) => {
            const [categories, discounts, currency] = await Promise.all([getAgentMenu(), getAgentDiscounts(), getAgentCurrency()])
            const needle = query?.trim().toLowerCase()

            const lines: string[] = []
            for (const cat of categories) {
                const label = resolveMenuCategoryDisplay({
                    locale,
                    category: cat.name,
                    categoryEs: cat.nameEs,
                    categorySlug: cat.slug,
                })
                for (const item of cat.items) {
                    const name = pickLocalized(item.name, item.nameEs, locale)
                    const description = pickLocalized(
                        item.description,
                        item.descriptionEs,
                        locale
                    )
                    if (needle && !`${name} ${description}`.toLowerCase().includes(needle)) {
                        continue
                    }
                    const price = formatAgentPrice(agentPrice(item, discounts, currency))
                    const url = absoluteLocalizedUrl("/menu/[slug]" as never, locale, {
                        slug: itemSlug(item, locale),
                    } as never)
                    lines.push(`- [${label}] ${name} — ${price}\n  ${description}\n  ${url}`)
                }
            }

            if (lines.length === 0) {
                return text(
                    needle
                        ? `No dish matches "${query}".`
                        : "The menu is empty right now."
                )
            }
            return text(lines.join("\n"))
        }
    )

    server.registerTool(
        "get_venue_info",
        {
            title: "Opening hours and contact",
            description:
                "Wild Grove's opening hours, address, phone, email and social networks. Hours are Lima time (America/Lima).",
            inputSchema: { locale: localeArg },
        },
        async ({ locale }) => {
            const f = await getAgentVenueFacts(locale)
            return text(
                [
                    "Wild Grove — Lima, Peru (America/Lima)",
                    "",
                    "Opening hours:",
                    ...(f.openingHours.length ? f.openingHours.map((h) => `  ${h}`) : ["  not published"]),
                    "",
                    f.address ? `Address: ${f.address}` : null,
                    f.phone ? `Phone: ${f.phone}` : null,
                    f.email ? `Email: ${f.email}` : null,
                    ...f.socials.map((social) => `${social.network}: ${social.handle}`),
                ]
                    .filter((l) => l !== null)
                    .join("\n")
            )
        }
    )

    server.registerTool(
        "check_availability",
        {
            title: "Check reservation availability",
            description:
                "Whether a party can still book a given date and time. Read-only: it reports availability and never creates, holds or reveals a reservation. Booking is done by a person at the reservations page.",
            inputSchema: {
                date: z.string().describe("Calendar date as YYYY-MM-DD."),
                time: z.string().describe("Local time as HH:MM, 24-hour."),
                partySize: z.number().int().min(1).describe("Number of guests."),
            },
        },
        async ({ date, time, partySize }) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return text("date must be YYYY-MM-DD.")
            if (!/^\d{2}:\d{2}$/.test(time)) return text("time must be HH:MM.")

            const outcome = await getAgentAvailability({ date, time, partySize })
            if (!outcome.ok) return text(outcome.reason)

            return text(
                outcome.available
                    ? `Available: ${date} at ${time} for ${partySize}. ${outcome.slotsLeft} slot(s) left.`
                    : `Not available: ${date} at ${time} for ${partySize} is fully booked.`
            )
        }
    )

    server.registerTool(
        "get_reviews",
        {
            title: "Read guest reviews",
            description: "Approved guest reviews of Wild Grove, newest first.",
            inputSchema: {
                limit: z.number().int().min(1).max(50).default(5).describe("How many to return."),
            },
        },
        async ({ limit }) => {
            const { reviews, total } = await getAgentReviews(limit)
            if (reviews.length === 0) return text("No approved reviews yet.")
            return text(
                [
                    `${reviews.length} of ${total} approved reviews:`,
                    "",
                    ...reviews.map(
                        (r) =>
                            `- ${r.rating}/5 — ${r.name}${r.comment ? `\n  ${r.comment}` : ""}`
                    ),
                ].join("\n")
            )
        }
    )

    return server
}

async function handle(request: Request): Promise<Response> {
    // A fresh server and transport per request: stateless, which is what a
    // read-only surface on serverless functions should be.
    const server = buildServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
    })
    await server.connect(transport)
    return transport.handleRequest(request)
}

export const POST = handle
export const GET = handle
export const DELETE = handle
