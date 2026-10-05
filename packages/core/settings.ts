// ══════════════════════════════════════════════════════════════════
// App Settings Helper — Reads the singleton AppSettings row
// ══════════════════════════════════════════════════════════════════

import { cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import { parseClosedTimeRanges } from "./reservation-schedule"
import { DEFAULT_MAX_RESERVATIONS_PER_SLOT } from "./reservation-capacity"
import { durationToMs, type DurationUnit } from "./duration-units"
import { parseSocialLinks } from "./social-links"
import { normalizeCurrency, type SupportedCurrency } from "./currency"
import { toChatMode } from "./chat/chat-settings"
import { DEFAULT_INITIAL_BALANCE } from "./wallet/initial-balance"

export type AdvanceReservationUnit = DurationUnit

export interface CheckoutSwitches {
    walletEnabled: boolean
    pickupEnabled: boolean
    deliveryEnabled: boolean
    boletaEnabled: boolean
    facturaEnabled: boolean
    /**
     * With dual currency off, the only currency the store shows and charges:
     * the owner's `defaultCurrency`. Null while customers choose PEN or USD.
     */
    storeCurrency: SupportedCurrency | null
}

type CheckoutSwitchesRow = {
    walletEnabled?: boolean | null
    pickupEnabled?: boolean | null
    deliveryEnabled?: boolean | null
    boletaEnabled?: boolean | null
    facturaEnabled?: boolean | null
    walletAllowDualCurrency?: boolean | null
    defaultCurrency?: string | null
} | null

function checkoutSwitchesFrom(row: CheckoutSwitchesRow): CheckoutSwitches {
    const dualCurrency = row?.walletAllowDualCurrency ?? true
    return {
        walletEnabled:   row?.walletEnabled   ?? true,
        pickupEnabled:   row?.pickupEnabled   ?? true,
        deliveryEnabled: row?.deliveryEnabled ?? true,
        boletaEnabled:   row?.boletaEnabled   ?? true,
        facturaEnabled:  row?.facturaEnabled  ?? true,
        storeCurrency:   dualCurrency ? null : normalizeCurrency(row?.defaultCurrency),
    }
}

/**
 * The checkout switches straight from the row, without the cache below.
 * The routes that take a payment read these, so the first payment after the
 * owner switches something off is already refused.
 */
export async function readCheckoutSwitches(): Promise<CheckoutSwitches> {
    const row = await prisma.appSettings.findUnique({
        where: { key: "global" },
        select: {
            walletEnabled: true,
            pickupEnabled: true,
            deliveryEnabled: true,
            boletaEnabled: true,
            facturaEnabled: true,
            walletAllowDualCurrency: true,
            defaultCurrency: true,
        },
    })
    return checkoutSwitchesFrom(row)
}

// unstable_cache persists the result across requests (tagged "app-settings",
// invalidated when admin saves settings). React.cache on top deduplicates
// within a single request. The returned object is fully JSON-serializable.
const getAppSettingsFromDB = unstable_cache(async function getAppSettingsFromDB() {
    const settings = await prisma.appSettings.findUnique({
        where: { key: "global" },
    })

    const advanceReservationValue = settings?.advanceReservationValue ?? 2
    const advanceReservationUnit  = (settings?.advanceReservationUnit ?? "hours") as AdvanceReservationUnit

    const advanceReservationEnabled = settings?.advanceReservationEnabled ?? true

    // Return defaults if no row exists yet
    return {
        // Without a row the chat is answered by the team: no AI key is needed.
        chatMode: toChatMode(settings?.chatMode),
        advanceReservationEnabled,
        advanceReservationValue,
        advanceReservationUnit,
        productImageLimit: settings?.productImageLimit ?? 4,
        galleryAutoPlayInterval: settings?.galleryAutoPlayInterval ?? 5,
        defaultCurrency: settings?.defaultCurrency ?? "PEN",
        reviewsEnabled: settings?.reviewsEnabled ?? true,
        reviewPhotoLimit: settings?.reviewPhotoLimit ?? 3,
        sageShareIngredients: settings?.sageShareIngredients ?? true,
        ...checkoutSwitchesFrom(settings),
        // What a new account is credited with, as plain numbers: Sage names them.
        initialBalancePEN: Number(settings?.initialBalancePEN ?? DEFAULT_INITIAL_BALANCE.PEN),
        initialBalanceUSD: Number(settings?.initialBalanceUSD ?? DEFAULT_INITIAL_BALANCE.USD),
        // When disabled, ms = 0 so no advance check is enforced
        advanceReservationMs: advanceReservationEnabled
            ? durationToMs(advanceReservationValue, advanceReservationUnit)
            : 0,
        maxPartySize:               settings?.maxPartySize               ?? 40,
        largeGroupWarningFrom:      settings?.largeGroupWarningFrom      ?? 8,
        maxReservationsPerSlot:     settings?.maxReservationsPerSlot     ?? DEFAULT_MAX_RESERVATIONS_PER_SLOT,
        timeSlotIncrement:          settings?.timeSlotIncrement          ?? 30,
        reservationDurationEnabled: settings?.reservationDurationEnabled ?? false,
        reservationDurationValue:   settings?.reservationDurationValue   ?? 1,
        reservationDurationUnit:    (settings?.reservationDurationUnit   ?? "hours") as AdvanceReservationUnit,
        maxDaysAhead:               settings?.maxDaysAhead               ?? 30,
        operatingDays:              settings?.operatingDays              ?? "1,2,3,4,5,6,7",
        openingTime:                settings?.openingTime                ?? "09:00",
        closingTime:                settings?.closingTime                ?? "22:00",
        closedTimeRanges:           parseClosedTimeRanges(settings?.closedTimeRanges ?? []),
        contactPhone:               settings?.contactPhone               ?? "",
        contactAddress:             settings?.contactAddress             ?? "",
        socialLinks:                parseSocialLinks(settings?.socialLinks),
        publicContactEmail:         settings?.publicContactEmail         ?? "",
        contactPhoneHoursNoteEn:    settings?.contactPhoneHoursNoteEn    ?? "",
        contactPhoneHoursNoteEs:    settings?.contactPhoneHoursNoteEs    ?? "",
        chatBubblePosition:         settings?.chatBubblePosition         ?? "right",
        dateFormat:                 settings?.dateFormat                 ?? "DD/MM/YYYY",
        timeFormat:                 settings?.timeFormat                 ?? "24h",
        notificationEmail:          settings?.notificationEmail          ?? "",
        // No SMTP fields here on purpose. This object is written to the
        // filesystem data cache by unstable_cache, in wildgrove-web as well as
        // in the CMS, so anything listed lands in plaintext on the public app's
        // disk. Nothing ever read them from here: packages/core/email.ts
        // queries the row itself, selecting only what it needs to authenticate.
        dashboardDefaultPreset:     settings?.dashboardDefaultPreset     ?? "today",
    }
}, ["app-settings"], { tags: ["app-settings"], revalidate: 300 })

export const getAppSettings = cache(getAppSettingsFromDB)
