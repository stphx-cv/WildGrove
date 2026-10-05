// ══════════════════════════════════════════════════════════════════
// GET /.well-known/agent-skills/index.json — Agent Skills Discovery v0.2.0
//
// Digests are computed here from the same strings the skill route serves,
// so an index entry cannot describe a file that is no longer what it says.
// ══════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { AGENT_SKILLS } from "@wildgrove/core/agent/skills"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"

export async function GET() {
    const index = {
        $schema: "https://agentskills.io/schemas/index-v0.2.0.json",
        version: "0.2.0",
        publisher: { name: "Wild Grove", url: SITE_URL },
        skills: AGENT_SKILLS.map((skill) => ({
            name: skill.name,
            // `skill-md` and a prefixed `digest` are what v0.2.0 asks for;
            // `text/markdown` with a bare `sha256` parsed as zero valid entries.
            type: "skill-md",
            description: skill.description,
            url: `${SITE_URL}/.well-known/agent-skills/${skill.name}.md`,
            digest: `sha256:${createHash("sha256").update(skill.body, "utf8").digest("hex")}`,
        })),
    }

    return NextResponse.json(index, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
