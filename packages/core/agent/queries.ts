// ══════════════════════════════════════════════════════════════════
// Public reads for the agent surface.
//
// Its own projection, not a copy of the menu page's query: the page needs
// images, tag colours, discounts and rating aggregates to render cards,
// and none of that belongs in a markdown document or a tool response.
// Prisma list reads use `select` — see rules/02-code-conventions.md.
//
// Phase B builds /api/agent/v1 on these same functions. One read per fact.
// ══════════════════════════════════════════════════════════════════

import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import { isSlotPastBookingCutoff, isValidSlotForSchedule } from "../reservation-schedule"
import { isCalendarDateAfterMaxBookable } from "../reservation-dates-lima"
import { getSlotCapacity } from "../reservation-capacity-query"
import type { MenuCategoryData, MenuItemData } from "../data/menu-seed"
import { getAppSettings } from "../settings"
import { formatPublicOpeningHoursLines } from "../public-opening-hours"
import { formatPhoneForDisplay, trimmedContact } from "../public-contact"
import { resolveSocialLinks } from "../social-links"
import type { AgentLocale } from "./markdown"

const ITEM_FIELDS = {
    id: true,
    slug: true,
    slugEs: true,
    name: true,
    nameEs: true,
    description: true,
    descriptionEs: true,
    prices: true,
    tags: true,
    tagsEs: true,
    available: true,
} as const

type RawItem = {
    id: string
    slug: string
    slugEs: string | null
    name: string
    nameEs: string | null
    description: string
    descriptionEs: string | null
    prices: unknown
    tags: string[]
    tagsEs: string[]
    available: boolean
}

function toItemData(raw: RawItem, categoryId?: string): MenuItemData {
    return {
        id: raw.id,
        slug: raw.slug,
        slugEs: raw.slugEs,
        name: raw.name,
        nameEs: raw.nameEs,
        description: raw.description,
        descriptionEs: raw.descriptionEs,
        prices: (raw.prices ?? {}) as Partial<Record<"PEN" | "USD", number>>,
        tags: raw.tags ?? [],
        tagsEs: raw.tagsEs ?? [],
        imageUrl: "",
        available: raw.available,
        ...(categoryId ? { categoryId } : {}),
    }
}

/** Published categories with their available items. Cached on the "menu" tag. */
export const getAgentMenu = unstable_cache(
    async (): Promise<MenuCategoryData[]> => {
        const categories = await prisma.menuCategory.findMany({
            where: { isDraft: false },
            orderBy: { order: "asc" },
            select: {
                id: true,
                name: true,
                nameEs: true,
                slug: true,
                icon: true,
                order: true,
                items: {
                    where: { available: true, isDraft: false },
                    orderBy: [{ order: "asc" }, { name: "asc" }],
                    select: ITEM_FIELDS,
                },
            },
        })

        return categories
            .filter((cat) => cat.items.length > 0)
            .map((cat) => ({
                id: cat.id,
                name: cat.name,
                nameEs: cat.nameEs ?? null,
                slug: cat.slug,
                icon: cat.icon ?? undefined,
                order: cat.order,
                items: cat.items.map((i) => toItemData(i as RawItem, cat.id)),
            }))
    },
    ["agent-menu"],
    { tags: ["menu"], revalidate: 300 }
)

/**
 * One available item by its slug in either locale — the Spanish pages use
 * `slugEs`, so a lookup that only checked `slug` would 404 half the site.
 */
export const getAgentMenuItem = unstable_cache(
    async (
        slug: string
    ): Promise<{ item: MenuItemData; categoryName: string; categoryNameEs: string | null; categorySlug: string } | null> => {
        const found = await prisma.menuItem.findFirst({
            where: {
                available: true,
                isDraft: false,
                OR: [{ slug }, { slugEs: slug }],
            },
            select: {
                ...ITEM_FIELDS,
                category: { select: { id: true, name: true, nameEs: true, slug: true, isDraft: true } },
            },
        })

        if (!found || found.category?.isDraft) return null

        return {
            item: toItemData(found as RawItem, found.category?.id),
            categoryName: found.category?.name ?? "",
            categoryNameEs: found.category?.nameEs ?? null,
            categorySlug: found.category?.slug ?? "",
        }
    },
    ["agent-menu-item"],
    { tags: ["menu"], revalidate: 300 }
)

export interface AgentVenueSocial {
    /** Brand name, e.g. "Instagram". */
    network: string
    /** What a person reads: "@wildgrove", "facebook.com/wildgrove", "+51…". */
    handle: string
    url: string
}

export interface AgentVenueFacts {
    openingHours: string[]
    address: string | null
    phone: string | null
    email: string | null
    /** Every network the CMS publishes, in catalog order. */
    socials: AgentVenueSocial[]
}

/** Hours and contact details, as published by the CMS. */
export async function getAgentVenueFacts(locale: AgentLocale): Promise<AgentVenueFacts> {
    const s = await getAppSettings()

    return {
        openingHours: formatPublicOpeningHoursLines(
            s.operatingDays,
            s.openingTime,
            s.closingTime,
            s.closedTimeRanges,
            s.timeFormat,
            locale
        ),
        address: trimmedContact(s.contactAddress),
        phone: formatPhoneForDisplay(trimmedContact(s.contactPhone)) || null,
        email: trimmedContact(s.publicContactEmail),
        socials: resolveSocialLinks(s.socialLinks).map((link) => ({
            network: link.label,
            handle: link.handle,
            url: link.url,
        })),
    }
}

// ── Reservation availability ──────────────────────────────────────

export type AvailabilityOutcome =
    | { ok: true; available: boolean; slotsLeft: number }
    | { ok: false; reason: string }

/**
 * Whether a slot can still take a party. Returns the same answer the booking
 * form gets, and never any reservation detail.
 */
export async function getAgentAvailability(input: {
    date: string
    time: string
    partySize: number
}): Promise<AvailabilityOutcome> {
    const settings = await getAppSettings()

    if (input.partySize > settings.maxPartySize) {
        return { ok: false, reason: `Maximum party size is ${settings.maxPartySize}.` }
    }

    if (isCalendarDateAfterMaxBookable(input.date, settings.maxDaysAhead)) {
        return { ok: false, reason: "Selected date is beyond the current booking window." }
    }

    const slotIsAllowed = isValidSlotForSchedule({
        date: input.date,
        time: input.time,
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        timeSlotIncrement: settings.timeSlotIncrement,
        operatingDays: settings.operatingDays,
        closedTimeRanges: settings.closedTimeRanges,
    })

    if (!slotIsAllowed) {
        return { ok: false, reason: "This slot is outside the current schedule." }
    }

    // A slot that no longer meets the advance-notice rule is not available, however
    // much capacity is left. Without this the agent surface answered "available" for
    // a slot that Sage's own create_reservation tool would then refuse.
    if (isSlotPastBookingCutoff(input.date, input.time, settings.advanceReservationMs)) {
        return { ok: true, available: false, slotsLeft: 0 }
    }

    const { available, slotsLeft } = await getSlotCapacity({
        settings,
        date: input.date,
        time: input.time,
    })

    return { ok: true, available, slotsLeft }
}

// ── Reviews ───────────────────────────────────────────────────────

export interface AgentReview {
    rating: number
    comment: string | null
    createdAt: string
    name: string
}

/** Approved, unhidden reviews. Names are abbreviated, as on the public page. */
export async function getAgentReviews(limit: number): Promise<{
    reviews: AgentReview[]
    total: number
}> {
    const [rows, total] = await Promise.all([
        prisma.review.findMany({
            where: { approved: true, hidden: false },
            select: {
                rating: true,
                comment: true,
                createdAt: true,
                profile: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        }),
        prisma.review.count({ where: { approved: true, hidden: false } }),
    ])

    return {
        total,
        reviews: rows.map((r) => ({
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt.toISOString(),
            name:
                [r.profile.firstName, r.profile.lastName?.[0]]
                    .filter(Boolean)
                    .join(" ") || "Guest",
        })),
    }
}
