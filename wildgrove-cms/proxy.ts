// ══════════════════════════════════════════════════════════════════
// CMS route protection.
//
// This host serves nothing public. Every path except /login and the auth
// endpoints requires a valid session whose Profile.role is ADMIN or OWNER —
// the guard that used to be the `/admin` block in wildgrove-web/proxy.ts.
//
// `insforge_*` cookies are host-only, so a storefront session does not carry
// over to cms.wildgrove.cv; this app issues its own.
//
// The Google callback is one of the auth endpoints: Google sends the browser
// back to it with no session. It checks Profile.role itself and leaves no
// session cookie behind for an account that is not staff
// (app/api/auth/callback/route.ts), so for that path the rule is applied there
// instead of here.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@insforge/sdk/ssr/middleware'
import { createServerClient } from '@insforge/sdk/ssr'
import { getInsforgeAnonKey, getInsforgeUrl } from '@wildgrove/core/insforge/env'
import { authCookieSettings } from '@wildgrove/core/insforge/cookies'
import { toAuthUser } from '@wildgrove/core/auth/types'

/**
 * Proxy instrumentation.
 *
 * Off unless `CMS_SERVER_TIMING=1`. When on, the proxy times its three steps —
 * the session refresh, the InsForge `getCurrentUser()` call and the PostgREST
 * role read — and emits them as `Server-Timing` on the response it returns, so
 * the Network panel says which of them the request is actually paying for.
 *
 * The header is a diagnostic, not a feature: it names no user and no token, and
 * the variable is set on a preview deployment only.
 */
const SERVER_TIMING_ENABLED = process.env.CMS_SERVER_TIMING === '1'

type ProxyMark = { name: string; dur: number }

/** Runs `step`, recording how long it took when instrumentation is on. */
async function timed<T>(marks: ProxyMark[], name: string, step: () => PromiseLike<T>): Promise<T> {
    if (!SERVER_TIMING_ENABLED) return step()

    const started = performance.now()
    try {
        return await step()
    } finally {
        marks.push({ name, dur: performance.now() - started })
    }
}

/** Writes the collected marks onto the response the proxy is about to return. */
function withServerTiming(
    response: NextResponse,
    marks: ProxyMark[],
    startedAt: number,
): NextResponse {
    if (!SERVER_TIMING_ENABLED) return response

    const entries = [...marks, { name: 'proxy', dur: performance.now() - startedAt }]
    response.headers.set(
        'Server-Timing',
        entries.map(({ name, dur }) => `${name};dur=${dur.toFixed(1)}`).join(', '),
    )
    return response
}

/** Paths reachable without a session. */
const PUBLIC_PATHS = new Set([
    '/login',
    '/api/auth/sign-in',
    '/api/auth/sign-out',
    '/api/auth/refresh',
    '/api/auth/session',
    '/api/auth/oauth/start',
    '/api/auth/callback',
])

function isPublic(pathname: string): boolean {
    return PUBLIC_PATHS.has(pathname)
}

function createInsforgeProxyClient(request: NextRequest) {
    return createServerClient({
        baseUrl: getInsforgeUrl(),
        anonKey: getInsforgeAnonKey(),
        cookies: request.cookies,
    })
}

/** API routes get a 401; page routes get a redirect to /login. */
function reject(request: NextRequest, pathname: string, status: 401 | 403) {
    if (pathname.startsWith('/api/')) {
        return NextResponse.json(
            {
                error: status === 401 ? 'AUTH_UNAUTHORIZED' : 'AUTH_FORBIDDEN',
                message: status === 401 ? 'Sign in required' : 'Admin access required',
            },
            { status },
        )
    }

    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
}

export async function proxy(request: NextRequest) {
    const startedAt = performance.now()
    const marks: ProxyMark[] = []
    const pathname = request.nextUrl.pathname

    // Inject pathname into request headers so Server Components can read it
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', pathname)

    // Refresh InsForge session cookies before Server Components render
    const sessionResponse = NextResponse.next({ request: { headers: requestHeaders } })
    await timed(marks, 'session', () =>
        updateSession({
            requestCookies: request.cookies,
            responseCookies: sessionResponse.cookies,
            baseUrl: getInsforgeUrl(),
            anonKey: getInsforgeAnonKey(),
            ...authCookieSettings,
        }),
    )

    if (isPublic(pathname)) return withServerTiming(sessionResponse, marks, startedAt)

    // ── Cheap auth probe ──────────────────────────────────────────
    const hasAuthCookie = request.cookies.getAll().some(
        (c) => c.name.startsWith('insforge_') || c.name.startsWith('sb-'),
    )
    if (!hasAuthCookie) return withServerTiming(reject(request, pathname, 401), marks, startedAt)

    const client = createInsforgeProxyClient(request)
    const { data } = await timed(marks, 'user', () => client.auth.getCurrentUser())
    const user = toAuthUser(data?.user ?? null)
    if (!user) return withServerTiming(reject(request, pathname, 401), marks, startedAt)

    const profileRes = await timed(marks, 'role', () =>
        client.database.from('Profile').select('role').eq('id', user.id).single(),
    )
    const profile = profileRes.data as { role?: string } | null

    if (profile?.role !== 'ADMIN' && profile?.role !== 'OWNER') {
        return withServerTiming(reject(request, pathname, 403), marks, startedAt)
    }

    return withServerTiming(sessionResponse, marks, startedAt)
}

export const config = {
    matcher: [
        // Everything except Next internals and the three login-page assets.
        // Those files are excluded by exact path so a page URL that happens
        // to end like a static file still goes through this proxy.
        '/((?!_next/static|_next/image|favicon.ico|icon\\.svg$|apple-icon\\.png$|svg/wildgrove_logo\\.svg$).*)',
    ],
}
