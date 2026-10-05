// Sage often copies the prompt's " **Acerca de** (/about) " instead of a
// markdown link. The name then renders as bold text and the path sits beside
// it, so there is nothing to click. These helpers turn that into a real link
// and point internal paths at the canonical page for the visitor's locale.

import { getPathname, routing, type Locale } from "../i18n/routing"
import { siteUrl } from "../urls"

const PAGE_NAME =
  "Acerca de|Nosotros|About page|About|Menú|Carta|Menu|Contacto|Contact|Reservas|Reservations|Mi cuenta|Cuenta|My account|Account|Portal|Privacidad|Privacy|Términos|Terms"

const HREF = "((?:https?:\\/\\/|\\/)[^)\\s]+)"

const BARE_SITE_PATH =
  "\\/(?:menu|about|nosotros|contact|contacto|reservations|reservas|account|cuenta|portal|privacy|privacidad|terms|terminos|orders|pedidos|checkout|pago)(?:\\/[A-Za-z0-9._~%-]+)*"

const BARE_LABEL: Record<string, { en: string; es: string }> = {
  "/menu": { en: "Menu", es: "Carta" },
  "/about": { en: "About", es: "Nosotros" },
  "/nosotros": { en: "About", es: "Nosotros" },
  "/contact": { en: "Contact", es: "Contacto" },
  "/contacto": { en: "Contact", es: "Contacto" },
  "/reservations": { en: "Reservations", es: "Reservas" },
  "/reservas": { en: "Reservations", es: "Reservas" },
  "/account": { en: "My account", es: "Mi cuenta" },
  "/cuenta": { en: "My account", es: "Mi cuenta" },
  "/portal": { en: "Portal", es: "Portal" },
  "/privacy": { en: "Privacy", es: "Privacidad" },
  "/privacidad": { en: "Privacy", es: "Privacidad" },
  "/terms": { en: "Terms", es: "Términos" },
  "/terminos": { en: "Terms", es: "Términos" },
  "/orders": { en: "Orders", es: "Pedidos" },
  "/pedidos": { en: "Orders", es: "Pedidos" },
  "/checkout": { en: "Checkout", es: "Pago" },
  "/pago": { en: "Checkout", es: "Pago" },
}

function isPromotableHref(href: string): boolean {
  const value = href.trim()
  if (value.startsWith("/") && !value.startsWith("//")) return true
  return /^https?:\/\//i.test(value)
}

function toLink(label: string, href: string): string {
  return `[${label.trim()}](${href.trim()})`
}

/**
 * Rewrite page mentions so the visible name is a markdown link.
 * `locale` names a bare path (`/about`) when the message has no label of its own.
 */
export function promoteChatLinks(text: string, locale: "en" | "es"): string {
  let out = text

  out = out.replace(/\*\*(\[[^\]]+\]\([^)]+\))\*\*/g, "$1")
  out = out.replace(/\[\*\*([^*]+)\*\*\]\(([^)]+)\)/g, "[$1]($2)")

  out = out.replace(
    new RegExp(String.raw`\*\*([^*]+?)\s*\(${HREF}\)\*\*`, "g"),
    (full, label: string, href: string) =>
      isPromotableHref(href) ? toLink(label, href) : full,
  )

  out = out.replace(
    new RegExp(String.raw`\*\*([^*]+)\*\*\s*\(${HREF}\)`, "g"),
    (full, label: string, href: string) =>
      isPromotableHref(href) ? toLink(label, href) : full,
  )

  out = out.replace(
    new RegExp(String.raw`(?<!\[)(?<![\p{L}\p{N}])(${PAGE_NAME})(?![\p{L}\p{N}])\s*\(${HREF}\)`, "gu"),
    (full, label: string, href: string) =>
      isPromotableHref(href) ? toLink(label, href) : full,
  )

  const bare = new RegExp(String.raw`(^|[\s])(${BARE_SITE_PATH})(?=$|[\s.,!?;:])`, "g")
  out = out.replace(bare, (full, lead: string, path: string) => {
    const label = BARE_LABEL[path]?.[locale]
    return label ? `${lead}${toLink(label, path)}` : full
  })

  const wrapped = new RegExp(String.raw`(?<!\])\((${BARE_SITE_PATH})\)`, "g")
  out = out.replace(wrapped, (full, path: string) => {
    const label = BARE_LABEL[path]?.[locale]
    return label ? toLink(label, path) : full
  })

  return out
}

export type ClassifiedChatHref =
  | { kind: "external"; href: string }
  | { kind: "internal"; href: string }

const OWN_HOSTS = new Set(["wildgrove.cv", "www.wildgrove.cv", "localhost", "127.0.0.1"])

function splitSuffix(value: string): { pathname: string; suffix: string } {
  const hash = value.indexOf("#")
  const query = value.indexOf("?")
  const cuts = [hash, query].filter((index) => index >= 0)
  const cut = cuts.length > 0 ? Math.min(...cuts) : value.length
  return { pathname: value.slice(0, cut) || "/", suffix: value.slice(cut) }
}

function matchTemplate(template: string, actual: string): Record<string, string> | null {
  const expected = template.split("/").filter(Boolean)
  const given = actual.split("/").filter(Boolean)
  if (expected.length !== given.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < expected.length; index++) {
    const token = expected[index]
    if (token.startsWith("[") && token.endsWith("]")) {
      params[token.slice(1, -1)] = given[index]
    } else if (token !== given[index]) {
      return null
    }
  }
  return params
}

function fillTemplate(template: string, params: Record<string, string>): string {
  const filled = template.replace(/\[([^\]]+)\]/g, (_, name: string) => params[name] ?? "")
  return filled.startsWith("/") ? filled : `/${filled}`
}

/** Map a localized or canonical path back to the pathname table key. */
export function toCanonicalPath(pathname: string): string {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname
  const parts = trimmed.split("/")
  if (parts.length > 1 && (routing.locales as readonly string[]).includes(parts[1])) {
    parts.splice(1, 1)
  }
  const stripped = parts.join("/") || "/"

  for (const [canonical, localized] of Object.entries(routing.pathnames)) {
    const variants =
      typeof localized === "string"
        ? [canonical, localized]
        : [canonical, ...Object.values(localized)]
    for (const variant of new Set(variants)) {
      const params = matchTemplate(variant, stripped)
      if (params) return fillTemplate(canonical, params)
    }
  }
  return stripped
}

/** External URLs stay as written. Site paths become a canonical href for next-intl. */
export function classifyChatHref(raw: string): ClassifiedChatHref {
  const trimmed = raw.trim()
  if (/^(?:mailto|tel):/i.test(trimmed)) return { kind: "external", href: trimmed }

  let pathAndMore = trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (!OWN_HOSTS.has(url.hostname.toLowerCase())) {
        return { kind: "external", href: trimmed }
      }
      pathAndMore = `${url.pathname}${url.search}${url.hash}`
    } catch {
      return { kind: "external", href: trimmed }
    }
  } else if (/^(?:www\.)?wildgrove\.cv\//i.test(trimmed)) {
    pathAndMore = trimmed.replace(/^(?:www\.)?wildgrove\.cv/i, "")
  } else if (!trimmed.startsWith("/")) {
    return { kind: "external", href: trimmed }
  }

  const { pathname, suffix } = splitSuffix(pathAndMore)
  return { kind: "internal", href: `${toCanonicalPath(pathname)}${suffix}` }
}

const SITE_PAGE_PATHS = new Set(
  Object.keys(routing.pathnames).filter((path) => !path.includes("[")),
)

function hrefPath(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href
}

/** A fixed site page, such as the menu or reservations. A dish or ticket path is not. */
export function isSitePageHref(href: string): boolean {
  return SITE_PAGE_PATHS.has(hrefPath(href))
}

/** Absolute storefront URL, for the admin panel, which lives on another host. */
export function publicChatHref(canonicalHref: string, locale: Locale): string {
  const { pathname, suffix } = splitSuffix(canonicalHref)
  const localized = getPathname({ href: pathname, locale })
  const path = localized === "/" ? "" : localized
  return `${siteUrl()}/${locale}${path}${suffix}`
}
