// ══════════════════════════════════════════════════════════════════
// GET /.well-known/agent-skills/<name>.md — one published skill.
// The bytes hashed by index.json.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { SKILLS_BY_NAME } from "@wildgrove/core/agent/skills"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ skill: string }> }
) {
    const { skill } = await params
    const found = SKILLS_BY_NAME.get(skill.replace(/\.md$/, ""))
    if (!found) return new NextResponse("Not found", { status: 404 })

    return new NextResponse(found.body, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
