// ══════════════════════════════════════════════════════════════════
// Markdown representations of the public pages, served to agents that
// ask for them with `Accept: text/markdown`.
//
// Built from the same data the pages render — never converted from the
// rendered HTML. A converter emits the nav, the cookie banner, button
// labels and empty layout containers, and it degrades silently on every
// layout change while still answering 200.
//
// This module is pure. It never reads the message catalogue itself,
// because those live in wildgrove-web and packages/core must not import
// from an app. The caller resolves keys and passes a `Translate` in.
// ══════════════════════════════════════════════════════════════════

import { resolveMenuCategoryDisplay } from "../menu-category-display"
import type { MenuCategoryData, MenuItemData } from "../data/menu-seed"

/**
 * Resolves one message key. Returns `null` when the key is absent, which
 * drops the block rather than emitting the raw key path into the output.
 * The caller decides whether a miss is worth logging.
 */
export type Translate = (key: string) => string | null

export type AgentLocale = "en" | "es"

// ── Primitives ────────────────────────────────────────────────────

/** Markdown block separator. Two newlines, exactly once, between blocks. */
export function joinBlocks(blocks: Array<string | null | undefined>): string {
    return blocks
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .join("\n\n")
}

export function heading(level: 1 | 2 | 3, text: string): string {
    return `${"#".repeat(level)} ${text.trim()}`
}

export function bulletList(items: Array<string | null | undefined>): string | null {
    const rows = items.filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    if (rows.length === 0) return null
    return rows.map((i) => `- ${i.trim()}`).join("\n")
}

/** Escapes the pipe so a value cannot break out of a table cell. */
export function cell(value: string): string {
    return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim()
}

export function table(headers: string[], rows: string[][]): string | null {
    if (rows.length === 0) return null
    const head = `| ${headers.map(cell).join(" | ")} |`
    const rule = `|${headers.map(() => "---").join("|")}|`
    const body = rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n")
    return [head, rule, body].join("\n")
}

/**
 * YAML front matter. Agents read it to know what they are holding without
 * parsing the prose, and it carries the canonical URL so a quoted extract
 * can be traced back to the page it came from.
 */
export function frontMatter(fields: Record<string, string | undefined>): string {
    const lines = Object.entries(fields)
        .filter(([, v]) => typeof v === "string" && v.length > 0)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    return ["---", ...lines, "---"].join("\n")
}

// ── Localized database fields ─────────────────────────────────────

/** Spanish column when the locale is Spanish and the column is filled. */
export function pickLocalized(
    en: string,
    es: string | null | undefined,
    locale: AgentLocale
): string {
    if (locale !== "es") return en
    const trimmed = (es ?? "").trim()
    return trimmed.length > 0 ? trimmed : en
}

export function itemSlug(item: MenuItemData, locale: AgentLocale): string {
    return pickLocalized(item.slug, item.slugEs, locale)
}

// ── Declarative page content ──────────────────────────────────────
//
// Which message keys are *content* and which are chrome is a judgement
// that has to be made once, explicitly, and kept next to the messages.
// Dumping a whole namespace would reproduce the failure D1 rejects.
//
// Keys are full dotted paths from the catalogue root ("about.storyP1"),
// because a page is free to draw from more than one namespace.

export type ContentBlock =
    | { block: "heading"; level: 2 | 3; key: string }
    | { block: "text"; key: string }
    | { block: "list"; keys: string[] }
    | { block: "section"; level?: 2 | 3; titleKey: string; body: ContentBlock[] }

export interface PageSpec {
    titleKey: string
    descriptionKey?: string
    blocks: ContentBlock[]
}

function renderBlock(b: ContentBlock, t: Translate): string | null {
    switch (b.block) {
        case "heading": {
            const text = t(b.key)
            return text ? heading(b.level, text) : null
        }
        case "text":
            return t(b.key)
        case "list":
            return bulletList(b.keys.map(t))
        case "section": {
            const title = t(b.titleKey)
            const body = joinBlocks(b.body.map((inner) => renderBlock(inner, t)))
            if (!title && !body) return null
            return joinBlocks([title ? heading(b.level ?? 2, title) : null, body])
        }
    }
}

export interface RenderOptions {
    /** Canonical absolute URL of the HTML page this represents. */
    url: string
    locale: AgentLocale
    /**
     * Rendered right after the H1, before anything else. Carries the portfolio
     * disclosure: the pages with a phone number, an address and opening hours
     * are exactly the ones an agent would otherwise read as a real business.
     */
    preamble?: string | null
    /** Appended after the spec blocks — hours, contact, links to siblings. */
    appendix?: Array<string | null>
}

export function renderPage(spec: PageSpec, t: Translate, opts: RenderOptions): string {
    const title = t(spec.titleKey) ?? "Wild Grove"
    const description = spec.descriptionKey ? t(spec.descriptionKey) : undefined

    return joinBlocks([
        frontMatter({
            title,
            description: description ?? undefined,
            url: opts.url,
            locale: opts.locale,
            site: "Wild Grove",
        }),
        heading(1, title),
        opts.preamble ?? null,
        description ?? null,
        ...spec.blocks.map((b) => renderBlock(b, t)),
        ...(opts.appendix ?? []),
    ])
}

// ── Menu ──────────────────────────────────────────────────────────

/**
 * Localized column and field labels. Resolved by the caller from the `agent`
 * namespace so no copy is hardcoded here — a Spanish document with English
 * table headers is exactly the kind of half-translation this site does not ship.
 */
export interface AgentLabels {
    dish: string
    price: string
    description: string
    url: string
    category: string
    tags: string
    available: string
    yes: string
    no: string
    /** "list", as in "list price" — the undiscounted amount, shown for context. */
    listPrice: string
}

export interface MenuRenderOptions extends RenderOptions {
    currency: "PEN" | "USD"
    /** Builds the absolute URL of one item's page. */
    itemUrl: (slug: string) => string
    /**
     * What the dish costs today, already formatted. Resolved by the caller
     * because it needs the active discounts, which this pure module does not
     * load — see ./pricing.ts.
     */
    priceOf: (item: MenuItemData) => string
    labels: AgentLabels
}

export function buildMenuMarkdown(
    categories: MenuCategoryData[],
    title: string,
    description: string | null,
    opts: MenuRenderOptions
): string {
    const sections = categories.map((cat) => {
        const label = resolveMenuCategoryDisplay({
            locale: opts.locale,
            category: cat.name,
            categoryEs: cat.nameEs,
            categorySlug: cat.slug,
        })

        const rows = cat.items.map((item) => [
            pickLocalized(item.name, item.nameEs, opts.locale),
            opts.priceOf(item),
            pickLocalized(item.description, item.descriptionEs, opts.locale),
            opts.itemUrl(itemSlug(item, opts.locale)),
        ])

        return joinBlocks([
            heading(2, label),
            table(
                [
                    opts.labels.dish,
                    `${opts.labels.price} (${opts.currency})`,
                    opts.labels.description,
                    opts.labels.url,
                ],
                rows
            ),
        ])
    })

    return joinBlocks([
        frontMatter({
            title,
            description: description ?? undefined,
            url: opts.url,
            locale: opts.locale,
            site: "Wild Grove",
            currency: opts.currency,
        }),
        heading(1, title),
        opts.preamble ?? null,
        description,
        ...sections,
        ...(opts.appendix ?? []),
    ])
}

export function buildMenuItemMarkdown(
    item: MenuItemData,
    categoryLabel: string | null,
    opts: MenuRenderOptions
): string {
    const name = pickLocalized(item.name, item.nameEs, opts.locale)
    const description = pickLocalized(item.description, item.descriptionEs, opts.locale)
    const tags = (opts.locale === "es" && item.tagsEs?.length ? item.tagsEs : item.tags) ?? []

    const L = opts.labels
    const facts = bulletList([
        categoryLabel ? `${L.category}: ${categoryLabel}` : null,
        `${L.price}: ${opts.priceOf(item)}`,
        tags.length > 0 ? `${L.tags}: ${tags.join(", ")}` : null,
        `${L.available}: ${item.available ? L.yes : L.no}`,
    ])

    return joinBlocks([
        frontMatter({
            title: name,
            description: description || undefined,
            url: opts.url,
            locale: opts.locale,
            site: "Wild Grove",
            currency: opts.currency,
        }),
        heading(1, name),
        opts.preamble ?? null,
        description,
        facts,
        ...(opts.appendix ?? []),
    ])
}
