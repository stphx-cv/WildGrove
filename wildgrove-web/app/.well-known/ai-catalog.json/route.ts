// ══════════════════════════════════════════════════════════════════
// GET /.well-known/ai-catalog.json — ARD capability manifest.
//
// Three entries, and every url answers a plain GET: the OpenAPI contract,
// the MCP server card, and the skills index.
//
// The key is `identifier`, not `id` — the first version used `id` and the
// whole manifest was rejected with "entry 0 is missing identifier".
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"
const HOST = new URL(SITE_URL).hostname.replace(/^www\./, "")

export async function GET() {
    const catalog = {
        specVersion: "0.1",
        host: {
            name: "Wild Grove",
            domain: HOST,
            url: SITE_URL,
            description:
                "A fictional restaurant in Lima, Peru, built as a portfolio project. Menu, reservations and guest reviews, in English and Spanish.",
        },
        entries: [
            {
                identifier: `urn:air:${HOST}:api:agent-v1`,
                displayName: "Wild Grove agent API",
                description:
                    "Read-only HTTP API: the menu, opening hours and contact details, reservation availability, and approved guest reviews.",
                type: "application/openapi+json",
                url: `${SITE_URL}/openapi.json`,
                representativeQueries: [
                    "What is on the menu at Wild Grove?",
                    "How much does the lomo saltado cost?",
                    "What time does Wild Grove open on Sunday?",
                    "Is there a table free on Friday at 8pm?",
                ],
            },
            {
                identifier: `urn:air:${HOST}:mcp:wildgrove`,
                displayName: "Wild Grove MCP server",
                description:
                    "Streamable HTTP MCP server with four read-only tools: search_menu, get_venue_info, check_availability and get_reviews.",
                // Points at the card, not at the endpoint: the spec's own
                // example does, and the MCP endpoint answers 406 to a plain GET
                // because Streamable HTTP requires an Accept it will not guess.
                type: "application/mcp-server-card+json",
                url: `${SITE_URL}/.well-known/mcp/server-card.json`,
                representativeQueries: [
                    "Find a vegetarian dish at Wild Grove",
                    "Check if Wild Grove has space for four people tomorrow",
                    "What do guests say about Wild Grove?",
                ],
            },
            {
                identifier: `urn:air:${HOST}:skills:index`,
                displayName: "Wild Grove agent skills",
                description:
                    "Published skills describing how to browse the menu and how to check reservation availability.",
                type: "application/json",
                url: `${SITE_URL}/.well-known/agent-skills/index.json`,
                representativeQueries: [
                    "How do I look up the Wild Grove menu?",
                    "How do I check availability at Wild Grove?",
                ],
            },
        ],
    }

    return NextResponse.json(catalog, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
