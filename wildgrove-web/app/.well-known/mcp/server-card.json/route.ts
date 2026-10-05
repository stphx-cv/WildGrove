// ══════════════════════════════════════════════════════════════════
// GET /.well-known/mcp/server-card.json — MCP Server Card.
//
// Describes the server that actually answers at /api/agent/mcp, with
// the tool names it actually registers.
//
// The schema is still being standardised (SEP-1649, an unmerged PR on
// modelcontextprotocol/modelcontextprotocol). Expect to republish this
// document when it lands.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"

export async function GET() {
    const card = {
        serverInfo: {
            name: "wildgrove",
            version: "1.0.0",
            title: "Wild Grove",
            description:
                "Read-only access to Wild Grove's menu, opening hours, reservation availability and guest reviews. Wild Grove is a fictional restaurant built as a portfolio project.",
            websiteUrl: SITE_URL,
        },
        transport: {
            type: "streamable-http",
            url: `${SITE_URL}/api/agent/mcp`,
        },
        // Mirrors what the server actually advertises on `initialize`. The SDK
        // sets listChanged itself; do not assert a different value here.
        capabilities: {
            tools: { listChanged: true },
        },
        tools: [
            { name: "search_menu", description: "Dishes on the published menu, optionally filtered by a search term." },
            { name: "get_venue_info", description: "Opening hours, address, phone, email and social networks." },
            { name: "check_availability", description: "Whether a party can still book a given date and time. Read-only." },
            { name: "get_reviews", description: "Approved guest reviews, newest first." },
        ],
        // No authentication: every tool returns data already public on the site.
        authentication: { type: "none" },
    }

    return NextResponse.json(card, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
