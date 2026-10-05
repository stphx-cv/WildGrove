import type { MetadataRoute } from "next"
import { siteUrl } from "@wildgrove/core/urls"

/**
 * Content Signals declare what may be done with this site's content.
 * See wildgrove-vault/reference/05-api.md, "Documentos de descubrimiento".
 *
 *   search    | indexing and citation in AI search results — wanted, the site is a portfolio
 *   ai-input  | reading the live page to answer a question now — wanted, the whole point of the agent surface
 *   ai-train  | absorbing the content into model weights — declined, it returns nothing
 *
 * This is a declaration of preference, not an access control. It blocks nobody.
 * Enforcement, if it is ever wanted, is a different mechanism.
 */
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no"

export default function robots(): MetadataRoute.Robots {
    const baseUrl = siteUrl()

    return {
        rules: [
            {
                userAgent: "*",
                // The agent API is public and meant to be discovered. Everything
                // else under /api stays hidden — the Disallow below still covers
                // it, and Next emits Allow first so the narrower rule wins.
                allow: ["/", "/api/agent/"],
                disallow: [
                    "/api", "/api/",
                    "/en/portal", "/en/portal/",
                    "/es/portal", "/es/portal/",
                    "/en/auth", "/en/auth/",
                    "/es/auth", "/es/auth/",
                ],
                // Emitted after Allow/Disallow, inside this same group.
                other: { "Content-Signal": CONTENT_SIGNAL },
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
