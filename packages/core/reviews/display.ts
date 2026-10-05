// Shared helpers for public review display (reservation + product reviews)

export const MAX_HOME_PINNED_REVIEWS = 3
export const MAX_PRODUCT_PINNED_REVIEWS = 3

export function anonymizeReviewerName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string {
    const first = firstName?.trim() || ""
    const lastInitial = lastName?.trim()?.[0] || ""
    if (!first && !lastInitial) return "Guest"
    if (!lastInitial) return first
    return `${first} ${lastInitial}.`
}

export function buildAuthorSnapshot(profile: {
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
}) {
    return {
        authorDisplayName: anonymizeReviewerName(profile.firstName, profile.lastName),
        authorAvatarUrl: profile.avatarUrl?.trim() || null,
    }
}

export function resolvePublicAuthorName(
    authorDisplayName: string | null | undefined,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string {
    if (authorDisplayName?.trim()) return authorDisplayName.trim()
    return anonymizeReviewerName(firstName, lastName)
}

export function resolvePublicAvatarUrl(
    authorAvatarUrl: string | null | undefined,
    liveAvatarUrl: string | null | undefined,
): string | null {
    const snapshot = authorAvatarUrl?.trim()
    if (snapshot) return snapshot
    const live = liveAvatarUrl?.trim()
    return live || null
}

/** Public review card footer — full calendar date (day + month + year), locale-aware. */
export function formatPublicReviewDate(date: Date | string, locale: string): string {
    const value = typeof date === "string" ? new Date(date) : date
    return value.toLocaleDateString(locale === "es" ? "es-PE" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })
}
