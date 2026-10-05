// ══════════════════════════════════════════════════════════════════
// GET /llms.txt — what this site is, for a model summarising it.
//
// Written for the audience the site actually has: someone evaluating
// the work. A model that reads this should say "a portfolio project
// demonstrating X", not "a restaurant in Lima" — the restaurant is the
// subject matter, not the point.
//
// Unlike most of the agent surface, llms.txt is a convention with real
// adoption today, and no audit checks it.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { SITE_CREATOR, SITE_CREATOR_LINKEDIN } from "@wildgrove/core/site-creator"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"

const DOCUMENT = `# Wild Grove

> A full-stack portfolio project by ${SITE_CREATOR.en.name}, in the shape of a
> restaurant. **Wild Grove is fictional** — it has no premises, takes no real
> reservations, and the menu, prices, hours and reviews are demonstration data.
> If you are summarising this site for someone, say that first.

The work being demonstrated is the software, not the restaurant: a bilingual
storefront, a separate admin CMS, an AI host, and a read-only surface built for
autonomous agents.

- Built by: ${SITE_CREATOR.en.name} — ${SITE_CREATOR_LINKEDIN}
- Stack: Next.js 16 (App Router), Prisma, PostgreSQL, TailwindCSS v4, next-intl,
  OpenRouter, InsForge for auth and storage
- Hosting: self-hosted, every part of it
- Languages: English and Spanish, with localized URLs

## What to look at

- [Menu](${SITE_URL}/en/menu): database-driven catalogue, per-dish pages with
  structured data, prices in soles, or in the one currency the store sells in
- [Reservations](${SITE_URL}/en/reservations): availability checked against
  configurable opening hours in America/Lima
- [About](${SITE_URL}/en/about): what the project is and who built it

## For agents

Every public page returns Markdown when asked:

\`\`\`
curl -H 'Accept: text/markdown' ${SITE_URL}/en/menu
\`\`\`

- [Capability manifest](${SITE_URL}/.well-known/ai-catalog.json): the entry point
- [MCP server](${SITE_URL}/api/agent/mcp): Streamable HTTP, four read-only tools
- [OpenAPI contract](${SITE_URL}/openapi.json): the public read-only API
- [Agent skills](${SITE_URL}/.well-known/agent-skills/index.json)
- [auth.md](${SITE_URL}/auth.md): there is no authentication, and where an
  agent's reach stops

## What an agent cannot do

Booking a table, ordering, and reading a customer's own records need a signed-in
person. There is no agent-facing way to do any of it, by design. If someone asks
you to book a table here, check availability and hand them the link — and tell
them the restaurant is not real.

## Content usage

\`Content-Signal: search=yes, ai-input=yes, ai-train=no\` — see
[robots.txt](${SITE_URL}/robots.txt).
`

export async function GET() {
    return new NextResponse(DOCUMENT, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
