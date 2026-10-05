// ══════════════════════════════════════════════════════════════════
// Cross-app absolute URLs.
//
// The storefront and the CMS answer on two hostnames, so any link from one
// into the other has to be absolute. Both read the same env vars, so the
// values are resolved here rather than hardcoded at each call site.
//
// `siteUrl()` is the single fallback origin for the storefront. Every caller
// that builds a canonical URL, an hreflang alternate or a sitemap entry goes
// through it, so the address search engines are handed is decided in one
// place. A second fallback somewhere else drifts from this one and the tag
// that wins is whichever module happened to build it.
// ══════════════════════════════════════════════════════════════════

/** Public storefront origin, no trailing slash. */
export function siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.wildgrove.cv").replace(/\/$/, "")
}

/** CMS origin, no trailing slash. */
export function cmsUrl(): string {
    return (process.env.NEXT_PUBLIC_CMS_URL || "https://cms.wildgrove.cv").replace(/\/$/, "")
}

/**
 * Panel path as served on cms.wildgrove.cv, which carries no `/admin` prefix.
 * Notification rows (and a few leftover writers) still store `/admin/chat`;
 * this host serves that screen at `/chat`.
 *
 * `/admin` → `/`
 * `/admin/chat` → `/chat`
 * `/chat` → `/chat`
 */
export function cmsPanelPath(path: string): string {
    if (path === "/admin") return "/"
    if (path.startsWith("/admin/")) return path.slice("/admin".length)
    return path
}

/**
 * Absolute URL for a storefront path.
 * `siteLink("/")` → `https://www.wildgrove.cv`
 * `siteLink("/menu")` → `https://www.wildgrove.cv/menu`
 */
export function siteLink(path = "/"): string {
    const suffix = path.startsWith("/") ? path : `/${path}`
    return `${siteUrl()}${suffix === "/" ? "" : suffix}`
}

/**
 * Absolute URL for a CMS path.
 * `cmsLink("/orders")` → `https://cms.wildgrove.cv/orders`
 * `cmsLink("/admin/chat")` → `https://cms.wildgrove.cv/chat`
 */
export function cmsLink(path = "/"): string {
    const suffix = cmsPanelPath(path.startsWith("/") ? path : `/${path}`)
    return `${cmsUrl()}${suffix === "/" ? "" : suffix}`
}
