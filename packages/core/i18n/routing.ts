// ══════════════════════════════════════════════════════════════════
// Localized pathname table — the single source of truth for public URLs.
//
// Lives in @wildgrove/core because both apps need it: wildgrove-web routes
// with it, and the CMS builds absolute public links for outgoing emails
// (see ../seo/alternates.ts, used by ../email.ts).
//
// The React navigation wrappers (Link, useRouter, usePathname, redirect) stay
// in wildgrove-web/i18n/routing.ts — only the table and the pure `getPathname`
// helper are shared.
// ══════════════════════════════════════════════════════════════════
import { defineRouting } from "next-intl/routing"
import { createNavigation } from "next-intl/navigation"

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/menu": "/menu",
    "/menu/[slug]": "/menu/[slug]",
    "/reservations": { en: "/reservations", es: "/reservas" },
    "/about": { en: "/about", es: "/nosotros" },
    "/contact": { en: "/contact", es: "/contacto" },
    "/contact/tickets/[ticketId]": {
      en: "/contact/tickets/[ticketId]",
      es: "/contacto/tickets/[ticketId]",
    },
    "/privacy": { en: "/privacy", es: "/privacidad" },
    "/terms": { en: "/terms", es: "/terminos" },
    "/portal": "/portal",
    "/portal/complete-profile": {
      en: "/portal/complete-profile",
      es: "/portal/completar-perfil",
    },
    "/account": { en: "/account", es: "/cuenta" },
    "/account/addresses": {
      en: "/account/addresses",
      es: "/cuenta/direcciones",
    },
    "/account/reservations": {
      en: "/account/reservations",
      es: "/cuenta/reservas",
    },
    "/account/wallet": {
      en: "/account/wallet",
      es: "/cuenta/billetera",
    },
    "/orders": { en: "/orders", es: "/pedidos" },
    "/order-confirmation/[orderNumber]": {
      en: "/order-confirmation/[orderNumber]",
      es: "/confirmacion-pedido/[orderNumber]",
    },
    "/checkout": { en: "/checkout", es: "/pago" },
    "/auth/link-email-callback": {
      en: "/auth/link-email-callback",
      es: "/auth/vincular-email-callback",
    },
  },
})

export type Locale = (typeof routing.locales)[number]
export type Pathnames = keyof typeof routing.pathnames

// See wildgrove-web/i18n/routing.ts for why the next-intl navigation types are
// widened rather than used as generated.
export type HrefArg =
  | string
  | {
      pathname: string
      params?: Record<string, string | number>
      query?: Record<string, string | number | boolean | null | undefined>
    }

export type GetPathnameArg = { href: HrefArg; locale: Locale; forcePrefix?: boolean }

/**
 * Pure path builder — resolves a canonical href to its localized pathname.
 * No request context needed, so it is safe to call from the CMS, from email
 * rendering and from scripts.
 */
export const getPathname = createNavigation(routing).getPathname as unknown as (
  args: GetPathnameArg,
) => string
