// ══════════════════════════════════════════════════════════════════
// Social networks — the catalog, and the AppSettings.socialLinks value
//
// One row of AppSettings holds every network as { platformId: handle }.
// The catalog below is the single source of order: public pages render
// the active networks in this order, so a venue with eight of them
// still reads the same everywhere.
// ══════════════════════════════════════════════════════════════════

export type SocialPlatformId =
    | "instagram"
    | "facebook"
    | "tiktok"
    | "whatsapp"
    | "youtube"
    | "x"
    | "threads"
    | "linkedin"

export interface SocialPlatform {
    id: SocialPlatformId
    /** Brand name. Not translated — "Instagram" is "Instagram" in both locales. */
    label: string
    /** A phone number rather than a handle: stored E.164, entered with a country picker. */
    phone?: boolean
    /**
     * Adornment on the CMS field, where the domain is useful context for what
     * to paste. Never shown to a visitor.
     */
    inputPrefix: string
    /**
     * What a visitor sees in front of the handle. Empty for the networks whose
     * name is not an @handle: "wildgrove" reads better than
     * "linkedin.com/company/wildgrove" under a label that already says LinkedIn.
     */
    displayPrefix: string
    placeholder: string
    /** One-line helper under the CMS field. */
    hint: string
    buildUrl: (value: string) => string
}

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
    {
        id: "instagram",
        label: "Instagram",
        inputPrefix: "@",
        displayPrefix: "@",
        placeholder: "wildgrove",
        hint: "Profile handle, without the @.",
        buildUrl: (v) => `https://www.instagram.com/${encodeURIComponent(v)}/`,
    },
    {
        id: "facebook",
        label: "Facebook",
        inputPrefix: "facebook.com/",
        displayPrefix: "",
        placeholder: "wildgrove",
        hint: "The part of the page URL after facebook.com/.",
        buildUrl: (v) => `https://www.facebook.com/${encodeURIComponent(v)}`,
    },
    {
        id: "tiktok",
        label: "TikTok",
        inputPrefix: "@",
        displayPrefix: "@",
        placeholder: "wildgrove",
        hint: "Account name, without the @.",
        buildUrl: (v) => `https://www.tiktok.com/@${encodeURIComponent(v)}`,
    },
    {
        id: "whatsapp",
        label: "WhatsApp",
        phone: true,
        inputPrefix: "",
        displayPrefix: "",
        placeholder: "987654321",
        hint: "Pick the country code, then the number. Opens a chat at wa.me.",
        // wa.me wants bare digits; the stored value is E.164 with its "+".
        buildUrl: (v) => `https://wa.me/${encodeURIComponent(v.replace(/\D/g, ""))}`,
    },
    {
        id: "youtube",
        label: "YouTube",
        inputPrefix: "@",
        displayPrefix: "@",
        placeholder: "wildgrove",
        hint: "Channel handle, without the @.",
        buildUrl: (v) => `https://www.youtube.com/@${encodeURIComponent(v)}`,
    },
    {
        id: "x",
        label: "X",
        inputPrefix: "@",
        displayPrefix: "@",
        placeholder: "wildgrove",
        hint: "Account name, without the @.",
        buildUrl: (v) => `https://x.com/${encodeURIComponent(v)}`,
    },
    {
        id: "threads",
        label: "Threads",
        inputPrefix: "@",
        displayPrefix: "@",
        placeholder: "wildgrove",
        hint: "Profile handle, without the @.",
        buildUrl: (v) => `https://www.threads.com/@${encodeURIComponent(v)}`,
    },
    {
        id: "linkedin",
        label: "LinkedIn",
        inputPrefix: "linkedin.com/company/",
        displayPrefix: "",
        placeholder: "wildgrove",
        hint: "The part of the company page URL after /company/.",
        buildUrl: (v) => `https://www.linkedin.com/company/${encodeURIComponent(v)}`,
    },
] as const

const PLATFORM_BY_ID = new Map<string, SocialPlatform>(SOCIAL_PLATFORMS.map((p) => [p.id, p]))

export function getSocialPlatform(id: string): SocialPlatform | null {
    return PLATFORM_BY_ID.get(id) ?? null
}

export function isSocialPlatformId(id: unknown): id is SocialPlatformId {
    return typeof id === "string" && PLATFORM_BY_ID.has(id)
}

const MAX_HANDLE_LENGTH = 64
const MAX_PHONE_DIGITS = 20

/**
 * WhatsApp added usernames on top of phone numbers, so one network needs two
 * values. The number stays under "whatsapp" — it is what wa.me links to — and
 * the username rides along under its own reserved key. It is not a platform of
 * its own: it never gets a pill, it only changes how the WhatsApp one reads.
 */
export const WHATSAPP_USERNAME_KEY = "whatsappUsername" as const

/**
 * Path segments that describe the shape of a profile URL rather than the
 * handle: the "company" in linkedin.com/company/wild-grove, the "channel" in
 * youtube.com/channel/UC….
 */
const STRUCTURAL_SEGMENTS = new Set(["c", "channel", "company", "in", "pages", "profile", "user"])

/**
 * Accepts what an owner actually types: a bare handle, an @handle, or the whole
 * profile URL pasted from the browser — including one with a tab on the end,
 * which is how a browser hands you `youtube.com/@wildgrove/videos`.
 */
export function normalizeSocialValue(platformId: string, raw: unknown): string {
    if (platformId === WHATSAPP_USERNAME_KEY) return normalizeHandle(raw)

    const platform = getSocialPlatform(platformId)
    if (!platform || typeof raw !== "string") return ""

    const trimmed = raw.trim()
    if (!trimmed) return ""

    // E.164, so <PhoneInput> round-trips it and a stored bare number gains its "+".
    if (platform.phone) {
        const digits = trimmed.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS)
        return digits ? `+${digits}` : ""
    }

    // Drop the scheme and host of a pasted URL, keeping the path.
    let value = trimmed.replace(/^(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?=\/)/i, "")
    value = value.split(/[?#]/)[0] ?? ""
    const segments = value.split("/").filter(Boolean)

    // An @segment is the handle wherever it sits; otherwise it is the first
    // segment, unless that one only describes the shape of the URL.
    let segment =
        segments.find((part) => part.startsWith("@")) ??
        (STRUCTURAL_SEGMENTS.has((segments[0] ?? "").toLowerCase()) ? segments[1] : segments[0]) ??
        ""

    segment = segment.replace(/^@+/, "")
    return segment.replace(/[^A-Za-z0-9._-]/g, "").slice(0, MAX_HANDLE_LENGTH)
}

/** The plain-handle rules, for values that are never a URL. */
function normalizeHandle(raw: unknown): string {
    if (typeof raw !== "string") return ""
    return raw
        .trim()
        .replace(/^@+/, "")
        .replace(/[^A-Za-z0-9._-]/g, "")
        .slice(0, MAX_HANDLE_LENGTH)
}

/** Reserved keys the flat shape uses alongside the platform ids. */
export type SocialStoredKey = SocialPlatformId | typeof WHATSAPP_USERNAME_KEY

export function isSocialStoredKey(key: unknown): key is SocialStoredKey {
    return isSocialPlatformId(key) || key === WHATSAPP_USERNAME_KEY
}

const MAX_LABEL_LENGTH = 40

/** Free display text, so it keeps its accents and spaces — only trimmed and capped. */
export function normalizeSocialLabel(raw: unknown): string {
    if (typeof raw !== "string") return ""
    return raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH)
}

export interface SocialLinkEntry {
    /** Handle, or E.164 number for a phone network. */
    value: string
    /** Shown in place of the value. Display only: it never reaches Sage or the agent API. */
    label?: string
    /** WhatsApp only. */
    username?: string
}

export interface SocialLinksConfig {
    /** Pills show the network name alone, centred: no handle, no label. */
    hideHandles: boolean
    links: Partial<Record<SocialPlatformId, SocialLinkEntry>>
}

export const EMPTY_SOCIAL_LINKS: SocialLinksConfig = { hideHandles: false, links: {} }

/**
 * Reads both shapes the column has held, so nothing needed a migration:
 *
 *   flat     { "instagram": "wildgrove", "whatsappUsername": "wg" }
 *   current  { "hideHandles": true, "links": { "instagram": { "value": …, "label": … } } }
 *
 * A row written by the old CMS is upgraded the next time it is saved. Unknown
 * keys are dropped either way, so the column only ever holds what can render.
 */
export function parseSocialLinks(raw: unknown): SocialLinksConfig {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { hideHandles: false, links: {} }
    const source = raw as Record<string, unknown>

    const nested = source.links
    const entries: Record<string, unknown> =
        nested && typeof nested === "object" && !Array.isArray(nested)
            ? (nested as Record<string, unknown>)
            : source

    const links: SocialLinksConfig["links"] = {}
    for (const platform of SOCIAL_PLATFORMS) {
        const cell = entries[platform.id]
        // The flat shape stored the handle directly; the nested one wraps it.
        const rawValue = typeof cell === "string" ? cell : (cell as Record<string, unknown> | undefined)?.value
        const value = normalizeSocialValue(platform.id, rawValue)
        if (!value) continue

        const entry: SocialLinkEntry = { value }
        const label = normalizeSocialLabel(
            typeof cell === "object" && cell !== null ? (cell as Record<string, unknown>).label : undefined,
        )
        if (label) entry.label = label

        if (platform.id === "whatsapp") {
            const fromNested =
                typeof cell === "object" && cell !== null ? (cell as Record<string, unknown>).username : undefined
            // The flat shape kept the username as a sibling of the platforms.
            const username = normalizeSocialValue(WHATSAPP_USERNAME_KEY, fromNested ?? source[WHATSAPP_USERNAME_KEY])
            if (username) entry.username = username
        }

        links[platform.id] = entry
    }

    return { hideHandles: source.hideHandles === true, links }
}

/** What the CMS writes back. Parsing is the normalization. */
export function normalizeSocialLinksForStorage(raw: unknown): SocialLinksConfig {
    return parseSocialLinks(raw)
}

export interface ResolvedSocialLink {
    id: SocialPlatformId
    /** Network name: "Instagram", "WhatsApp". */
    label: string
    /** The stored handle or number, with no decoration. */
    value: string
    /**
     * The truthful reading of the account — "@wildgrove", "+51…" — ignoring any
     * custom label. Sage and the agent API use this: a label is decoration, and
     * an assistant repeating it would be telling a guest the wrong handle.
     */
    handle: string
    /** What a pill shows on its value line: the custom label when there is one. */
    display: string
    url: string
}

/** Active networks, in catalog order. Empty fields never reach a page. */
export function resolveSocialLinks(raw: unknown): ResolvedSocialLink[] {
    const { links } = parseSocialLinks(raw)
    const out: ResolvedSocialLink[] = []
    for (const platform of SOCIAL_PLATFORMS) {
        const entry = links[platform.id]
        if (!entry) continue
        // A username reads better than a phone number, but the link still goes
        // through the number: wa.me by digits is the format we know works.
        const handle = entry.username ? `@${entry.username}` : `${platform.displayPrefix}${entry.value}`
        out.push({
            id: platform.id,
            label: platform.label,
            value: entry.value,
            handle,
            display: entry.label || handle,
            url: platform.buildUrl(entry.value),
        })
    }
    return out
}

/** True when pills should show the network name alone. */
export function socialHandlesHidden(raw: unknown): boolean {
    return parseSocialLinks(raw).hideHandles
}

export function findSocialLink(raw: unknown, id: SocialPlatformId): ResolvedSocialLink | null {
    return resolveSocialLinks(raw).find((link) => link.id === id) ?? null
}

/** Profile URLs for schema.org `sameAs`, in catalog order. */
export function socialProfileUrls(raw: unknown): string[] {
    return resolveSocialLinks(raw).map((link) => link.url)
}
