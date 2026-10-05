// ══════════════════════════════════════════════════════════════════
// GET /.well-known/api-catalog — RFC 9727 API catalog.
//
// Every href below answers.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv"

export async function GET() {
    const linkset = {
        linkset: [
            {
                anchor: `${SITE_URL}/api/agent/v1`,
                "service-desc": [
                    {
                        href: `${SITE_URL}/openapi.json`,
                        type: "application/openapi+json",
                        title: "Wild Grove agent API, OpenAPI 3.1",
                    },
                ],
                "service-doc": [
                    {
                        href: `${SITE_URL}/en/about`,
                        type: "text/html",
                        title: "About Wild Grove",
                    },
                ],
                status: [
                    {
                        href: `${SITE_URL}/api/agent/v1/status`,
                        type: "application/json",
                        title: "Agent API health",
                    },
                ],
            },
        ],
    }

    return NextResponse.json(linkset, {
        headers: {
            "Content-Type": "application/linkset+json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    })
}
