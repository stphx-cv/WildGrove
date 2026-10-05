// ══════════════════════════════════════════════════════════════════
// Markdown representation of the public pages.
//
// Never linked and never navigated to directly: proxy.ts rewrites here
// when a request for a public page carries `Accept: text/markdown`, so
// the URL the agent asked for is the URL it keeps. The canonical route
// pattern arrives in `x-agent-page`, already resolved by the proxy, which
// is why this handler does not repeat the localized-slug matching.
//
// See wildgrove-vault/reference/05-api.md, "Cualquier página se puede pedir en markdown".
// ══════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server"
import { routing, type Locale } from "@wildgrove/core/i18n/routing"
import { absoluteLocalizedUrl } from "@wildgrove/core/seo/alternates"
import { resolveMenuCategoryDisplay } from "@wildgrove/core/menu-category-display"
import {
    renderPage,
    buildMenuMarkdown,
    buildMenuItemMarkdown,
    joinBlocks,
    heading,
    bulletList,
    itemSlug,
    type AgentLabels,
    type Translate,
} from "@wildgrove/core/agent/markdown"
import { MARKDOWN_PAGES, PAGE_SPECS, type MarkdownPage } from "@wildgrove/core/agent/page-specs"
import { agentPrice, formatAgentPrice, getAgentCurrency, getAgentDiscounts } from "@wildgrove/core/agent/pricing"
import {
    getAgentMenu,
    getAgentMenuItem,
    getAgentVenueFacts,
    type AgentVenueFacts,
} from "@wildgrove/core/agent/queries"
import { SITE_REPO_URL } from "@wildgrove/core/site-creator"
import { getEnvFallbackContactEmail } from "@wildgrove/core/public-contact"
import { messagesFor } from "@/i18n/messages"

/**
 * The rich-text tags the HTML pages render through `t.rich`, turned into
 * their markdown equivalent so an agent never reads a raw `<strong>`.
 */
function richToMarkdown(value: string): string {
    return value
        .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
        .replace(/<email>(.*?)<\/email>/g, `[$1](mailto:${getEnvFallbackContactEmail()})`)
        .replace(/<repo>(.*?)<\/repo>/g, `[$1](${SITE_REPO_URL})`)
}

/**
 * Resolves a dotted path ("privacy.sections.owner.body") against the catalogue.
 * Returns null when the key is absent so the block is dropped rather than
 * printed as its own key path.
 */
function translatorFor(locale: Locale): Translate {
    const tree = messagesFor(locale) as Record<string, unknown>
    return (key) => {
        const value = key
            .split(".")
            .reduce<unknown>((node, part) => {
                if (node && typeof node === "object" && part in (node as object)) {
                    return (node as Record<string, unknown>)[part]
                }
                return undefined
            }, tree)
        return typeof value === "string" && value.trim().length > 0 ? richToMarkdown(value) : null
    }
}

/** Hours and contact, appended to every page that renders from a spec. */
function venueAppendix(facts: AgentVenueFacts, t: Translate): Array<string | null> {
    const hours = facts.openingHours.length
        ? joinBlocks([
              heading(2, t("agent.openingHours") ?? "Opening hours"),
              bulletList(facts.openingHours),
          ])
        : null

    const contact = bulletList([
        facts.address ? `${t("agent.address")}: ${facts.address}` : null,
        facts.phone ? `${t("agent.phone")}: ${facts.phone}` : null,
        facts.email ? `Email: ${facts.email}` : null,
        ...facts.socials.map((social) => `${social.network}: ${social.handle}`),
    ])

    return [
        hours,
        contact
            ? joinBlocks([heading(2, t("agent.contact") ?? "Contact"), contact])
            : null,
    ]
}

/** Links to the other public pages, so an agent can walk the site. */
function siblingAppendix(current: MarkdownPage, locale: Locale, t: Translate): string | null {
    const siblings: Array<[MarkdownPage, string]> = [
        ["/", "agent.home"],
        ["/menu", "nav.menu"],
        ["/reservations", "nav.reservations"],
        ["/about", "nav.about"],
        ["/contact", "nav.contact"],
        ["/privacy", "privacy.heroTitle"],
        ["/terms", "terms.heroTitle"],
    ]

    const rows = siblings
        .filter(([href]) => href !== current)
        .map(([href, labelKey]) => {
            const label = t(labelKey)
            return label ? `[${label}](${absoluteLocalizedUrl(href as never, locale)})` : null
        })

    const list = bulletList(rows)
    return list
        ? joinBlocks([heading(2, t("agent.otherPages") ?? "Other pages"), list])
        : null
}

function markdownResponse(body: string): NextResponse {
    return new NextResponse(body.endsWith("\n") ? body : `${body}\n`, {
        status: 200,
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            // Two representations live at one URL. Without this the CDN will
            // hand markdown to a browser, or HTML to an agent, intermittently.
            Vary: "Accept",
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
    })
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params
    const [localeSegment, ...rest] = path

    const locale = (routing.locales as readonly string[]).includes(localeSegment)
        ? (localeSegment as Locale)
        : routing.defaultLocale

    // Set by proxy.ts on the rewrite. Absent means this route was requested
    // directly, which is not how it is meant to be reached. The proxy does not run on
    // /api, so a caller can send the header itself: only a known page is accepted.
    const header = request.headers.get("x-agent-page")
    if (!header || !(MARKDOWN_PAGES as readonly string[]).includes(header)) return new NextResponse("Not found", { status: 404 })
    const page = header as MarkdownPage

    const t = translatorFor(locale)
    const currency = await getAgentCurrency()

    const label = (k: keyof AgentLabels, fallback: string) => t(`agent.${k}`) ?? fallback
    const labels: AgentLabels = {
        dish: label("dish", "Dish"),
        price: label("price", "Price"),
        description: label("description", "Description"),
        url: label("url", "URL"),
        category: label("category", "Category"),
        tags: label("tags", "Tags"),
        available: label("available", "Available"),
        yes: label("yes", "yes"),
        no: label("no", "no"),
        listPrice: label("listPrice", "list"),
    }

    // The portfolio disclosure, first on every page. The reservations and
    // menu pages carry a phone number, an address and opening hours; without
    // this line an agent reads them as a business that exists.
    const disclosure = t("common.portfolioDisclosure")
    const preamble = disclosure ? `> ${disclosure}` : null

    // ── /menu/[slug] ──────────────────────────────────────────────
    if (page === "/menu/[slug]") {
        const slug = rest[rest.length - 1]
        if (!slug) return new NextResponse("Not found", { status: 404 })

        const [found, discounts] = await Promise.all([getAgentMenuItem(slug), getAgentDiscounts()])
        if (!found) return new NextResponse("Not found", { status: 404 })

        const url = absoluteLocalizedUrl("/menu/[slug]" as never, locale, {
            slug: itemSlug(found.item, locale),
        } as never)

        return markdownResponse(
            buildMenuItemMarkdown(
                found.item,
                resolveMenuCategoryDisplay({
                    locale,
                    category: found.categoryName,
                    categoryEs: found.categoryNameEs,
                    categorySlug: found.categorySlug,
                }),
                {
                    url,
                    locale,
                    currency,
                    labels,
                    preamble,
                    priceOf: (i) =>
                        formatAgentPrice(agentPrice(i, discounts, currency), labels.listPrice),
                    itemUrl: (s) =>
                        absoluteLocalizedUrl("/menu/[slug]" as never, locale, { slug: s } as never),
                    appendix: [siblingAppendix("/menu/[slug]", locale, t)],
                }
            )
        )
    }

    // ── /menu ─────────────────────────────────────────────────────
    if (page === "/menu") {
        const [categories, facts, discounts] = await Promise.all([
            getAgentMenu(),
            getAgentVenueFacts(locale),
            getAgentDiscounts(),
        ])

        return markdownResponse(
            buildMenuMarkdown(
                categories,
                t("menu.heroTitle") ?? "Menu",
                t("menu.metaDescription"),
                {
                    url: absoluteLocalizedUrl("/menu" as never, locale),
                    locale,
                    currency,
                    labels,
                    preamble,
                    priceOf: (i) =>
                        formatAgentPrice(agentPrice(i, discounts, currency), labels.listPrice),
                    itemUrl: (s) =>
                        absoluteLocalizedUrl("/menu/[slug]" as never, locale, { slug: s } as never),
                    appendix: [
                        t("menu.allergyNote"),
                        ...venueAppendix(facts, t),
                        siblingAppendix("/menu", locale, t),
                    ],
                }
            )
        )
    }

    // ── Everything rendered from a curated spec ───────────────────
    const spec = PAGE_SPECS[page as keyof typeof PAGE_SPECS]
    if (!spec) return new NextResponse("Not found", { status: 404 })

    const facts = await getAgentVenueFacts(locale)

    return markdownResponse(
        renderPage(spec, t, {
            url: absoluteLocalizedUrl(page as never, locale),
            locale,
            preamble,
            appendix: [...venueAppendix(facts, t), siblingAppendix(page, locale, t)],
        })
    )
}
