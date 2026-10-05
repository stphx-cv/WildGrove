// ══════════════════════════════════════════════════════════════════
// HTML email template loader.
//
// The templates used to be read as `process.cwd()/emails/templates/...`, which
// only worked while they lived inside the one app that read them. They are now
// shared by both apps from @wildgrove/core, so the directory is resolved from
// this module's own location first, with the app-relative and legacy layouts
// kept as fallbacks. Every candidate is reported if none exists — a missing
// template must never fail as a bare ENOENT on an unexplained path.
//
// Both apps also declare these files in `outputFileTracingIncludes` so Next
// copies them into the serverless bundle.
// ══════════════════════════════════════════════════════════════════
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { cmsLink, siteUrl } from "../urls"

function candidateDirs(): string[] {
    const dirs: string[] = []

    // 1 — next to this module (packages/core/emails/templates)
    try {
        dirs.push(path.join(path.dirname(fileURLToPath(import.meta.url)), "templates"))
    } catch {
        // bundled without import.meta — fall through to the cwd candidates
    }

    const cwd = process.cwd()
    // 2 — an app running from its own directory inside the monorepo
    dirs.push(path.join(cwd, "..", "packages", "core", "emails", "templates"))
    // 3 — the repo root (turbo, scripts)
    dirs.push(path.join(cwd, "packages", "core", "emails", "templates"))
    // 4 — pre-split layout
    dirs.push(path.join(cwd, "emails", "templates"))

    return dirs
}

let resolvedDir: string | null = null

function templatesDir(): string {
    if (resolvedDir) return resolvedDir

    const candidates = candidateDirs()
    const found = candidates.find((dir) => fs.existsSync(dir))
    if (!found) {
        throw new Error(
            `[@wildgrove/core] Email templates directory not found. Looked in:\n  ${candidates.join("\n  ")}`,
        )
    }

    resolvedDir = found
    return found
}

/**
 * Loads `emails/templates/{locale}/{name}_{locale}.html` and replaces every
 * `{{KEY}}` placeholder with the matching value.
 */
export function loadEmailTemplate(
    name: string,
    vars: Record<string, string>,
    locale: "en" | "es" = "en",
): string {
    const filename = `${name.replace(".html", "")}_${locale}.html`
    const filePath = path.join(templatesDir(), locale, filename)

    let html = fs.readFileSync(filePath, "utf-8")

    // Cross-app links are resolved from the environment, never hardcoded in a
    // template: the CMS moved to its own host and dropped the /admin prefix.
    const allVars: Record<string, string> = {
        SITE_URL: siteUrl(),
        CMS_URL: cmsLink(),
        CMS_ORDERS_URL: cmsLink("/orders"),
        CMS_TICKETS_URL: cmsLink("/tickets"),
        ...vars,
    }

    for (const [key, value] of Object.entries(allVars)) {
        html = html.replaceAll(`{{${key}}}`, value)
    }
    return html
}
