// ══════════════════════════════════════════════════════════════════
// Sage — page-visible content for the user's current route
// Injected into the system prompt (not the full site dump)
// ══════════════════════════════════════════════════════════════════

import { getTranslations } from "next-intl/server"
import { getContactFaqForLocale } from "../contact-faq"
import { getSiteCreatorProfile } from "../site-creator"

/** Canonical page keys used internally (locale-agnostic). */
export type SagePageKey =
  | "home"
  | "menu"
  | "about"
  | "contact"
  | "reservations"
  | "portal"
  | "account"
  | "privacy"
  | "terms"
  | "other"

const PATH_TO_PAGE: Record<string, SagePageKey> = {
  "/": "home",
  "/menu": "menu",
  "/about": "about",
  "/nosotros": "about",
  "/contact": "contact",
  "/contacto": "contact",
  "/reservations": "reservations",
  "/reservas": "reservations",
  "/portal": "portal",
  "/account": "account",
  "/cuenta": "account",
  "/privacy": "privacy",
  "/privacidad": "privacy",
  "/terms": "terms",
  "/terminos": "terms",
}

/** Map localized pathname (no locale prefix) to a canonical page key. */
export function resolveSagePageKey(pathname: string | null | undefined): SagePageKey {
  if (!pathname || pathname === "/") return "home"
  const base = pathname.split("?")[0]?.replace(/\/$/, "") || "/"
  if (PATH_TO_PAGE[base]) return PATH_TO_PAGE[base]
  if (base.startsWith("/menu")) return "menu"
  if (base.startsWith("/contact") || base.startsWith("/contacto")) return "contact"
  return "other"
}

function section(title: string, body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ""
  return `### ${title}\n${trimmed}`
}

type LegalSectionText = {
  title: string
  body?: string
  items?: Record<string, string>
  outro?: string
}

/** Drops the rich-text tags (`<strong>`, `<email>`, `<repo>`) and keeps their text. */
function plainText(rich: string): string {
  return rich.replace(/<\/?[a-z]+>/g, "")
}

/**
 * The whole legal page as plain text, in the order `LegalDocument` renders it:
 * every `sections.<id>` with its body, bullet items and closing line.
 */
async function legalPageText(namespace: "privacy" | "terms", locale: "en" | "es"): Promise<string> {
  const t = await getTranslations({ locale, namespace })
  const sections = t.raw("sections") as Record<string, LegalSectionText>
  const blocks = Object.values(sections)
    .filter((s) => s.body)
    .map((s) =>
      [
        `**${s.title}**`,
        plainText(s.body ?? ""),
        ...Object.values(s.items ?? {}).map((item) => `- ${plainText(item)}`),
        s.outro ? plainText(s.outro) : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
  return [`**${t("heroTitle")}**`, t("lastUpdated"), ...blocks].join("\n\n")
}

/**
 * Markdown block describing text the user can see on their current page.
 * Empty string when pathname is missing (chat still works via tools).
 */
export async function buildPageContextMarkdown(
  pathname: string | null | undefined,
  locale: "en" | "es"
): Promise<string> {
  const pageKey = resolveSagePageKey(pathname)
  const creator = getSiteCreatorProfile(locale)
  const faqs = getContactFaqForLocale(locale)
  const faqBlock = faqs.map((f) => `**Q:** ${f.q}\n**A:** ${f.a}`).join("\n\n")

  const globalCreator = section(
    locale === "es" ? "Creador del sitio (Nosotros / Contacto)" : "Site creator (About / Contact)",
    [
      `**${creator.name}**, ${creator.role}`,
      creator.school,
      creator.bio,
      locale === "es"
        ? "Preguntas sobre quién desarrolló o construyó el sitio → esta sección + herramienta get_restaurant_info(topic: team)."
        : "Questions about who built or developed the website → this section + get_restaurant_info(topic: team).",
    ].join("\n")
  )

  const globalFaq = section(
    locale === "es" ? "Preguntas frecuentes del sitio" : "Site FAQs",
    faqBlock
  )

  const parts: string[] = []

  if (pathname?.trim()) {
    parts.push(
      locale === "es"
        ? `**Página actual del usuario:** \`${pathname}\` (${pageKey})`
        : `**User's current page:** \`${pathname}\` (${pageKey})`
    )
  }

  parts.push(globalCreator, globalFaq)

  switch (pageKey) {
    case "home": {
      const [hero, philosophy] = await Promise.all([
        getTranslations({ locale, namespace: "hero" }),
        getTranslations({ locale, namespace: "philosophy" }),
      ])
      parts.push(
        section(locale === "es" ? "Inicio: héroe" : "Home: hero", [
          hero("subtitle"),
          `${hero("title1")} ${hero("title2")}`,
          hero("description"),
        ].join("\n")),
        section(locale === "es" ? "Inicio: filosofía" : "Home: philosophy", [
          `"${philosophy("quote")}", ${philosophy("quoteAttribution")}`,
          `**${philosophy("plantForwardTitle")}:** ${philosophy("plantForwardDesc")}`,
          `**${philosophy("locallySourcedTitle")}:** ${philosophy("locallySourcedDesc")}`,
          `**${philosophy("zeroWasteTitle")}:** ${philosophy("zeroWasteDesc")}`,
        ].join("\n"))
      )
      break
    }
    case "about": {
      const t = await getTranslations({ locale, namespace: "about" })
      parts.push(
        section(locale === "es" ? "Nosotros: visible en esta página" : "About: visible on this page", [
          `**${t("heroTitle")}**`,
          t("storyP1"),
          t("storyP2"),
          t("storyP3"),
          `**${t("valuesTitle")}:** ${t("value1Title")}: ${t("value1Description")}`,
          `${t("value2Title")}: ${t("value2Description")}`,
          `${t("value3Title")}: ${t("value3Description")}`,
          `**${t("teamTitle")}** (${t("portfolioBadge")})`,
        ].join("\n\n"))
      )
      break
    }
    case "contact": {
      const t = await getTranslations({ locale, namespace: "contact" })
      parts.push(
        section(locale === "es" ? "Contacto: visible en esta página" : "Contact: visible on this page", [
          `**${t("heroTitle")}**`,
          t("heroDescription"),
        ].join("\n\n"))
      )
      break
    }
    case "menu": {
      parts.push(
        section(
          locale === "es" ? "Carta" : "Menu",
          locale === "es"
            ? "El usuario está en la carta. Para platos, precios e imágenes usa **get_menu** (datos en vivo del CMS)."
            : "The user is on the menu. For dishes, prices, and images use **get_menu** (live CMS data)."
        )
      )
      break
    }
    case "reservations": {
      parts.push(
        section(
          locale === "es" ? "Reservas" : "Reservations",
          locale === "es"
            ? "Página de reservas: el usuario puede gestionar reservas con sesión iniciada. Para disponibilidad usa **check_availability**; para crear en el chat, **[START_RESERVATION_FORM]** si está autenticado."
            : "Reservations page: logged-in users manage bookings here. Use **check_availability** for slots; to book in chat use **[START_RESERVATION_FORM]** when authenticated."
        )
      )
      break
    }
    case "privacy": {
      parts.push(
        section(locale === "es" ? "Privacidad" : "Privacy", await legalPageText("privacy", locale))
      )
      break
    }
    case "terms": {
      parts.push(
        section(locale === "es" ? "Términos" : "Terms", await legalPageText("terms", locale))
      )
      break
    }
    default:
      break
  }

  const body = parts.filter(Boolean).join("\n\n")
  if (!body.trim()) return ""

  const header =
    locale === "es"
      ? "## CONTENIDO VISIBLE EN EL SITIO (contexto de página)\nResponde usando **solo** esta información y tus herramientas. No rechaces preguntas sobre el sitio web, portafolio, demo o creador."
      : "## VISIBLE SITE CONTENT (page context)\nAnswer using **only** this information and your tools. Do not decline questions about the website, portfolio, demo, or creator."

  return `${header}\n\n${body}`
}
