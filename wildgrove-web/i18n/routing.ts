// ══════════════════════════════════════════════════════════════════
// next-intl navigation for the public site.
//
// The pathname table itself lives in @wildgrove/core/i18n/routing — both apps
// need it (the CMS builds absolute public links for outgoing emails). Only the
// React navigation wrappers below are web-only.
// ══════════════════════════════════════════════════════════════════
import { createNavigation } from "next-intl/navigation"
import type { ComponentProps, ReactElement } from "react"

import { routing, type HrefArg, type Locale } from "@wildgrove/core/i18n/routing"

// Types only. This module deliberately does NOT re-export the `routing` table
// or `getPathname` as values: re-exporting them while also evaluating
// `createNavigation(routing)` at module scope makes Turbopack read the binding
// through this module mid-initialisation and throws
// "Cannot access 'n' before initialization" during page-data collection.
// The six call sites that need the table import it from @wildgrove/core directly.
export type { Locale, Pathnames } from "@wildgrove/core/i18n/routing"

// `createNavigation` returns Link/redirect/router with hrefs strictly typed to
// the keys of `pathnames`. That breaks the existing codebase which builds
// hrefs from dynamic strings (`/menu/${slug}`, `/account?highlight=name`,
// `/about#story`, …). The runtime behavior is unaffected — next-intl's Link
// looks the path up by string match. We re-export with widened types so
// existing call sites keep compiling while still benefitting from the
// per-locale URL translation declared above.
const _nav = createNavigation(routing)

type LinkProps = Omit<ComponentProps<typeof _nav.Link>, "href"> & {
  href: HrefArg
}

type RouterLike = {
  push: (href: HrefArg, options?: { scroll?: boolean }) => void
  replace: (href: HrefArg, options?: { scroll?: boolean; locale?: Locale }) => void
  prefetch: (href: HrefArg) => void
  back: () => void
  forward: () => void
  refresh: () => void
}

type RedirectArg = { href: HrefArg; locale: Locale; forcePrefix?: boolean }

export const Link = _nav.Link as unknown as (props: LinkProps) => ReactElement
export const useRouter = _nav.useRouter as unknown as () => RouterLike
export const usePathname = _nav.usePathname as unknown as () => string
export const redirect = _nav.redirect as unknown as (
  args: RedirectArg,
  type?: Parameters<typeof _nav.redirect>[1]
) => never
