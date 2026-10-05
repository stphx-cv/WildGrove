/**
 * Cache tags owned by the CMS.
 *
 * Named here rather than repeated as string literals so a read and its
 * invalidation cannot drift apart — a stale admin panel is worse than an
 * uncached one.
 */

/** Category list, including each category's item count. */
export const CATEGORIES_CACHE_TAG = "cms-categories"

/**
 * The AppSettings singleton. Same tag `packages/core/settings.ts` uses. A CMS
 * save calls `revalidatePublic`, which drops the tag here and pings the
 * storefront `/api/revalidate` — `revalidateTag` alone cannot cross processes.
 */
export const SETTINGS_CACHE_TAG = "app-settings"
