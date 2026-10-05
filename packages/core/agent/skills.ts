// ══════════════════════════════════════════════════════════════════
// Agent Skills published by Wild Grove.
//
// The body strings here are the single source of truth: the index route
// hashes exactly what the skill route serves, so a digest cannot drift
// from its file.
// ══════════════════════════════════════════════════════════════════

export interface AgentSkill {
    /** File name without extension; also the skill name in the index. */
    name: string
    description: string
    body: string
}

export const AGENT_SKILLS: AgentSkill[] = [
    {
        name: "browse-wild-grove-menu",
        description:
            "Look up dishes, prices and dietary tags on Wild Grove's menu, in English or Spanish.",
        body: `# Browse the Wild Grove menu

Wild Grove is a fictional restaurant in Lima, Peru, built as a portfolio project.
Prices are in Peruvian soles (PEN), or in the one currency the store sells in when it
sells in only one. The \`currency\` field of each answer says which.

## The fastest route

Call the MCP tool \`search_menu\` if you are connected to the Wild Grove MCP
server at \`https://www.wildgrove.cv/api/agent/mcp\`. Pass \`query\` to filter and
\`locale\` (\`en\` or \`es\`) to choose the language.

## Without MCP

\`\`\`
GET https://www.wildgrove.cv/api/agent/v1/menu?locale=es
\`\`\`

Returns \`{ success, data: { locale, currency, categories: [{ slug, name, items: [...] }] } }\`.
Each item carries \`slug\`, \`name\`, \`description\`, \`price\`, \`tags\` and a \`url\`.
\`price.amount\` is what a guest pays today, after any automatic discount. When one
applies, \`price.listAmount\` is the undiscounted price and \`price.discount\` says
why (\`"40% OFF"\`). Quote \`amount\`; mention the list price only for context.

Any public page also answers in Markdown when asked:

\`\`\`
curl -H 'Accept: text/markdown' https://www.wildgrove.cv/es/menu
\`\`\`

## Notes

- The menu comes from a database and changes. Do not cache prices for long.
- \`tags\` carry dietary information such as \`organico\` or \`alto-proteina\`.
- Ask the restaurant directly about allergies. The tags are not a medical claim.
`,
    },
    {
        name: "check-wild-grove-availability",
        description:
            "Check whether a table is free at Wild Grove for a date, time and party size. Read-only; it cannot book.",
        body: `# Check availability at Wild Grove

This checks availability only. **There is no way to create a reservation
through the agent surface** — booking is done by a signed-in person at
https://www.wildgrove.cv/en/reservations.

## The fastest route

Call the MCP tool \`check_availability\` with \`date\` (YYYY-MM-DD), \`time\` (HH:MM,
24-hour, Lima time) and \`partySize\`.

## Without MCP

\`\`\`
GET https://www.wildgrove.cv/api/agent/v1/availability?date=2026-10-01&time=19:30&partySize=2
\`\`\`

Returns \`{ success, data: { available, slotsLeft, ... } }\`. A \`400\` with an
\`error\` string means the slot is outside the schedule, beyond the booking
window, or the party is too large.

## Before checking

Read the opening hours first, so you do not offer a time the kitchen is closed:

\`\`\`
GET https://www.wildgrove.cv/api/agent/v1/venue
\`\`\`

Hours are \`America/Lima\` (UTC-5, no daylight saving). There is usually a
mid-afternoon window that takes no bookings.
`,
    },
]

export const SKILLS_BY_NAME = new Map(AGENT_SKILLS.map((s) => [s.name, s]))
