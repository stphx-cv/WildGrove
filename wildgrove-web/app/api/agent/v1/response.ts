// ══════════════════════════════════════════════════════════════════
// Shared shape for the public agent API.
//
// Not a route: Next only treats route.ts / page.tsx as routes, so this
// sits beside them.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { routing, type Locale } from "@wildgrove/core/i18n/routing"

/** Same envelope the rest of the app uses (`@wildgrove/core/types`). */
export function agentOk<T>(data: T, maxAge = 300): NextResponse {
    return NextResponse.json(
        { success: true, data },
        {
            headers: {
                // Open on purpose: this is public read-only data, and an agent
                // running in a browser has an origin the site cannot predict.
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=3600`,
            },
        }
    )
}

export function agentError(message: string, status: number): NextResponse {
    return NextResponse.json(
        { success: false, error: message },
        { status, headers: { "Access-Control-Allow-Origin": "*" } }
    )
}

/** `?locale=` if it names a real locale, the default otherwise. */
export function localeFrom(params: URLSearchParams): Locale {
    const raw = params.get("locale")
    return (routing.locales as readonly string[]).includes(raw ?? "")
        ? (raw as Locale)
        : routing.defaultLocale
}
