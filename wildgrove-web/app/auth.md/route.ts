// ══════════════════════════════════════════════════════════════════
// GET /auth.md — Wild Grove's authentication posture, for agents.
//
// The auth.md convention describes how an agent registers and obtains
// credentials. Wild Grove has no such flow, and this document says so
// plainly rather than describing one that does not exist.
//
// It earns its place by answering the question an agent actually came
// with: what can I do here on my own, and where does that stop.
//
// The H1 must contain "auth.md" — that is what identifies the document
// as this one, and a validator that checks for it is right to.
// Plan 05, added after the close-out.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"

const DOCUMENT = `# auth.md — Wild Grove

**There is no authentication, and no agent registration.** Nothing here issues
credentials, and there is no authorization server to negotiate with. If you are
looking for a token, stop looking — you do not need one, and none exists.

Wild Grove is a fictional restaurant in Lima, Peru, built as a portfolio
project.

## What you can do without credentials

Everything the agent surface exposes is public and read-only. No key, no
header, no registration.

| Resource | Where |
|---|---|
| MCP server (Streamable HTTP) | \`${SITE_URL}/api/agent/mcp\` |
| HTTP API (base path) | \`${SITE_URL}/api/agent/v1/\` |
| OpenAPI contract | \`${SITE_URL}/openapi.json\` |
| Capability manifest | \`${SITE_URL}/.well-known/ai-catalog.json\` |
| Published skills | \`${SITE_URL}/.well-known/agent-skills/index.json\` |

The MCP endpoint answers \`406\` to a plain \`GET\`: Streamable HTTP requires
\`Accept: application/json, text/event-stream\`. That is the protocol, not a fault.
The API row is a prefix — \`/openapi.json\` lists the four endpoints beneath it.

Any public page also answers in Markdown:

\`\`\`
curl -H 'Accept: text/markdown' ${SITE_URL}/en/menu
\`\`\`

## What you cannot do, and what to do instead

**Booking a table, placing an order, and reading a customer's own reservations,
orders or wallet are closed to agents.** Not rate-limited, not gated behind a
key you could request — there is no mechanism, by design.

Those actions need a signed-in person, in a browser:

- Reserve a table: ${SITE_URL}/en/reservations
- Browse and order: ${SITE_URL}/en/menu

If a person asks you to book a table, the useful answer is to check
availability with \`check_availability\` (or \`GET /api/agent/v1/availability\`),
tell them which slots are free, and hand them the reservations link. Do not
attempt to submit the form on their behalf; you will be redirected to a login
you cannot complete.

## Why it is built this way

Agent-authenticated writes need an authorization server, a consent flow, scopes
and abuse limits. Wild Grove has none of those, and publishing OAuth discovery
metadata for an authorization server that does not exist would describe
infrastructure you cannot use. So this document says what is true instead.

If that changes, this file changes with it.

## Content usage

Declared in \`${SITE_URL}/robots.txt\`:

\`\`\`
Content-Signal: search=yes, ai-input=yes, ai-train=no
\`\`\`

Indexing and reading this site to answer someone's question are welcome.
Training on its content is not. That is a preference, not an access control.
`

export async function GET() {
    return new NextResponse(DOCUMENT, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
