// ══════════════════════════════════════════════════════════════════
// Statically imported translation messages (server side).
//
// `i18n/request.ts` used to load these with `await import(...)` on every
// request. That put an await in front of anything that needs a translation —
// including `generateMetadata`, which then races the HTML shell: if metadata
// loses, Next streams <title> into the body instead of inlining it in <head>,
// and the browser shows the raw URL in the tab until it arrives (visible on
// the dynamic, auth-bound routes such as /account).
//
// Both locales together are ~120 KB of JSON, resolved once at module
// evaluation instead of per request. Server-only — do not import from a
// client component, it would ship both locales to the browser.
// ══════════════════════════════════════════════════════════════════
import { routing } from "@wildgrove/core/i18n/routing"

import en from "../messages/en.json"
import es from "../messages/es.json"

type MessageTree = Record<string, Record<string, unknown>>

const MESSAGES: Record<string, MessageTree> = { en, es }

/** Message tree for a locale, falling back to the default locale. */
export function messagesFor(locale: string): MessageTree {
  return MESSAGES[locale] ?? MESSAGES[routing.defaultLocale]
}

/**
 * Synchronous `title` / `description` for a page's `generateMetadata`, read
 * straight from the messages rather than through next-intl's per-request
 * pipeline. No await means metadata can never lose the race against the shell,
 * so the title always ships inside <head>.
 *
 * Only for plain strings. Anything needing ICU formatting (placeholders,
 * plurals) must keep using `getTranslations`.
 */
export function pageMetadata(
  locale: string,
  namespace: string,
): { title?: string; description?: string } {
  const ns = messagesFor(locale)[namespace] as Record<string, unknown> | undefined
  const title = ns?.metaTitle
  const description = ns?.metaDescription

  return {
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof description === "string" ? { description } : {}),
  }
}
