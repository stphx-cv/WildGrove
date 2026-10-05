// ══════════════════════════════════════════════════════════════════
// Sage AI | Tool definitions & server-side executors
// Function calling tools that give Sage real-time data access
// ══════════════════════════════════════════════════════════════════

import OpenAI from "openai"
import { prisma } from "@wildgrove/db"
import { getAppSettings } from "../settings"
import { formatPhoneForDisplay, getPublicSiteHost, trimmedContact } from "../public-contact"
import { resolveSocialLinks } from "../social-links"
import { getCurrencySymbol } from "../currency"
import { isCalendarDateAfterMaxBookable } from "../reservation-dates-lima"
import { generateTimeSlots, isOpenDay, isSlotPastBookingCutoff, isValidSlotForSchedule } from "../reservation-schedule"
import { getSlotCapacityAt } from "../reservation-capacity-query"
import { occupyReservationSlot } from "../reservation-occupy"
import { emailLimiter, limit } from "../rate-limit"
import { loadActiveAutomaticDiscounts } from "../cart/active-automatic-discounts"
import { MENU_CARD_SELECT, menuCardsFromRows } from "./menu-cards"
import { initialBalanceAmountsFrom, initialBalanceSentence } from "../wallet/initial-balance"

// ── Lima timezone helpers ────────────────────────────────────────
// Lima = America/Lima = UTC-5, no DST.
// NEVER do: new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }))
// That creates a fake Date in server-local TZ. Calling toLocaleTimeString
// with Lima TZ on it shifts it a SECOND time → wrong by 5h.
//
// CORRECT:
//  - Display   → format new Date() directly with { timeZone: "America/Lima" }
//  - Compare   → use Date.now() (UTC ms) vs limaDateTimeToUTC() (also UTC ms)

/** Today's date in Lima time as "YYYY-MM-DD" (for date-only comparisons) */
function limaDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

/** Human-readable current Lima time like "06:24 PM" */
function limaCurrentTimeString(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Lima",
  })
}

/**
 * Converts a Lima-local date+time pair to a real UTC Date.
 * e.g. "2026-03-26" + "20:00" → 2026-03-27T01:00:00Z
 */
function limaDateTimeToUTC(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00-05:00`)
}

// ── Tool Schemas (OpenAI format) ─────────────────────────────────

export type SageToolName =
  | "get_menu"
  | "check_availability"
  | "get_active_discounts"
  | "get_restaurant_info"
  | "create_reservation"
  | "get_user_reservations"

export const SAGE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_menu",
      description:
        "Get the current restaurant menu. Returns available dishes with images, prices, descriptions, and dietary tags. When the restaurant has enabled it in CMS settings, each item also includes a localized ingredients array from the CMS. Use optional search to match a substring of dish name, URL slug or description (English or Spanish) when the user asks about one specific plate, refers to a dish by name, or asks for dishes with an ingredient or of a kind (e.g. beef, chicken, fish). Use for menu browsing, ingredients, preparation questions, dietary options, or prices. Results are localized based on the user's language.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              'Optional: filter by category name (e.g. "Starters", "Mains", "Desserts", "Drinks"). Leave empty to get full menu.',
          },
          dietary_filter: {
            type: "string",
            description:
              'Optional: filter by dietary tag (e.g. "vegan", "gluten-free", "nut-free"). Leave empty for all items.',
          },
          search: {
            type: "string",
            description:
              "Optional: case-insensitive substring to match dish name, slug or description, in English or Spanish. Dishes whose name or slug matches come first. Use a single keyword in the user's language when the user names a dish, asks about 'that' item after a card, asks for dishes with an ingredient or of a kind (e.g. 'carne', 'pollo', 'beef'), or you need a smaller result set. If no dish contains the word, every dish comes back with a note: then choose the matching ones by meaning.",
          },
          language: {
            type: "string",
            enum: ["en", "es"],
            description:
              "The user's language. Pass 'es' if the user is writing in Spanish, 'en' for English. Returns names, descriptions, and tags in the correct language.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check table availability for a specific date. Returns available time slots with remaining capacity. Use this when users ask about availability, want to know if a date/time is free, or are planning a reservation.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "The date to check in YYYY-MM-DD format. Must be today or a future date.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_discounts",
      description:
        "Get the automatic promotions active right now. They are already applied to menu prices and need no code. Use when users ask about promotions, deals or offers.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_restaurant_info",
      description:
        "Get restaurant and website information: hours, location, policies, site creator (who built the website / portfolio project), and site FAQs. Use topic 'team' when users ask who developed or built the site, About page, or project creator. Use 'site_faq' for common website questions (real restaurant?, account needed?, who built site?). Use 'all' if unsure.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["hours", "location", "team", "site_faq", "policies", "all"],
            description:
              "hours | location | team (site creator/developer) | site_faq (portfolio & site FAQs) | policies | all",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description:
        "Create a reservation for the authenticated user. IMPORTANT: Only call this AFTER the user has explicitly confirmed all the details (date, time, party size). Never call this without explicit user confirmation. Requires the user to be logged in.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Reservation date in YYYY-MM-DD format.",
          },
          time: {
            type: "string",
            description:
              'Reservation time in 24h HH:MM format (e.g. "19:00", "20:00"). Always convert from AM/PM: 8pm→"20:00", 6pm→"18:00". Must match the current booking schedule configured by the admin.',
          },
          party_size: {
            type: "number",
            description: "Number of guests (1-20).",
          },
          notes: {
            type: "string",
            description:
              "Optional special requests (dietary needs, occasion, accessibility, etc.).",
          },
        },
        required: ["date", "time", "party_size"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_reservations",
      description:
        "Get the authenticated user's upcoming reservations. Use when users ask about their existing reservations, want to check their bookings, or need reservation details. Requires the user to be logged in.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
]

// ── Tool Executors ───────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  profileId?: string
): Promise<string> {
  switch (name) {
    case "get_menu":
      return executeGetMenu(args)
    case "check_availability":
      return executeCheckAvailability(args)
    case "get_active_discounts":
      return executeGetActiveDiscounts()
    case "get_restaurant_info":
      return executeGetRestaurantInfo(args)
    case "create_reservation":
      return executeCreateReservation(args, profileId)
    case "get_user_reservations":
      return executeGetUserReservations(profileId)
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ── get_menu ─────────────────────────────────────────────────────

async function executeGetMenu(
  args: Record<string, unknown>
): Promise<string> {
  const categoryFilter = args.category as string | undefined
  const dietaryFilter = args.dietary_filter as string | undefined
  const searchRaw = typeof args.search === "string" ? args.search.trim() : ""
  const language = (args.language as string) === "es" ? "es" : "en"

  const findItems = (search: string) => prisma.menuItem.findMany({
    where: {
      available: true,
      isDraft: false,
      ...(categoryFilter
        ? { category: { name: { equals: categoryFilter, mode: "insensitive" } } }
        : {}),
      // Both filters must hold: each is an OR, so they go under one AND.
      AND: [
        ...(dietaryFilter
          ? [{
              OR: [
                { tags: { has: dietaryFilter.toLowerCase() } },
                { tagsEs: { has: dietaryFilter.toLowerCase() } },
              ],
            }]
          : []),
        ...(search
          ? [{
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { nameEs: { contains: search, mode: "insensitive" as const } },
                { slug: { contains: search, mode: "insensitive" as const } },
                { slugEs: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
                { descriptionEs: { contains: search, mode: "insensitive" as const } },
              ],
            }]
          : []),
      ],
    },
    select: MENU_CARD_SELECT,
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
  })

  // A word no dish contains is not an empty menu: "carne" finds nothing when
  // the descriptions say "res" or "pollo". Then every dish goes back and the
  // model chooses by meaning.
  let rawItems = await findItems(searchRaw)
  const searchMatched = !searchRaw || rawItems.length > 0
  if (!searchMatched) rawItems = await findItems("")

  if (rawItems.length === 0) {
    return JSON.stringify({
      message: categoryFilter || dietaryFilter
        ? "No items found matching those filters."
        : "The menu is currently being updated.",
      items: [],
    })
  }

  // A dish named after the search goes before one that only mentions it.
  const needle = searchRaw.toLowerCase()
  const matchesName = (item: (typeof rawItems)[number]) =>
    [item.name, item.nameEs, item.slug, item.slugEs].some((value) => value?.toLowerCase().includes(needle))
  const orderedItems = searchRaw && searchMatched
    ? [...rawItems.filter(matchesName), ...rawItems.filter((item) => !matchesName(item))]
    : rawItems

  // The same cards Sage's replies show, with both locales so the client can
  // render the active page language even after a locale switch.
  const items = await menuCardsFromRows(orderedItems, language)

  return JSON.stringify({
    ...(!searchMatched && {
      message: `No dish mentions "${searchRaw}" in its name or description. These are all the dishes${categoryFilter || dietaryFilter ? " that match the other filters" : ""}: choose the ones that fit what the guest asked, by meaning, or tell them none do.`,
    }),
    items,
    totalItems: items.length,
  })
}

// ── check_availability ───────────────────────────────────────────

async function executeCheckAvailability(
  args: Record<string, unknown>
): Promise<string> {
  const dateStr = args.date as string
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." })
  }

  // Compare dates using Lima-local date string
  if (dateStr < limaDateStr()) {
    return JSON.stringify({ error: "Cannot check availability for past dates." })
  }

  const settings = await getAppSettings()
  const {
    advanceReservationMs,
    advanceReservationValue,
    advanceReservationUnit,
    openingTime,
    closingTime,
    timeSlotIncrement,
    operatingDays,
    maxDaysAhead,
    closedTimeRanges,
  } = settings
  const nowUtcMs = Date.now()

  if (isCalendarDateAfterMaxBookable(dateStr, maxDaysAhead)) {
    return JSON.stringify({
      error: "That date is beyond the allowed booking window. Please choose an earlier day.",
      slots: [],
    })
  }

  if (!isOpenDay(dateStr, operatingDays)) {
    return JSON.stringify({
      date: dateStr,
      currentLimaTime: limaCurrentTimeString(),
      bookingRule: `Reservations require at least ${advanceReservationValue} ${advanceReservationUnit} advance notice from current Lima time.`,
      slots: [],
      message: "The restaurant is closed on that day. Please choose another date.",
    })
  }

  const slots = generateTimeSlots(openingTime, closingTime, timeSlotIncrement, closedTimeRanges)
  if (slots.length === 0) {
    return JSON.stringify({
      date: dateStr,
      currentLimaTime: limaCurrentTimeString(),
      slots: [],
      message: "No booking slots are currently configured.",
    })
  }

  // Count reservations per slot window for each slot
  const availability: Array<{
    time: string
    available: boolean
    slotsLeft: number
    tooSoon: boolean
  }> = []

  for (const slot of slots) {
    const slotStartUTC = limaDateTimeToUTC(dateStr, slot)

    // Skip slots already in the past
    if (slotStartUTC.getTime() <= nowUtcMs) continue

    const tooSoon = isSlotPastBookingCutoff(dateStr, slot, advanceReservationMs, nowUtcMs)

    const capacity = await getSlotCapacityAt({ settings, slotStart: slotStartUTC })

    availability.push({
      time: slot,
      available: capacity.available && !tooSoon,
      slotsLeft: tooSoon ? 0 : capacity.slotsLeft,
      tooSoon,
    })
  }

  const requestedDateLocal = new Date(`${dateStr}T12:00:00-05:00`)
  return JSON.stringify({
    date: dateStr,
    dayOfWeek: requestedDateLocal.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Lima" }),
    currentLimaTime: limaCurrentTimeString(),
    bookingRule: `Reservations require at least ${advanceReservationValue} ${advanceReservationUnit} advance notice from current Lima time.`,
    openingHours: `${openingTime} - ${closingTime}`,
    slotIncrementMinutes: timeSlotIncrement,
    slots: availability,
  })
}

// ── get_active_discounts ─────────────────────────────────────────

async function executeGetActiveDiscounts(): Promise<string> {
  // Only AUTOMATIC discounts: checkout has no coupon field, so a code Sage
  // quoted could not be used.
  const active = await loadActiveAutomaticDiscounts()

  if (active.length === 0) {
    return JSON.stringify({ message: "No active promotions at this time.", discounts: [] })
  }

  return JSON.stringify({
    discounts: active.map((d) => ({
      name: d.name,
      description: d.description,
      type: d.type,
      discount: d.valueType === "PERCENTAGE"
        ? `${d.value}% off`
        : `${getCurrencySymbol("PEN")}${d.value.toFixed(2)} / ${getCurrencySymbol("USD")}${(d.valueUsd ?? d.value).toFixed(2)} off`,
      code: "(automatic, no code needed)",
      validUntil: d.validUntil?.split("T")[0] || "no expiry",
      conditions: {},
    })),
  })
}

// ── get_restaurant_info ──────────────────────────────────────────

async function executeGetRestaurantInfo(
  args: Record<string, unknown>
): Promise<string> {
  const topic = (args.topic as string) || "all"
  const settings = await getAppSettings()

  const info: Record<string, unknown> = {}

  if (topic === "hours" || topic === "all") {
    info.hours = {
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
      slotIncrementMinutes: settings.timeSlotIncrement,
      operatingDays: settings.operatingDays,
      breakTimesNoBookings: settings.closedTimeRanges,
      maxDaysAhead: settings.maxDaysAhead,
    }
  }

  if (topic === "location" || topic === "all") {
    const addr = settings.contactAddress?.trim() || null
    const phone = formatPhoneForDisplay(settings.contactPhone) || null
    const loc: Record<string, unknown> = {}
    if (addr) loc.address = addr
    if (phone) loc.phone = phone
    const pubEmail = trimmedContact(settings.publicContactEmail)
    if (pubEmail) loc.email = pubEmail
    loc.website = getPublicSiteHost()
    const socials = resolveSocialLinks(settings.socialLinks)
    if (socials.length > 0) {
      loc.socials = socials.map((link) => ({
        network: link.label,
        handle: link.handle,
        url: link.url,
      }))
    }
    info.location = loc
  }

  if (topic === "team" || topic === "all") {
    const { getSiteCreatorForSage } = await import("../site-creator")
    info.team = getSiteCreatorForSage()
  }

  if (topic === "site_faq" || topic === "all") {
    const { getContactFaqForLocale } = await import("../contact-faq")
    const locale = typeof args.locale === "string" && args.locale === "es" ? "es" : "en"
    info.siteFaq = getContactFaqForLocale(locale)
    info.portfolioNote =
      locale === "es"
        ? "Wild Grove es un restaurante ficticio creado como proyecto de portafolio. Las reservas y los pedidos son de prueba."
        : "Wild Grove is a fictional restaurant created as a portfolio project. Reservations and orders are for testing."
    // The same amounts as the system prompt, which is the only place Sage may write them.
    info.testBalance = initialBalanceSentence(locale, initialBalanceAmountsFrom(settings))
  }

  if (topic === "policies" || topic === "all") {
    info.policies = {
      note: "These are the rules of the fictional Wild Grove restaurant. They do not promise a service at a real venue.",
      arrival: "Arrive within 15 minutes of the reservation time. After that, the table may be released.",
      largeParties: "For groups of 8 or more, write to the team through the Contact page before booking.",
      cancellation: "24 hours' notice is asked to cancel or change a reservation.",
      walkIns: "Booking is recommended. Walk-ins depend on the tables left free that day.",
      dietary: "Dietary restrictions can be written in the reservation notes.",
      reservationStatus: "A reservation starts as a pending request and is confirmed by the team.",
    }
  }

  return JSON.stringify(info)
}

// ── create_reservation ───────────────────────────────────────────

async function executeCreateReservation(
  args: Record<string, unknown>,
  profileId?: string
): Promise<string> {
  if (!profileId) {
    return JSON.stringify({
      error: "AUTH_REQUIRED",
      message:
        "The user must be logged in to create a reservation. Ask them to create an account or log in first.",
    })
  }

  // The booking form's allowance. A tool call carries no request, so the
  // account is the key.
  const { success: withinLimit } = await limit(emailLimiter, `reservation:sage:${profileId}`)
  if (!withinLimit) {
    return JSON.stringify({
      error: "RATE_LIMITED",
      message: "Too many reservations in a short time. Ask the user to try again in a few minutes.",
    })
  }

  const dateStr = args.date as string
  const time = args.time as string
  const partySize = args.party_size as number
  const notes = (args.notes as string) || undefined
  const locale: "en" | "es" = args.locale === "es" ? "es" : "en"

  // Validate inputs
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return JSON.stringify({ error: "INVALID_INPUT", message: "Invalid date format. Use YYYY-MM-DD." })
  }
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return JSON.stringify({ error: "INVALID_INPUT", message: "Invalid time format. Use HH:MM." })
  }

  const settings = await getAppSettings()
  const {
    advanceReservationMs,
    advanceReservationValue,
    advanceReservationUnit,
    maxPartySize,
    openingTime,
    closingTime,
    timeSlotIncrement,
    operatingDays,
    maxDaysAhead,
    closedTimeRanges,
  } = settings
  if (!partySize || partySize < 1 || partySize > maxPartySize) {
    return JSON.stringify({
      error: "INVALID_INPUT",
      message: `Party size must be 1-${maxPartySize}.`,
    })
  }

  if (isCalendarDateAfterMaxBookable(dateStr, maxDaysAhead)) {
    return JSON.stringify({
      error: "INVALID_SLOT",
      message: "That date is beyond the allowed booking window. Please choose an earlier day.",
    })
  }

  if (!isValidSlotForSchedule({
    date: dateStr,
    time,
    openingTime,
    closingTime,
    timeSlotIncrement,
    operatingDays,
    closedTimeRanges,
  })) {
    return JSON.stringify({
      error: "INVALID_SLOT",
      message: "That time is outside the current booking schedule. Please choose another slot.",
    })
  }

  // All comparisons in UTC ms | no double-conversion needed
  const limaDateTimeUTC = limaDateTimeToUTC(dateStr, time)
  const nowUtcMs = Date.now()

  // Check if the slot is already in the past
  if (limaDateTimeUTC.getTime() <= nowUtcMs) {
    return JSON.stringify({
      error: "PAST_DATE",
      message: "Cannot book reservations in the past.",
    })
  }

  // Enforce advance booking policy
  const advanceCutoffMs = nowUtcMs + advanceReservationMs
  if (isSlotPastBookingCutoff(dateStr, time, advanceReservationMs, nowUtcMs)) {
    const minTimeStr = new Date(advanceCutoffMs).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Lima",
    })
    return JSON.stringify({
      error: "TOO_SOON",
      message: `Reservations must be made at least ${advanceReservationValue} ${advanceReservationUnit} in advance. The current Lima time is ${limaCurrentTimeString()}. The earliest you can book for today is ${minTimeStr}. Please choose a later time or a future date.`,
    })
  }

  const slotStart = limaDateTimeUTC

  // Create the reservation, if the slot still has a table
  const occupied = await occupyReservationSlot({
    settings,
    slotStart,
    write: (tx) => tx.reservation.create({
      data: {
        profileId,
        date: slotStart,
        partySize,
        notes: notes || null,
        status: "PENDING",
        locale,
      },
      select: {
        id: true,
        date: true,
        partySize: true,
        notes: true,
        status: true,
      },
    }),
  })

  if (!occupied.occupied) {
    return JSON.stringify({
      error: "SLOT_FULL",
      message: "This time slot is fully booked. Please suggest a different time.",
    })
  }
  const reservation = occupied.value

  // Send admin notification (fire and forget)
  const { createAdminNotificationForAllAdmins } = await import("../admin-notifications")
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { firstName: true, lastName: true, email: true },
  })

  const customerName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Customer"

  createAdminNotificationForAllAdmins({
    type: "RESERVATION_CREATED",
    entityType: "RESERVATION",
    entityId: reservation.id,
    title: "New reservation received (via Sage)",
    message: `${customerName} requested a table for ${partySize} ${partySize === 1 ? "person" : "people"} via chat.`,
    href: `/reservations/${reservation.id}`,
    metadata: {
      reservationId: reservation.id,
      profileId,
      partySize,
      date: slotStart.toISOString(),
      source: "sage_chat",
    },
  }).catch((err) => console.error("[sage/tools] Notification error:", err))

  const { broadcastAdminReservationCreated } = await import("../admin/reservationsRealtime")
  broadcastAdminReservationCreated(reservation.id).catch((err) =>
    console.error("[sage/tools] Realtime broadcast error:", err)
  )

  // Send confirmation email. Not awaited, as the booking form does: the
  // reservation is already saved, and a mail server that does not answer must
  // not hold Sage's reply.
  if (profile?.email) {
    const email = profile.email
    import("../email")
      .then(({ sendReservationEmail, reservationPendingHtml }) =>
        sendReservationEmail(
          email,
          locale === "es" ? "Solicitud de reserva recibida | Wild Grove" : "Reservation Request Received | Wild Grove",
          reservationPendingHtml(
            {
              name: profile.firstName ?? customerName,
              date: slotStart,
              partySize,
              reservationId: reservation.id,
              notes: notes || null,
            },
            locale
          )
        )
      )
      .catch((emailErr) => console.error("[sage/tools] Email error:", emailErr))
  }

  return JSON.stringify({
    success: true,
    reservation: {
      id: reservation.id,
      date: reservation.date.toISOString(),
      partySize: reservation.partySize,
      notes: reservation.notes,
      status: reservation.status,
    },
    message: "Reservation request created. Its status is Pending until the team confirms it.",
  })
}

// ── get_user_reservations ────────────────────────────────────────

async function executeGetUserReservations(
  profileId?: string
): Promise<string> {
  if (!profileId) {
    return JSON.stringify({
      error: "AUTH_REQUIRED",
      message:
        "The user must be logged in to view their reservations. Ask them to create an account or log in first.",
    })
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      profileId,
      date: { gte: new Date() },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { date: "asc" },
    take: 10,
    select: {
      id: true,
      date: true,
      partySize: true,
      notes: true,
      status: true,
    },
  })

  if (reservations.length === 0) {
    return JSON.stringify({
      message: "No upcoming reservations found.",
      reservations: [],
    })
  }

  return JSON.stringify({
    reservations: reservations.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      partySize: r.partySize,
      notes: r.notes,
      status: r.status,
    })),
  })
}

