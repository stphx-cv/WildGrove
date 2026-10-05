// ══════════════════════════════════════════════════════════════════
// The CMS's one client-side data layer.
//
// Every list page used to hold its own `useState` + `useEffect` + `fetch`,
// which meant leaving a page threw its data away and coming back paid for it
// again, and two components asking for `/api/settings` in the same second made
// two requests. `swr` keeps one cache keyed by URL: a revisit paints what it
// already has and revalidates behind, and simultaneous askers share one
// request.
//
// Nothing else in the CMS should call `useSWR` directly — the envelope
// unwrapping and the defaults live here so a page cannot get them wrong.
// ══════════════════════════════════════════════════════════════════

import useSWR, { mutate, preload, type SWRConfiguration } from "swr"

/** What a failed CMS request throws. `status` is 0 when the request never landed. */
/** The only keys allowed beside `data` for the body to count as a plain envelope. */
const ENVELOPE_KEYS = new Set(["success", "data", "error", "message"])

export class CmsQueryError extends Error {
    readonly status: number

    constructor(message: string, status: number) {
        super(message)
        this.name = "CmsQueryError"
        this.status = status
    }
}

/**
 * Unwraps the `{ success, data }` envelope every CMS route returns and throws
 * on `success: false`, so a page's `error` means what it says.
 *
 * Anything that is not a plain envelope comes back whole and the caller reads
 * the field it wants: `/api/pending-counts` answers `{ success, counts }`,
 * `/api/tickets` adds `callerRole` beside `data`, and the dashboard routes
 * answer with a bare DTO and no envelope at all.
 */
export async function cmsFetcher<T>(key: string): Promise<T> {
    const res = await fetch(key)

    let json: unknown
    try {
        json = await res.json()
    } catch {
        throw new CmsQueryError(`Malformed response from ${key}`, res.status)
    }

    const body = json as { success?: boolean; error?: string; data?: unknown }

    if (!res.ok || body?.success === false) {
        throw new CmsQueryError(body?.error ?? `Request to ${key} failed`, res.status)
    }

    // Unwrap only a plain envelope — `data` with nothing but `success`, `error`
    // or `message` beside it. Two other shapes exist and must pass through
    // whole: routes that put a sibling next to `data` (`/api/tickets` adds
    // `callerRole`) or instead of it (`/api/pending-counts` returns `counts`),
    // and the dashboard routes, which answer with a bare DTO and no envelope.
    const isPlainEnvelope =
        body !== null &&
        typeof body === "object" &&
        "data" in body &&
        Object.keys(body).every((k) => ENVELOPE_KEYS.has(k))

    return (isPlainEnvelope ? body.data : body) as T
}

/**
 * The defaults every CMS query gets. `keepPreviousData` is what makes a revisit
 * paint at once: the previous value stays on screen while the new one is
 * fetched, so a page shows its spinner on the first load only.
 *
 * `dedupingInterval` is deliberately longer than SWR's 2 s default: a panel
 * load mounts the provider, the header and the page within a few hundred
 * milliseconds, and all three may want `/api/settings`.
 */
export const CMS_QUERY_DEFAULTS: SWRConfiguration = {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    errorRetryCount: 2,
}

/**
 * Read a CMS endpoint. The key is the URL, so two callers asking for the same
 * URL share one request and one cache entry.
 *
 * Pass `null` as the key to skip the request — the SWR idiom for "not yet".
 */
export function useCmsQuery<T>(key: string | null, options?: SWRConfiguration<T>) {
    return useSWR<T, CmsQueryError>(key, cmsFetcher, { ...CMS_QUERY_DEFAULTS, ...options })
}

/**
 * Start fetching a key before anything renders it — used by the sidebar and the
 * table rows on hover. Safe to call repeatedly: within `dedupingInterval` the
 * extra calls join the request already in flight.
 */
export function preloadCms(key: string) {
    return preload(key, cmsFetcher)
}

/**
 * Drop every cached key that starts with `prefix` and refetch the mounted ones.
 * Called after a write: `invalidateCms("/api/menu")` covers every page, filter
 * and search of the menu list at once.
 */
export function invalidateCms(prefix: string) {
    return mutate(
        (key) => typeof key === "string" && key.startsWith(prefix),
        undefined,
        { revalidate: true },
    )
}

/**
 * Replace one key's cached value without a request — for an optimistic update.
 * The caller revalidates afterwards if the server may disagree.
 */
export function setCmsData<T>(key: string, updater: (current: T | undefined) => T) {
    return mutate<T>(key, (current) => updater(current), { revalidate: false })
}
