// ══════════════════════════════════════════════════════════════════
// Route Protection Proxy + i18n Middleware
// The admin panel is a separate app on cms.wildgrove.cv with its own
// session and its own role guard — see wildgrove-cms/proxy.ts.
// Guards /portal — redirects authenticated users with a username to /account.
// Guards /account, /account/addresses, /account/reservations and /account/wallet — redirects unauthenticated users to /portal.
// Handles locale detection and routing via next-intl, including
// localized URL pathnames (e.g. /es/reservas) and backward-compat
// redirects from English slugs under /es/* to their Spanish equivalents.
// ══════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { updateSession } from '@insforge/sdk/ssr/middleware'
import { createServerClient } from '@insforge/sdk/ssr'
import { routing, type Locale } from '@wildgrove/core/i18n/routing'
import { MARKDOWN_PAGES, type MarkdownPage } from '@wildgrove/core/agent/page-specs'
import { getAppUrl, getInsforgeAnonKey, getInsforgeUrl } from '@wildgrove/core/insforge/env'
import { authCookieSettings } from '@wildgrove/core/insforge/cookies'
import { toAuthUser } from '@wildgrove/core/auth/types'

const intlMiddleware = createIntlMiddleware(routing)

/** Splits `/es/reservas` into its locale and the path below it. Pure. */
function splitLocale(pathname: string): { locale: Locale; strippedPath: string } {
    const localeMatch = pathname.match(/^\/(en|es)(?=\/|$)/)
    return {
        locale: (localeMatch?.[1] as Locale) ?? routing.defaultLocale,
        strippedPath: pathname.replace(/^\/(en|es)/, '') || '/',
    }
}

const MARKDOWN_PAGE_SET = new Set<MarkdownPage>(MARKDOWN_PAGES)

function isMarkdownPage(path: string): path is MarkdownPage {
    return MARKDOWN_PAGE_SET.has(path as MarkdownPage)
}

/**
 * Agents ask for a page as markdown with `Accept: text/markdown`; browsers
 * never send it, so an explicit match is the whole test. A wildcard Accept
 * does not count — a client that will take anything gets the HTML, which is
 * the default representation of this site.
 */
function wantsMarkdown(request: NextRequest): boolean {
    return (request.headers.get('accept') ?? '').toLowerCase().includes('text/markdown')
}

/** Logged-in users without a username must finish setup before using the app.
 *  Keys are canonical (English) paths — proxy normalizes Spanish slugs before lookup. */
const PROFILE_SETUP_EXEMPT_PATHS = new Set([
    '/portal/complete-profile',
    '/auth/link-email-callback',
])

/**
 * Build a lookup `{ "/reservas": "/reservations", ... }` per locale from the
 * `pathnames` declared in routing. Used by `getCanonicalPath` to normalize an
 * incoming localized slug back to the canonical (English) key the proxy guards
 * compare against.
 */
function buildLocalizedToCanonical(locale: Locale): Array<{
    canonical: string
    localized: string
}> {
    const entries: Array<{ canonical: string; localized: string }> = []
    for (const [canonical, value] of Object.entries(routing.pathnames)) {
        const localized =
            typeof value === 'string' ? value : (value as Record<Locale, string>)[locale]
        entries.push({ canonical, localized })
    }
    // Sort by descending length so more specific routes match first
    // (e.g. /cuenta/direcciones before /cuenta).
    entries.sort((a, b) => b.localized.length - a.localized.length)
    return entries
}

const LOCALIZED_TO_CANONICAL: Record<Locale, ReturnType<typeof buildLocalizedToCanonical>> = {
    en: buildLocalizedToCanonical('en'),
    es: buildLocalizedToCanonical('es'),
}

/**
 * Match a stripped pathname against a pattern that may contain `[param]`
 * segments. Returns true if the shape matches.
 */
function matchesPattern(stripped: string, pattern: string): boolean {
    const sParts = stripped.split('/').filter(Boolean)
    const pParts = pattern.split('/').filter(Boolean)
    if (sParts.length !== pParts.length) return false
    for (let i = 0; i < pParts.length; i++) {
        const p = pParts[i]
        if (p.startsWith('[') && p.endsWith(']')) continue
        if (p !== sParts[i]) return false
    }
    return true
}

/**
 * Map an incoming stripped path (e.g. `/reservas` or `/cuenta/direcciones`)
 * back to its canonical key (`/reservations`, `/account/addresses`). Returns
 * the input unchanged if no match.
 */
function getCanonicalPath(locale: Locale, stripped: string): string {
    if (stripped === '/' || stripped === '') return '/'
    for (const { canonical, localized } of LOCALIZED_TO_CANONICAL[locale]) {
        if (localized === stripped) return canonical
        if (localized.includes('[') && matchesPattern(stripped, localized)) {
            return canonical
        }
    }
    return stripped
}

/**
 * Substitute `[param]` segments in a pattern with the matching segments from
 * `actual`. Used to rewrite e.g. `/order-confirmation/123` →
 * `/confirmacion-pedido/123` while preserving the dynamic segment.
 */
function substituteParams(pattern: string, actual: string): string {
    const pParts = pattern.split('/')
    const aParts = actual.split('/')
    if (pParts.length !== aParts.length) return pattern
    return pParts
        .map((seg, i) =>
            seg.startsWith('[') && seg.endsWith(']') ? aParts[i] : seg
        )
        .join('/')
}

/**
 * If the incoming pathname is `/es/<english-slug>` for a route that has a
 * Spanish translation, return the Spanish equivalent path so the proxy can
 * 308-redirect to it. Returns `null` if no redirect is needed.
 */
function findBackwardCompatRedirect(
    locale: Locale,
    stripped: string
): string | null {
    if (locale !== 'es') return null
    if (stripped === '/' || stripped === '') return null

    for (const [canonical, value] of Object.entries(routing.pathnames)) {
        if (typeof value === 'string') continue
        const enSlug = (value as Record<Locale, string>).en
        const esSlug = (value as Record<Locale, string>).es
        if (enSlug === esSlug) continue

        if (enSlug === stripped) return esSlug
        if (enSlug.includes('[') && matchesPattern(stripped, enSlug)) {
            return substituteParams(esSlug, stripped)
        }
        void canonical
    }
    return null
}

/**
 * Compute the localized URL for a canonical href in the given locale,
 * including the locale prefix (e.g. `/es/cuenta`).
 */
function localizedUrl(locale: Locale, canonicalHref: string): string {
    const entry = routing.pathnames[canonicalHref as keyof typeof routing.pathnames]
    const localized = typeof entry === 'string' ? entry : entry?.[locale] ?? canonicalHref
    return `/${locale}${localized === '/' ? '' : localized}`
}

function copyCookies(from: NextResponse, to: NextResponse) {
    from.cookies.getAll().forEach(({ name, value, ...opts }) => {
        const hasOpts = Object.keys(opts).length > 0
        if (hasOpts) {
            to.cookies.set(name, value, opts as Parameters<typeof to.cookies.set>[2])
        } else {
            to.cookies.set(name, value)
        }
    })
}

function createInsforgeProxyClient(request: NextRequest) {
    return createServerClient({
        baseUrl: getInsforgeUrl(),
        anonKey: getInsforgeAnonKey(),
        cookies: request.cookies,
    })
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // ── Markdown content negotiation ──────────────────────────────
    // Deliberately ahead of the session refresh: an agent reading a public
    // page has no session, and should not cost an InsForge round trip.
    // A rewrite, never a redirect — the URL the agent asked for is the URL
    // it keeps, which is what makes the two representations one resource.
    if (wantsMarkdown(request)) {
        const { locale: mdLocale, strippedPath: mdPath } = splitLocale(pathname)
        const mdCanonical = getCanonicalPath(mdLocale, mdPath)

        if (isMarkdownPage(mdCanonical)) {
            const target = request.nextUrl.clone()
            target.pathname = `/api/agent/markdown/${mdLocale}${mdPath === '/' ? '' : mdPath}`

            // Through a header, not a query param: a rewrite keeps the original
            // URL, so `request.nextUrl` inside the handler still reports
            // /en/about with no search string. Same channel as x-pathname above.
            const mdHeaders = new Headers(request.headers)
            mdHeaders.set('x-agent-page', mdCanonical)

            return NextResponse.rewrite(target, { request: { headers: mdHeaders } })
        }
    }

    // Inject pathname into request headers so Server Components can read it
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', pathname)

    // Refresh InsForge session cookies before Server Components render
    const sessionResponse = NextResponse.next({ request: { headers: requestHeaders } })
    await updateSession({
        requestCookies: request.cookies,
        responseCookies: sessionResponse.cookies,
        baseUrl: getInsforgeUrl(),
        anonKey: getInsforgeAnonKey(),
        ...authCookieSettings,
    })

    // ── Cheap auth probe ──────────────────────────────────────────────
    // InsForge SSR cookies: access + refresh, both httpOnly.
    const hasAuthCookie = request.cookies.getAll().some(
        (c) => c.name.startsWith('insforge_') || c.name.startsWith('sb-')
    )

    // ── Strip locale prefix to determine the "real" path ──
    const { locale, strippedPath } = splitLocale(pathname)

    // ── Backward-compat: /es/<english-slug> → 308 /es/<spanish-slug> ──
    const backwardTarget = findBackwardCompatRedirect(locale, strippedPath)
    if (backwardTarget) {
        const redirectUrl = new URL(`/${locale}${backwardTarget}`, getAppUrl())
        redirectUrl.search = request.nextUrl.search
        return NextResponse.redirect(redirectUrl, 308)
    }

    // ── Normalize to canonical (English) path for guard comparisons ──
    const canonicalPath = getCanonicalPath(locale, strippedPath)
    const isProfileSetupExempt = PROFILE_SETUP_EXEMPT_PATHS.has(canonicalPath)

    // ── Session + profile completeness (all locale routes) ──
    let user: { id: string } | null = null

    if (hasAuthCookie) {
        const client = createInsforgeProxyClient(request)
        const { data } = await client.auth.getCurrentUser()
        const authUser = toAuthUser(data?.user ?? null)
        user = authUser

        if (user && !isProfileSetupExempt) {
            const profileRes = await client.database
                .from('Profile')
                .select('username')
                .eq('id', user.id)
                .single()
            const profile = profileRes.data as { username?: string | null } | null

            const usernameOk =
                typeof profile?.username === 'string' && profile.username.trim().length > 0

            if (!usernameOk) {
                const target = new URL(
                    localizedUrl(locale, '/portal/complete-profile'),
                    getAppUrl()
                )
                const redirectRes = NextResponse.redirect(target)
                copyCookies(sessionResponse, redirectRes)
                return redirectRes
            }
        }
    }

    // ── /checkout — redirect guests to login ──────────────────
    const isCheckout = canonicalPath === '/checkout'
    if (isCheckout && !user) {
        const toPortal = new URL(localizedUrl(locale, '/portal'), getAppUrl())
        toPortal.searchParams.set('mode', 'login')
        const redirectRes = NextResponse.redirect(toPortal)
        copyCookies(sessionResponse, redirectRes)
        return redirectRes
    }

    // ── Auth-protected public routes (portal, account) ──
    const isPortalRoot = canonicalPath === '/portal'
    const isPortalSub = canonicalPath.startsWith('/portal/')
    const isAccount =
        canonicalPath === '/account' ||
        canonicalPath === '/account/addresses' ||
        canonicalPath === '/account/reservations' ||
        canonicalPath === '/account/wallet'

    if (isPortalRoot || isPortalSub || isAccount) {
        if (user && isPortalRoot) {
            // /portal is the signed-out entry point. Sending a signed-in user to
            // "/" means redirecting them to the page they just clicked from, so
            // the Sign In button looks dead when the header wrongly renders it
            // (see app/api/me/route.ts). /account is a visible destination.
            const account = NextResponse.redirect(
                new URL(localizedUrl(locale, '/account'), getAppUrl())
            )
            copyCookies(sessionResponse, account)
            return account
        }

        if (!user && isPortalSub) {
            const toPortal = NextResponse.redirect(
                new URL(localizedUrl(locale, '/portal'), getAppUrl())
            )
            copyCookies(sessionResponse, toPortal)
            return toPortal
        }

        if (!user && isAccount) {
            const toPortal = NextResponse.redirect(
                new URL(localizedUrl(locale, '/portal'), getAppUrl())
            )
            copyCookies(sessionResponse, toPortal)
            return toPortal
        }
    }

    // ── i18n middleware for all public routes ──
    const intlResponse = intlMiddleware(request)
    copyCookies(sessionResponse, intlResponse)
    // No `Vary: Accept` here on purpose. Next recomputes Vary on page
    // responses after the proxy runs and discards whatever was set — proven
    // with a probe header, which survived while Vary did not. The markdown
    // branch above never reaches this code, and it carries its own Vary.
    //
    // What keeps the two representations apart is the rewrite: this proxy runs
    // ahead of the cache lookup, so a request carrying `Accept: text/markdown`
    // is diverted before it can match a cached HTML entry for the same path.
    //
    // That ordering only holds for caches this process controls. An edge cache
    // in front of the origin sits *above* the proxy, so an HTML entry it stored
    // for a path would answer a markdown request for the same path before this
    // code runs. HTML is therefore not cached at the edge. See
    // wildgrove-vault/reference/07-decisions.md.
    return intlResponse
}

export const config = {
    matcher: [
        '/',
        '/(en|es)/:path*',
        '/((?!api|_next|.*\\..*|favicon\\.ico).*)',
    ],
}
