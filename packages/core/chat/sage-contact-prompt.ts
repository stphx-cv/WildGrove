// ══════════════════════════════════════════════════════════════════
// Sage system prompt, contact lines from CMS + env inbox/site
// ══════════════════════════════════════════════════════════════════

import { formatPhoneForDisplay, getPublicSiteHost, trimmedContact } from "../public-contact"
import { resolveSocialLinks, type ResolvedSocialLink, type SocialPlatformId } from "../social-links"
import type { getAppSettings } from "../settings"

type Settings = Awaited<ReturnType<typeof getAppSettings>>

/**
 * Sage offers one network, not eight, when it runs out of answers — and it has
 * to be one a guest can actually write to, in this order of preference.
 */
const DIRECT_MESSAGE_PLATFORMS: readonly SocialPlatformId[] = ["whatsapp", "instagram"]

function directMessageChannel(s: Settings): ResolvedSocialLink | null {
    const links = resolveSocialLinks(s.socialLinks)
    for (const id of DIRECT_MESSAGE_PLATFORMS) {
        const found = links.find((link) => link.id === id)
        if (found) return found
    }
    return null
}

export function buildSageRestaurantIdentityMarkdown(locale: "en" | "es", s: Settings): string {
    const lines: string[] = []
    lines.push(locale === "es" ? "**Nombre:** Wild Grove" : "**Name:** Wild Grove")
    const addr = trimmedContact(s.contactAddress)
    if (addr) lines.push((locale === "es" ? "**Ubicación:** " : "**Location:** ") + addr)
    const phone = formatPhoneForDisplay(s.contactPhone) || null
    if (phone) lines.push((locale === "es" ? "**Teléfono:** " : "**Phone:** ") + phone)
    for (const link of resolveSocialLinks(s.socialLinks)) {
        lines.push(`**${link.label}:** ${link.handle}`)
    }
    const inbox = trimmedContact(s.publicContactEmail)
    if (inbox) lines.push((locale === "es" ? "**Email:** " : "**Email:** ") + inbox)
    lines.push((locale === "es" ? "**Sitio web:** " : "**Website:** ") + getPublicSiteHost())
    return lines.join("\n")
}

/**
 * The channels a person can actually write to. The writer phrases them
 * itself, and only when the guest asked how to reach the team or only a
 * person can answer. It is not a sentence to paste when a fact is missing.
 */
export function buildSageUnknownContactHint(locale: "en" | "es", s: Settings): string {
    const phone = formatPhoneForDisplay(s.contactPhone) || null
    const inbox = trimmedContact(s.publicContactEmail)
    const social = directMessageChannel(s)

    if (locale === "es") {
        if (!phone && !social) {
            return inbox
                ? `escribirnos a ${inbox} o la página [Contacto](/contact)`
                : "la página [Contacto](/contact)"
        }
        const bits: string[] = []
        if (inbox) bits.push(`escribirnos a ${inbox}`)
        if (phone) bits.push(`llamar al ${phone}`)
        if (social) bits.push(`escribirnos por ${social.label} ${social.handle}`)
        return bits.join(", ")
    }

    if (!phone && !social) {
        return inbox
            ? `email us at ${inbox} or the [Contact](/contact) page`
            : "the [Contact](/contact) page"
    }
    const bits: string[] = []
    if (inbox) bits.push(`email us at ${inbox}`)
    if (phone) bits.push(`call ${phone}`)
    if (social) bits.push(`message us on ${social.label} ${social.handle}`)
    return bits.join(", ")
}

/** The fixed reply when the conversation's quota of answers is spent: what happened and where to write. */
export function buildChatFallbackUserMessage(locale: "en" | "es", s: Settings): string {
    const phone = formatPhoneForDisplay(s.contactPhone) || null
    const inbox = trimmedContact(s.publicContactEmail)
    const social = directMessageChannel(s)
    if (locale === "es") {
        if (!phone && !social) {
            return inbox
                ? `Por ahora no puedo responder más mensajes. Vuelve a intentarlo más tarde o escríbenos a ${inbox}, o desde la [página de contacto](/contact).`
                : "Por ahora no puedo responder más mensajes. Vuelve a intentarlo más tarde o escríbenos desde la [página de contacto](/contact)."
        }
        const bits: string[] = []
        if (inbox) bits.push(`escríbenos a ${inbox}`)
        if (phone) bits.push(`llama al ${phone}`)
        if (social) bits.push(`escríbenos por ${social.label} ${social.handle}`)
        return `Por ahora no puedo responder más mensajes. Vuelve a intentarlo más tarde o ${bits.join(" o ")}.`
    }
    if (!phone && !social) {
        return inbox
            ? `I can't answer more messages for now. Try again later, or email us at ${inbox} or write from the [contact page](/contact).`
            : "I can't answer more messages for now. Try again later, or write to us from the [contact page](/contact)."
    }
    const bits: string[] = []
    if (inbox) bits.push(`email us at ${inbox}`)
    if (phone) bits.push(`call ${phone}`)
    if (social) bits.push(`message us on ${social.label} ${social.handle}`)
    return `I can't answer more messages for now. Try again later, or ${bits.join(" or ")}.`
}

/** The fixed reply when the model fails: what happened, and where to write. */
export function buildChatErrorUserMessage(locale: "en" | "es", s: Settings): string {
    const phone = formatPhoneForDisplay(s.contactPhone) || null
    const inbox = trimmedContact(s.publicContactEmail)
    const social = directMessageChannel(s)
    if (locale === "es") {
        if (!phone && !social) {
            return inbox
                ? `No pude responder en este momento. Inténtalo de nuevo en unos minutos o escríbenos a ${inbox}, o desde la [página de contacto](/contact).`
                : "No pude responder en este momento. Inténtalo de nuevo en unos minutos o escríbenos desde la [página de contacto](/contact)."
        }
        const bits: string[] = []
        if (inbox) bits.push(`escríbenos a ${inbox}`)
        if (phone) bits.push(`llama al ${phone}`)
        if (social) bits.push(`escríbenos por ${social.label} ${social.handle}`)
        return `No pude responder en este momento. Inténtalo de nuevo en unos minutos o ${bits.join(" o ")}.`
    }
    if (!phone && !social) {
        return inbox
            ? `I couldn't reply just now. Try again in a few minutes, or email us at ${inbox} or write from the [contact page](/contact).`
            : "I couldn't reply just now. Try again in a few minutes, or write to us from the [contact page](/contact)."
    }
    const bits: string[] = []
    if (inbox) bits.push(`email us at ${inbox}`)
    if (phone) bits.push(`call ${phone}`)
    if (social) bits.push(`message us on ${social.label} ${social.handle}`)
    return `I couldn't reply just now. Try again in a few minutes, or ${bits.join(" or ")}.`
}
