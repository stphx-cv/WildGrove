// ══════════════════════════════════════════════════════════════════
// Public contact / brand — values from AppSettings (CMS)
// Empty CMS fields → null (caller hides UI)
// ══════════════════════════════════════════════════════════════════

import { COUNTRIES } from "./phone"

export function getEnvFallbackContactEmail(): string {
    return "contact@wildgrove.cv"
}

export function getPublicSiteHost(): string {
    const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://wildgrove.cv"
    try {
        return new URL(raw).hostname.replace(/^www\./, "")
    } catch {
        return "wildgrove.cv"
    }
}

export function trimmedContact(value: string | null | undefined): string | null {
    const t = (value ?? "").trim()
    return t.length > 0 ? t : null
}

export function googleMapsEmbedSrc(address: string): string {
    return `https://maps.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed&z=16`
}

export function googleMapsExternalUrl(address: string): string {
    return `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`
}

/**
 * "+51 967 430 874" → "+51967430874". <PhoneInput> only parses a value in this
 * shape, so a number typed freely has to pass through here or
 * the picker silently comes up blank and looks like the number was lost.
 */
export function toE164(value: string | null | undefined): string {
    const digits = (value ?? "").replace(/\D/g, "")
    return digits ? `+${digits}` : ""
}

/**
 * "+51967430874" → "+51 967430874". The CMS stores E.164 now, and an unbroken
 * run of digits is hard to read. Only the country code is split off: grouping
 * the rest would need per-country rules, and guessing them wrong is worse than
 * not grouping. A value that is not bare E.164, such as anything typed freely,
 * comes back exactly as it was stored.
 */
export function formatPhoneForDisplay(value: string | null | undefined): string {
    const raw = (value ?? "").trim()
    if (!/^\+\d{4,20}$/.test(raw)) return raw
    const digits = raw.slice(1)
    // Longest dial code first, so "+506…" is Costa Rica and not "+50" plus a 6.
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
    for (const country of sorted) {
        if (!digits.startsWith(country.dialCode)) continue
        const local = digits.slice(country.dialCode.length)
        if (local && local.length <= country.maxDigits) return `+${country.dialCode} ${local}`
    }
    return raw
}

/** tel: href — keeps leading + and digits */
export function telHrefFromDisplay(phone: string): string {
    const compact = phone.replace(/[^\d+]/g, "")
    if (compact.startsWith("+")) return compact
    const digits = compact.replace(/\D/g, "")
    return digits ? `+${digits}` : ""
}
