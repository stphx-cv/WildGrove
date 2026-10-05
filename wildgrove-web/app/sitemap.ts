import type { MetadataRoute } from "next"
import { prisma } from "@wildgrove/db"
import { routing, getPathname, type Locale, type Pathnames } from "@wildgrove/core/i18n/routing"
import { siteUrl } from "@wildgrove/core/urls"
import { onSaleMenuItemWhere } from "@wildgrove/core/menu-visibility"

/**
 * Generated per request, never at build time.
 *
 * The dish entries come from the database. Builds run against a throwaway
 * Postgres that carries the schema and no dishes, so a prerendered sitemap
 * would ship with the static pages only and stay that way until the next
 * deploy. Crawlers fetch this document rarely enough that a query per request
 * costs nothing worth saving.
 */
export const dynamic = "force-dynamic"

const STATIC_PUBLIC_HREFS = [
    "/",
    "/menu",
    "/reservations",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
] as const satisfies readonly Pathnames[]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = siteUrl()
    const locales = routing.locales

    const buildLanguages = (
        build: (locale: Locale) => string
    ): Record<string, string> =>
        Object.fromEntries(locales.map((l) => [l, build(l)]))

    // Static pages
    const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_HREFS.flatMap((href) =>
        locales.map((locale) => {
            const url = `${baseUrl}${getPathname({ locale, href })}`
            // No lastModified: these pages have no change date of their own, and a
            // value that reads "now" on every request is ignored by crawlers.
            return {
                url,
                changeFrequency: "monthly" as const,
                priority: href === "/" ? 1.0 : 0.6,
                alternates: {
                    languages: buildLanguages((l) => `${baseUrl}${getPathname({ locale: l, href })}`),
                },
            }
        })
    )

    // Dynamic menu item pages — slug differs per locale (slug / slugEs)
    let menuEntries: MetadataRoute.Sitemap = []
    try {
        const items = await prisma.menuItem.findMany({
            where: onSaleMenuItemWhere,
            select: { slug: true, slugEs: true, updatedAt: true },
        })

        const pickSlug = (
            locale: Locale,
            item: { slug: string; slugEs: string | null }
        ): string => (locale === "es" && item.slugEs ? item.slugEs : item.slug)

        menuEntries = items.flatMap((item) =>
            locales.map((locale) => {
                const slug = pickSlug(locale, item)
                const url = `${baseUrl}${getPathname({
                    locale,
                    href: { pathname: "/menu/[slug]", params: { slug } },
                })}`
                return {
                    url,
                    lastModified: item.updatedAt,
                    changeFrequency: "weekly" as const,
                    priority: 0.8,
                    alternates: {
                        languages: buildLanguages(
                            (l) =>
                                `${baseUrl}${getPathname({
                                    locale: l,
                                    href: {
                                        pathname: "/menu/[slug]",
                                        params: { slug: pickSlug(l, item) },
                                    },
                                })}`
                        ),
                    },
                }
            })
        )
    } catch (error) {
        // A database that does not answer costs the dish entries, not the
        // document: the static pages below still go out. Logged because at
        // runtime this is the difference between a complete sitemap and a
        // quietly truncated one.
        console.error("[sitemap] menu items unavailable, serving static pages only:", error)
    }

    return [...staticEntries, ...menuEntries]
}
