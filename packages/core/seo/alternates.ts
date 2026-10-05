import type { Metadata } from "next"
import { routing, getPathname, type Locale, type Pathnames } from "../i18n/routing"
import { siteUrl } from "../urls"

type ParamsFor<Href extends Pathnames> =
  Href extends `${string}[${string}]${string}` ? Record<string, string> : never

/**
 * Build `alternates` metadata (canonical + hreflang languages) for a canonical
 * route. Pass the canonical href (the key in `routing.pathnames`) and the
 * current locale; the helper emits absolute URLs for every supported locale.
 */
export function buildAlternates<Href extends Pathnames>(
  href: Href,
  locale: Locale,
  params?: ParamsFor<Href>
): Metadata["alternates"] {
  const buildUrl = (l: Locale) => {
    const path = params
      ? getPathname({ locale: l, href: { pathname: href, params } as never })
      : getPathname({ locale: l, href: href as never })
    return `${siteUrl()}${path}`
  }

  return {
    canonical: buildUrl(locale),
    languages: Object.fromEntries(
      routing.locales.map((l) => [l, buildUrl(l)])
    ),
  }
}

/** Absolute URL for a canonical href in the given locale. */
export function absoluteLocalizedUrl<Href extends Pathnames>(
  href: Href,
  locale: Locale,
  params?: ParamsFor<Href>
): string {
  const path = params
    ? getPathname({ locale, href: { pathname: href, params } as never })
    : getPathname({ locale, href: href as never })
  return `${siteUrl()}${path}`
}
