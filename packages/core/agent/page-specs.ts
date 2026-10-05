// ══════════════════════════════════════════════════════════════════
// What each public page contains when it is served as markdown.
//
// Curated on purpose. The message catalogue holds content and chrome in
// the same namespace — `privacy.section3Body` is content, `privacy.sidebarTitle`
// and `contact.ctaButton` are not — and only a human reading it can tell
// them apart. Emitting a whole namespace would put button labels and
// breadcrumbs in front of an agent, the same failure that rules out
// converting the rendered HTML, and it is no better done from JSON.
//
// When a key here stops existing, its block disappears from the output
// rather than emitting the raw key path. Keep this file in step with
// wildgrove-web/messages/*.json.
// ══════════════════════════════════════════════════════════════════

import type { PageSpec } from "./markdown"

/** Canonical hrefs that answer to `Accept: text/markdown`. */
export const MARKDOWN_PAGES = [
    "/",
    "/menu",
    "/menu/[slug]",
    "/reservations",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
] as const

export type MarkdownPage = (typeof MARKDOWN_PAGES)[number]

/**
 * `/menu` and `/menu/[slug]` are absent: they are built from the database
 * by `buildMenuMarkdown` and `buildMenuItemMarkdown`, not from message keys.
 */
export const PAGE_SPECS: Record<
    Exclude<MarkdownPage, "/menu" | "/menu/[slug]">,
    PageSpec
> = {
    "/": {
        titleKey: "hero.title2",
        descriptionKey: "hero.description",
        blocks: [
            { block: "text", key: "philosophy.quote" },
            {
                block: "section",
                titleKey: "philosophy.plantForwardTitle",
                body: [{ block: "text", key: "philosophy.plantForwardDesc" }],
            },
            {
                block: "section",
                titleKey: "philosophy.locallySourcedTitle",
                body: [{ block: "text", key: "philosophy.locallySourcedDesc" }],
            },
            {
                block: "section",
                titleKey: "philosophy.zeroWasteTitle",
                body: [{ block: "text", key: "philosophy.zeroWasteDesc" }],
            },
        ],
    },

    "/about": {
        titleKey: "about.heroTitle",
        descriptionKey: "about.metaDescription",
        blocks: [
            { block: "text", key: "about.storyP1" },
            { block: "text", key: "about.storyP2" },
            { block: "text", key: "about.storyP3" },
            {
                block: "section",
                titleKey: "about.valuesTitle",
                body: [
                    {
                        block: "section",
                        level: 3,
                        titleKey: "about.value1Title",
                        body: [{ block: "text", key: "about.value1Description" }],
                    },
                    {
                        block: "section",
                        level: 3,
                        titleKey: "about.value2Title",
                        body: [{ block: "text", key: "about.value2Description" }],
                    },
                    {
                        block: "section",
                        level: 3,
                        titleKey: "about.value3Title",
                        body: [{ block: "text", key: "about.value3Description" }],
                    },
                ],
            },
        ],
    },

    "/reservations": {
        titleKey: "reservations.heroTitle",
        descriptionKey: "reservations.heroDescription",
        blocks: [
            {
                block: "section",
                titleKey: "reservations.walkInsTitle",
                body: [{ block: "text", key: "reservations.walkInsDescription" }],
            },
            {
                block: "section",
                titleKey: "reservations.policiesTitle",
                body: [
                    {
                        block: "section",
                        level: 3,
                        titleKey: "reservations.policyArrivalTitle",
                        body: [{ block: "text", key: "reservations.policyArrivalText" }],
                    },
                    {
                        block: "section",
                        level: 3,
                        titleKey: "reservations.policyLargePartiesTitle",
                        body: [{ block: "text", key: "reservations.policyLargePartiesText" }],
                    },
                    {
                        block: "section",
                        level: 3,
                        titleKey: "reservations.policyDietaryTitle",
                        body: [{ block: "text", key: "reservations.policyDietaryText" }],
                    },
                    {
                        block: "section",
                        level: 3,
                        titleKey: "reservations.policyCancellationTitle",
                        body: [{ block: "text", key: "reservations.policyCancellationText" }],
                    },
                ],
            },
        ],
    },

    "/contact": {
        titleKey: "contact.heroTitle",
        descriptionKey: "contact.heroDescription",
        blocks: [
            {
                block: "section",
                titleKey: "contact.sageTitle",
                body: [{ block: "text", key: "contact.sageDescription" }],
            },
        ],
    },

    "/privacy": {
        titleKey: "privacy.heroTitle",
        descriptionKey: "privacy.metaDescription",
        blocks: [
            { block: "text", key: "privacy.lastUpdated" },
            {
                block: "section",
                titleKey: "privacy.sections.owner.title",
                body: [
                    { block: "text", key: "privacy.sections.owner.body" },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.collect.title",
                body: [
                    { block: "text", key: "privacy.sections.collect.body" },
                    {
                        block: "list",
                        keys: [
                            "privacy.sections.collect.items.account",
                            "privacy.sections.collect.items.reservations",
                            "privacy.sections.collect.items.orders",
                            "privacy.sections.collect.items.reviews",
                            "privacy.sections.collect.items.chat",
                            "privacy.sections.collect.items.technical",
                        ],
                    },
                    { block: "text", key: "privacy.sections.collect.outro" },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.use.title",
                body: [
                    { block: "text", key: "privacy.sections.use.body" },
                    {
                        block: "list",
                        keys: [
                            "privacy.sections.use.items.account",
                            "privacy.sections.use.items.emails",
                            "privacy.sections.use.items.reviews",
                            "privacy.sections.use.items.chat",
                            "privacy.sections.use.items.abuse",
                        ],
                    },
                    { block: "text", key: "privacy.sections.use.outro" },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.processors.title",
                body: [
                    { block: "text", key: "privacy.sections.processors.body" },
                    {
                        block: "list",
                        keys: [
                            "privacy.sections.processors.items.insforge",
                            "privacy.sections.processors.items.ai",
                            "privacy.sections.processors.items.maps",
                            "privacy.sections.processors.items.google",
                            "privacy.sections.processors.items.upstash",
                            "privacy.sections.processors.items.email",
                        ],
                    },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.retention.title",
                body: [
                    { block: "text", key: "privacy.sections.retention.body" },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.rights.title",
                body: [
                    { block: "text", key: "privacy.sections.rights.body" },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.cookies.title",
                body: [
                    { block: "text", key: "privacy.sections.cookies.body" },
                ],
            },
            {
                block: "section",
                titleKey: "privacy.sections.contact.title",
                body: [{ block: "text", key: "privacy.contactDescription" }],
            },
        ],
    },

    "/terms": {
        titleKey: "terms.heroTitle",
        descriptionKey: "terms.metaDescription",
        blocks: [
            { block: "text", key: "terms.lastUpdated" },
            {
                block: "section",
                titleKey: "terms.sections.about.title",
                body: [
                    { block: "text", key: "terms.sections.about.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.use.title",
                body: [
                    { block: "text", key: "terms.sections.use.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.accounts.title",
                body: [
                    { block: "text", key: "terms.sections.accounts.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.orders.title",
                body: [
                    { block: "text", key: "terms.sections.orders.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.reviews.title",
                body: [
                    { block: "text", key: "terms.sections.reviews.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.ip.title",
                body: [
                    { block: "text", key: "terms.sections.ip.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.liability.title",
                body: [
                    { block: "text", key: "terms.sections.liability.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.changes.title",
                body: [
                    { block: "text", key: "terms.sections.changes.body" },
                ],
            },
            {
                block: "section",
                titleKey: "terms.sections.contact.title",
                body: [{ block: "text", key: "terms.contactDescription" }],
            },
        ],
    },
}
