// ══════════════════════════════════════════════════════════════════
// Admin Settings API — GET / PATCH
// GET  — Read current app settings (ADMIN or OWNER)
// PATCH — Update settings (OWNER only)
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { SETTINGS_CACHE_TAG } from "@/lib/cache-tags"
import { revalidatePublic } from "@/lib/revalidate-public"
import { prisma } from "@wildgrove/db"
import { revalidatePath, unstable_cache } from "next/cache"
import {
    closedRangesFullyInsideOpeningHours,
    normalizeClosedTimeRangesForStorage,
} from "@wildgrove/core/reservation-schedule"
import {
    isSocialPlatformId,
    normalizeSocialLinksForStorage,
    normalizeSocialValue,
} from "@wildgrove/core/social-links"
import {
    DEFAULT_MAX_RESERVATIONS_PER_SLOT,
    MAX_RESERVATIONS_PER_SLOT_RANGE,
} from "@wildgrove/core/reservation-capacity"
import {
    AI_DEFAULTS,
    AI_MAX_TOKENS_RANGE,
    AI_PROVIDER_ENV_VARS,
    AI_PROVIDERS,
    AI_TEMPERATURE_RANGE,
    isAiProvider,
    isValidCustomBaseUrl,
    isValidModelId,
    type AiProvider,
} from "@wildgrove/core/chat/ai-providers"
import {
    CHAT_MODES,
    DEFAULT_CHAT_MODE,
    DEFAULT_SAGE_DECISION_MODEL,
    DEFAULT_SAGE_MENU_DEFAULT_COUNT,
    DEFAULT_SAGE_MENU_PAGE_SIZE,
    OPENROUTER_API_KEY_ENV,
    SAGE_MENU_PAGE_SIZE_RANGE,
    chatModeUsesSage,
    isChatMode,
} from "@wildgrove/core/chat/chat-settings"
import { fetchStorefrontChatStatus } from "@wildgrove/core/chat/storefront-chat-status"
import { isValidEmail } from "@wildgrove/core/validation"
import {
    DEFAULT_INITIAL_BALANCE,
    MAX_INITIAL_BALANCE,
    isValidInitialBalanceAmount,
} from "@wildgrove/core/wallet/initial-balance"

const VALID_UNITS      = ["minutes", "hours", "days", "weeks"] as const
const VALID_CURRENCIES = ["PEN", "USD"] as const
const VALID_SLOT_INCREMENTS = [15, 30, 60] as const
const VALID_DATE_FORMATS    = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const
const VALID_TIME_FORMATS    = ["12h", "24h"] as const
const VALID_CHAT_POSITIONS  = ["left", "right"] as const

const DEFAULTS = {
    advanceReservationEnabled: true,
    advanceReservationValue:   2,
    advanceReservationUnit:    "hours",
    productImageLimit:         4,
    defaultCurrency:           "PEN",
    reviewPhotoLimit:          3,
    chatMode:                  DEFAULT_CHAT_MODE,
    sageShareIngredients:      true,
    sageMenuPageSize:          DEFAULT_SAGE_MENU_PAGE_SIZE,
    sageMenuDefaultCount:      DEFAULT_SAGE_MENU_DEFAULT_COUNT,
    sageShowTechnicalDetails:  false,
    aiProvider:                AI_DEFAULTS.aiProvider,
    aiBaseUrl:                 AI_DEFAULTS.aiBaseUrl,
    aiModel:                   AI_DEFAULTS.aiModel,
    aiSummaryModel:            AI_DEFAULTS.aiSummaryModel,
    aiTemperature:             AI_DEFAULTS.aiTemperature,
    aiMaxTokens:               AI_DEFAULTS.aiMaxTokens,
    galleryAutoPlayInterval:   5,
    reviewsEnabled:            true,
    maxPartySize:              40,
    largeGroupWarningFrom:     8,
    maxReservationsPerSlot:    DEFAULT_MAX_RESERVATIONS_PER_SLOT,
    timeSlotIncrement:         30,
    reservationDurationEnabled: false,
    reservationDurationValue:  1,
    reservationDurationUnit:   "hours",
    maxDaysAhead:              30,
    operatingDays:             "1,2,3,4,5,6,7",
    openingTime:               "09:00",
    closingTime:               "22:00",
    closedTimeRanges:          [] as Prisma.InputJsonValue,
    contactPhone:              "",
    contactAddress:            "",
    socialLinks:               { hideHandles: false, links: {} } as Prisma.InputJsonValue,
    publicContactEmail:        "",
    contactPhoneHoursNoteEn:   "",
    contactPhoneHoursNoteEs:   "",
    chatBubblePosition:        "right",
    dateFormat:                "DD/MM/YYYY",
    timeFormat:                "24h",
    adminEmailNotificationsEnabled: true,
    notificationEmail:         "",
    // Payments & Orders
    walletEnabled:             true,
    walletAllowDualCurrency:   true,
    initialBalancePEN:         DEFAULT_INITIAL_BALANCE.PEN,
    initialBalanceUSD:         DEFAULT_INITIAL_BALANCE.USD,
    pickupEnabled:             true,
    deliveryEnabled:           true,
    pickupLeadTimeMinutes:     15,
    restaurantLat:             null as number | null,
    restaurantLng:             null as number | null,
    orderNumberPrefix:         "WG",
    // Fiscal data (Boleta / Factura)
    companyRuc:                "",
    companyLegalName:          "",
    companyFiscalAddress:      "",
    igvRate:                   18,
    boletaSeries:              "B001",
    facturaSeries:             "F001",
    boletaEnabled:             true,
    facturaEnabled:            true,
    // Dashboard preferences
    dashboardKitchenAlertMinutes: 20,
    dashboardPickupAlertMinutes:  10,
    dashboardLowStockThreshold:   5,
    dashboardEtaToleranceMinutes: 15,
    dashboardDefaultPreset:       "today",
} as const

function pick(settings: Record<string, unknown> | null) {
    const s: Record<string, unknown> = settings ?? {}
    return {
        advanceReservationEnabled: (s.advanceReservationEnabled ?? DEFAULTS.advanceReservationEnabled) as boolean,
        advanceReservationValue:   (s.advanceReservationValue   ?? DEFAULTS.advanceReservationValue)   as number,
        advanceReservationUnit:    (s.advanceReservationUnit    ?? DEFAULTS.advanceReservationUnit)    as string,
        productImageLimit:         (s.productImageLimit         ?? DEFAULTS.productImageLimit)         as number,
        defaultCurrency:           (s.defaultCurrency           ?? DEFAULTS.defaultCurrency)           as string,
        reviewPhotoLimit:          (s.reviewPhotoLimit          ?? DEFAULTS.reviewPhotoLimit)          as number,
        chatMode:                  isChatMode(s.chatMode) ? s.chatMode : DEFAULTS.chatMode,
        sageShareIngredients:      (s.sageShareIngredients      ?? DEFAULTS.sageShareIngredients)      as boolean,
        sageMenuPageSize:          Number(s.sageMenuPageSize    ?? DEFAULTS.sageMenuPageSize),
        sageMenuDefaultCount:      Number(s.sageMenuDefaultCount ?? DEFAULTS.sageMenuDefaultCount),
        sageShowTechnicalDetails:  (s.sageShowTechnicalDetails  ?? DEFAULTS.sageShowTechnicalDetails)  as boolean,
        // Read-only here: the thresholds are tuned against one version.
        sageDecisionModel:         String(s.sageDecisionModel   ?? DEFAULT_SAGE_DECISION_MODEL),
        aiProvider:                (s.aiProvider                ?? DEFAULTS.aiProvider)                as string,
        aiBaseUrl:                 (s.aiBaseUrl                 ?? DEFAULTS.aiBaseUrl)                 as string,
        aiModel:                   (s.aiModel                   ?? DEFAULTS.aiModel)                   as string,
        aiSummaryModel:            (s.aiSummaryModel            ?? DEFAULTS.aiSummaryModel)            as string,
        aiTemperature:             Number(s.aiTemperature       ?? DEFAULTS.aiTemperature),
        aiMaxTokens:               Number(s.aiMaxTokens         ?? DEFAULTS.aiMaxTokens),
        galleryAutoPlayInterval:   (s.galleryAutoPlayInterval   ?? DEFAULTS.galleryAutoPlayInterval)   as number,
        reviewsEnabled:            (s.reviewsEnabled            ?? DEFAULTS.reviewsEnabled)            as boolean,
        maxPartySize:              (s.maxPartySize              ?? DEFAULTS.maxPartySize)              as number,
        largeGroupWarningFrom:     (s.largeGroupWarningFrom     ?? DEFAULTS.largeGroupWarningFrom)     as number,
        maxReservationsPerSlot:    (s.maxReservationsPerSlot    ?? DEFAULTS.maxReservationsPerSlot)    as number,
        timeSlotIncrement:         (s.timeSlotIncrement         ?? DEFAULTS.timeSlotIncrement)         as number,
        reservationDurationEnabled:(s.reservationDurationEnabled?? DEFAULTS.reservationDurationEnabled)as boolean,
        reservationDurationValue:  (s.reservationDurationValue  ?? DEFAULTS.reservationDurationValue)  as number,
        reservationDurationUnit:   (s.reservationDurationUnit   ?? DEFAULTS.reservationDurationUnit)   as string,
        maxDaysAhead:              (s.maxDaysAhead              ?? DEFAULTS.maxDaysAhead)              as number,
        operatingDays:             (s.operatingDays             ?? DEFAULTS.operatingDays)             as string,
        openingTime:               (s.openingTime               ?? DEFAULTS.openingTime)               as string,
        closingTime:               (s.closingTime               ?? DEFAULTS.closingTime)               as string,
        closedTimeRanges:          normalizeClosedTimeRangesForStorage(s.closedTimeRanges ?? []),
        contactPhone:              (s.contactPhone              ?? DEFAULTS.contactPhone)              as string,
        contactAddress:            (s.contactAddress            ?? DEFAULTS.contactAddress)            as string,
        socialLinks:               normalizeSocialLinksForStorage(s.socialLinks),
        publicContactEmail:        (s.publicContactEmail        ?? DEFAULTS.publicContactEmail)        as string,
        contactPhoneHoursNoteEn:   String(s.contactPhoneHoursNoteEn ?? DEFAULTS.contactPhoneHoursNoteEn),
        contactPhoneHoursNoteEs:   String(s.contactPhoneHoursNoteEs ?? DEFAULTS.contactPhoneHoursNoteEs),
        chatBubblePosition:        (s.chatBubblePosition        ?? DEFAULTS.chatBubblePosition)        as string,
        dateFormat:                (s.dateFormat                ?? DEFAULTS.dateFormat)                as string,
        timeFormat:                (s.timeFormat                ?? DEFAULTS.timeFormat)                as string,
        adminEmailNotificationsEnabled: (s.adminEmailNotificationsEnabled ?? DEFAULTS.adminEmailNotificationsEnabled) as boolean,
        notificationEmail:         (s.notificationEmail         ?? DEFAULTS.notificationEmail)         as string,
        // No SMTP here. It is environment configuration now, not a setting:
        // SMTP_HOST/PORT/USER/PASS/FROM, read by packages/core/email.ts.
        // Payments & Orders
        walletEnabled:             (s.walletEnabled             ?? DEFAULTS.walletEnabled)             as boolean,
        walletAllowDualCurrency:   (s.walletAllowDualCurrency   ?? DEFAULTS.walletAllowDualCurrency)   as boolean,
        initialBalancePEN:         Number(s.initialBalancePEN   ?? DEFAULTS.initialBalancePEN),
        initialBalanceUSD:         Number(s.initialBalanceUSD   ?? DEFAULTS.initialBalanceUSD),
        pickupEnabled:             (s.pickupEnabled             ?? DEFAULTS.pickupEnabled)             as boolean,
        deliveryEnabled:           (s.deliveryEnabled           ?? DEFAULTS.deliveryEnabled)           as boolean,
        pickupLeadTimeMinutes:     (s.pickupLeadTimeMinutes     ?? DEFAULTS.pickupLeadTimeMinutes)     as number,
        restaurantLat:             s.restaurantLat != null ? Number(s.restaurantLat) : null,
        restaurantLng:             s.restaurantLng != null ? Number(s.restaurantLng) : null,
        orderNumberPrefix:         (s.orderNumberPrefix         ?? DEFAULTS.orderNumberPrefix)         as string,
        // Fiscal
        companyRuc:                (s.companyRuc                ?? DEFAULTS.companyRuc)                as string,
        companyLegalName:          (s.companyLegalName          ?? DEFAULTS.companyLegalName)          as string,
        companyFiscalAddress:      (s.companyFiscalAddress      ?? DEFAULTS.companyFiscalAddress)      as string,
        igvRate:                   Number(s.igvRate             ?? DEFAULTS.igvRate),
        boletaSeries:              (s.boletaSeries              ?? DEFAULTS.boletaSeries)              as string,
        facturaSeries:             (s.facturaSeries             ?? DEFAULTS.facturaSeries)             as string,
        boletaEnabled:             (s.boletaEnabled             ?? DEFAULTS.boletaEnabled)             as boolean,
        facturaEnabled:            (s.facturaEnabled            ?? DEFAULTS.facturaEnabled)            as boolean,
        // Dashboard preferences
        dashboardKitchenAlertMinutes: Number(s.dashboardKitchenAlertMinutes ?? DEFAULTS.dashboardKitchenAlertMinutes),
        dashboardPickupAlertMinutes:  Number(s.dashboardPickupAlertMinutes  ?? DEFAULTS.dashboardPickupAlertMinutes),
        dashboardLowStockThreshold:   Number(s.dashboardLowStockThreshold   ?? DEFAULTS.dashboardLowStockThreshold),
        dashboardEtaToleranceMinutes: Number(s.dashboardEtaToleranceMinutes ?? DEFAULTS.dashboardEtaToleranceMinutes),
        dashboardDefaultPreset:       String(s.dashboardDefaultPreset       ?? DEFAULTS.dashboardDefaultPreset),
    }
}

/**
 * Cached under the same "app-settings" tag the PATCH below already invalidates,
 * so the panel's repeated reads stop opening a Postgres connection each time.
 * `pick()` reads only scalars, so round-tripping the row through the cache's
 * serialization changes nothing in the response.
 */
const getSettingsRow = unstable_cache(
    async () => prisma.appSettings.findUnique({ where: { key: "global" } }),
    ["cms-settings-row"],
    { tags: [SETTINGS_CACHE_TAG], revalidate: 300 },
)

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const settings = await getSettingsRow()

    return NextResponse.json({ success: true, data: pick(settings as Record<string, unknown>) })
}

export async function PATCH(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }
    if (auth.role !== "OWNER") {
        return NextResponse.json({ success: false, error: "Only the owner can modify settings." }, { status: 403 })
    }

    const body = await request.json()
    const {
        advanceReservationEnabled, advanceReservationValue, advanceReservationUnit,
        productImageLimit, defaultCurrency, reviewPhotoLimit, chatMode,
        sageShareIngredients, sageMenuPageSize, sageMenuDefaultCount, sageShowTechnicalDetails,
        aiProvider, aiBaseUrl, aiModel, aiSummaryModel, aiTemperature, aiMaxTokens,
        galleryAutoPlayInterval, reviewsEnabled,
        // new fields
        maxPartySize, largeGroupWarningFrom, maxReservationsPerSlot,
        timeSlotIncrement, reservationDurationEnabled, reservationDurationValue, reservationDurationUnit,
        maxDaysAhead, operatingDays, openingTime, closingTime, closedTimeRanges,
        contactPhone, contactAddress, socialLinks, publicContactEmail,
        contactPhoneHoursNoteEn, contactPhoneHoursNoteEs,
        chatBubblePosition, dateFormat, timeFormat,
        adminEmailNotificationsEnabled, notificationEmail,
        // Payments & Orders
        walletEnabled, walletAllowDualCurrency, initialBalancePEN, initialBalanceUSD,
        pickupEnabled, deliveryEnabled, pickupLeadTimeMinutes,
        restaurantLat, restaurantLng, orderNumberPrefix,
        // Fiscal
        companyRuc, companyLegalName, companyFiscalAddress,
        igvRate, boletaSeries, facturaSeries, boletaEnabled, facturaEnabled,
        // Dashboard preferences
        dashboardKitchenAlertMinutes, dashboardPickupAlertMinutes,
        dashboardLowStockThreshold, dashboardEtaToleranceMinutes, dashboardDefaultPreset,
    } = body

    // ── existing validations ─────────────────────────────────────

    if (advanceReservationEnabled !== undefined && typeof advanceReservationEnabled !== "boolean")
        return NextResponse.json({ success: false, error: "Invalid value for advanceReservationEnabled." }, { status: 400 })

    if (advanceReservationValue !== undefined &&
        (!Number.isInteger(advanceReservationValue) || advanceReservationValue < 1 || advanceReservationValue > 10000))
        return NextResponse.json({ success: false, error: "advanceReservationValue must be an integer between 1 and 10000." }, { status: 400 })

    if (advanceReservationUnit !== undefined && !VALID_UNITS.includes(advanceReservationUnit))
        return NextResponse.json({ success: false, error: `advanceReservationUnit must be one of: ${VALID_UNITS.join(", ")}.` }, { status: 400 })

    if (productImageLimit !== undefined &&
        (!Number.isInteger(productImageLimit) || productImageLimit < 1 || productImageLimit > 20))
        return NextResponse.json({ success: false, error: "productImageLimit must be an integer between 1 and 20." }, { status: 400 })

    if (reviewPhotoLimit !== undefined &&
        (!Number.isInteger(reviewPhotoLimit) || reviewPhotoLimit < 0 || reviewPhotoLimit > 10))
        return NextResponse.json({ success: false, error: "reviewPhotoLimit must be an integer between 0 and 10." }, { status: 400 })

    if (defaultCurrency !== undefined && !VALID_CURRENCIES.includes(defaultCurrency))
        return NextResponse.json({ success: false, error: `defaultCurrency must be one of: ${VALID_CURRENCIES.join(", ")}.` }, { status: 400 })

    if (chatMode !== undefined && !isChatMode(chatMode))
        return NextResponse.json({ success: false, error: `chatMode must be one of: ${CHAT_MODES.join(", ")}.` }, { status: 400 })

    if (sageShareIngredients !== undefined && typeof sageShareIngredients !== "boolean")
        return NextResponse.json({ success: false, error: "Invalid value for sageShareIngredients." }, { status: 400 })

    if (sageMenuPageSize !== undefined &&
        (!Number.isInteger(sageMenuPageSize) ||
         sageMenuPageSize < SAGE_MENU_PAGE_SIZE_RANGE.min || sageMenuPageSize > SAGE_MENU_PAGE_SIZE_RANGE.max))
        return NextResponse.json({ success: false, error: `sageMenuPageSize must be an integer between ${SAGE_MENU_PAGE_SIZE_RANGE.min} and ${SAGE_MENU_PAGE_SIZE_RANGE.max}.` }, { status: 400 })

    if (sageMenuDefaultCount !== undefined &&
        (!Number.isInteger(sageMenuDefaultCount) ||
         sageMenuDefaultCount < SAGE_MENU_PAGE_SIZE_RANGE.min || sageMenuDefaultCount > SAGE_MENU_PAGE_SIZE_RANGE.max))
        return NextResponse.json({ success: false, error: `sageMenuDefaultCount must be an integer between ${SAGE_MENU_PAGE_SIZE_RANGE.min} and ${SAGE_MENU_PAGE_SIZE_RANGE.max}.` }, { status: 400 })

    if (sageMenuPageSize !== undefined || sageMenuDefaultCount !== undefined) {
        const currentMenu = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { sageMenuPageSize: true, sageMenuDefaultCount: true },
        })
        const effectiveMax = sageMenuPageSize ?? currentMenu?.sageMenuPageSize ?? DEFAULTS.sageMenuPageSize
        const effectiveUsual = sageMenuDefaultCount ?? currentMenu?.sageMenuDefaultCount ?? DEFAULTS.sageMenuDefaultCount
        if (effectiveUsual > effectiveMax) {
            return NextResponse.json(
                { success: false, error: "sageMenuDefaultCount must be less than or equal to sageMenuPageSize." },
                { status: 400 },
            )
        }
    }

    if (sageShowTechnicalDetails !== undefined && typeof sageShowTechnicalDetails !== "boolean")
        return NextResponse.json({ success: false, error: "Invalid value for sageShowTechnicalDetails." }, { status: 400 })

    // ── Sage's AI provider ───────────────────────────────────────
    if (aiProvider !== undefined && !isAiProvider(aiProvider))
        return NextResponse.json({ success: false, error: `aiProvider must be one of: ${AI_PROVIDERS.join(", ")}.` }, { status: 400 })

    if (aiBaseUrl !== undefined && typeof aiBaseUrl !== "string")
        return NextResponse.json({ success: false, error: "Invalid value for aiBaseUrl." }, { status: 400 })

    if (aiModel !== undefined && (typeof aiModel !== "string" || !isValidModelId(aiModel.trim())))
        return NextResponse.json({ success: false, error: "aiModel must be a model ID such as gpt-4o-mini or anthropic/claude-3.5-haiku." }, { status: 400 })

    if (aiSummaryModel !== undefined &&
        (typeof aiSummaryModel !== "string" || (aiSummaryModel.trim() !== "" && !isValidModelId(aiSummaryModel.trim()))))
        return NextResponse.json({ success: false, error: "aiSummaryModel must be a model ID, or empty to reuse the main model." }, { status: 400 })

    if (aiTemperature !== undefined &&
        (typeof aiTemperature !== "number" || !Number.isFinite(aiTemperature) ||
         aiTemperature < AI_TEMPERATURE_RANGE.min || aiTemperature > AI_TEMPERATURE_RANGE.max))
        return NextResponse.json({ success: false, error: `aiTemperature must be a number between ${AI_TEMPERATURE_RANGE.min} and ${AI_TEMPERATURE_RANGE.max}.` }, { status: 400 })

    if (aiMaxTokens !== undefined &&
        (!Number.isInteger(aiMaxTokens) || aiMaxTokens < AI_MAX_TOKENS_RANGE.min || aiMaxTokens > AI_MAX_TOKENS_RANGE.max))
        return NextResponse.json({ success: false, error: `aiMaxTokens must be an integer between ${AI_MAX_TOKENS_RANGE.min} and ${AI_MAX_TOKENS_RANGE.max}.` }, { status: 400 })

    // A custom provider without a reachable endpoint would only fail later, inside a chat.
    if (aiProvider !== undefined || aiBaseUrl !== undefined) {
        const currentAi = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { aiProvider: true, aiBaseUrl: true },
        })
        const effectiveProvider = (aiProvider ?? currentAi?.aiProvider ?? DEFAULTS.aiProvider) as string
        const effectiveBaseUrl = String(aiBaseUrl ?? currentAi?.aiBaseUrl ?? DEFAULTS.aiBaseUrl).trim()
        if (effectiveProvider === "custom" && !isValidCustomBaseUrl(effectiveBaseUrl))
            return NextResponse.json({ success: false, error: "A custom AI provider needs an https base URL (http is allowed only for localhost)." }, { status: 400 })
    }

    // A mode with Sage needs the writer's key and the decision model's key on
    // the storefront. The panel has neither, so it asks the storefront, and a
    // storefront that does not answer blocks the save: a mode that cannot work
    // is never stored.
    if (chatMode !== undefined || aiProvider !== undefined) {
        const current = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { chatMode: true, aiProvider: true },
        })
        const effectiveMode = chatMode ?? (isChatMode(current?.chatMode) ? current.chatMode : DEFAULTS.chatMode)
        if (chatModeUsesSage(effectiveMode)) {
            const status = await fetchStorefrontChatStatus()
            if (!status)
                return NextResponse.json({ success: false, error: "Could not check the storefront's AI keys: it did not answer. A chat mode with Sage needs them, so it was not saved." }, { status: 400 })
            const effectiveProvider = (aiProvider ?? (isAiProvider(current?.aiProvider) ? current.aiProvider : DEFAULTS.aiProvider)) as AiProvider
            const missing = new Set<string>()
            if (!status.writerKeys[effectiveProvider]) missing.add(AI_PROVIDER_ENV_VARS[effectiveProvider])
            if (!status.decisionKeys.openrouter) missing.add(OPENROUTER_API_KEY_ENV)
            if (missing.size > 0)
                return NextResponse.json({ success: false, error: `A chat mode with Sage needs ${[...missing].join(" and ")} on the storefront.` }, { status: 400 })
        }
    }

    if (galleryAutoPlayInterval !== undefined &&
        (!Number.isInteger(galleryAutoPlayInterval) || galleryAutoPlayInterval < 0 || galleryAutoPlayInterval > 60))
        return NextResponse.json({ success: false, error: "galleryAutoPlayInterval must be an integer between 0 and 60." }, { status: 400 })

    if (reviewsEnabled !== undefined && typeof reviewsEnabled !== "boolean")
        return NextResponse.json({ success: false, error: "Invalid value for reviewsEnabled." }, { status: 400 })

    // ── new validations ──────────────────────────────────────────
    if (maxPartySize !== undefined &&
        (!Number.isInteger(maxPartySize) || maxPartySize < 1 || maxPartySize > 50))
        return NextResponse.json({ success: false, error: "maxPartySize must be an integer between 1 and 50." }, { status: 400 })

    if (largeGroupWarningFrom !== undefined &&
        (!Number.isInteger(largeGroupWarningFrom) || largeGroupWarningFrom < 1 || largeGroupWarningFrom > 50))
        return NextResponse.json({ success: false, error: "largeGroupWarningFrom must be an integer between 1 and 50." }, { status: 400 })

    if (maxReservationsPerSlot !== undefined &&
        (!Number.isInteger(maxReservationsPerSlot) ||
            maxReservationsPerSlot < MAX_RESERVATIONS_PER_SLOT_RANGE.min ||
            maxReservationsPerSlot > MAX_RESERVATIONS_PER_SLOT_RANGE.max))
        return NextResponse.json({ success: false, error: `maxReservationsPerSlot must be an integer between ${MAX_RESERVATIONS_PER_SLOT_RANGE.min} and ${MAX_RESERVATIONS_PER_SLOT_RANGE.max}.` }, { status: 400 })

    if (timeSlotIncrement !== undefined && !VALID_SLOT_INCREMENTS.includes(timeSlotIncrement))
        return NextResponse.json({ success: false, error: `timeSlotIncrement must be one of: ${VALID_SLOT_INCREMENTS.join(", ")}.` }, { status: 400 })

    if (reservationDurationEnabled !== undefined && typeof reservationDurationEnabled !== "boolean")
        return NextResponse.json({ success: false, error: "Invalid value for reservationDurationEnabled." }, { status: 400 })

    if (reservationDurationValue !== undefined &&
        (!Number.isInteger(reservationDurationValue) || reservationDurationValue < 1 || reservationDurationValue > 10000))
        return NextResponse.json({ success: false, error: "reservationDurationValue must be an integer between 1 and 10000." }, { status: 400 })

    if (reservationDurationUnit !== undefined && !VALID_UNITS.includes(reservationDurationUnit))
        return NextResponse.json({ success: false, error: `reservationDurationUnit must be one of: ${VALID_UNITS.join(", ")}.` }, { status: 400 })

    if (maxDaysAhead !== undefined &&
        (!Number.isInteger(maxDaysAhead) || maxDaysAhead < 1 || maxDaysAhead > 365))
        return NextResponse.json({ success: false, error: "maxDaysAhead must be an integer between 1 and 365." }, { status: 400 })

    if (operatingDays !== undefined) {
        if (typeof operatingDays !== "string") {
            return NextResponse.json({ success: false, error: "Invalid value for operatingDays." }, { status: 400 })
        }
        const days = operatingDays.split(",").map(Number)
        if (days.length === 0 || days.some(d => !Number.isInteger(d) || d < 1 || d > 7)) {
            return NextResponse.json({ success: false, error: "operatingDays must be a comma-separated list of integers 1–7." }, { status: 400 })
        }
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
    if (openingTime !== undefined && (typeof openingTime !== "string" || !timeRegex.test(openingTime)))
        return NextResponse.json({ success: false, error: "openingTime must be HH:MM (24-hour format)." }, { status: 400 })

    if (closingTime !== undefined && (typeof closingTime !== "string" || !timeRegex.test(closingTime)))
        return NextResponse.json({ success: false, error: "closingTime must be HH:MM (24-hour format)." }, { status: 400 })

    if (closedTimeRanges !== undefined) {
        if (!Array.isArray(closedTimeRanges)) {
            return NextResponse.json({ success: false, error: "closedTimeRanges must be an array of { start, end }." }, { status: 400 })
        }
        if (closedTimeRanges.length > 20) {
            return NextResponse.json({ success: false, error: "closedTimeRanges may contain at most 20 entries." }, { status: 400 })
        }
        const normalized = normalizeClosedTimeRangesForStorage(closedTimeRanges)
        if (normalized.length !== closedTimeRanges.length) {
            return NextResponse.json(
                { success: false, error: "closedTimeRanges entries must be { start, end } in HH:MM with start < end." },
                { status: 400 }
            )
        }
    }

    if (contactPhone !== undefined && typeof contactPhone !== "string")
        return NextResponse.json({ success: false, error: "Invalid value for contactPhone." }, { status: 400 })

    if (contactAddress !== undefined && typeof contactAddress !== "string")
        return NextResponse.json({ success: false, error: "Invalid value for contactAddress." }, { status: 400 })

    if (socialLinks !== undefined) {
        if (typeof socialLinks !== "object" || socialLinks === null || Array.isArray(socialLinks))
            return NextResponse.json({ success: false, error: "socialLinks must be an object." }, { status: 400 })
        const socialBody = socialLinks as Record<string, unknown>

        if (socialBody.hideHandles !== undefined && typeof socialBody.hideHandles !== "boolean")
            return NextResponse.json({ success: false, error: "socialLinks.hideHandles must be a boolean." }, { status: 400 })

        // `links` is absent on the flat shape, which the parser
        // still reads; only the current shape is validated field by field.
        const entries = socialBody.links
        if (entries !== undefined) {
            if (typeof entries !== "object" || entries === null || Array.isArray(entries))
                return NextResponse.json({ success: false, error: "socialLinks.links must be an object of { platform: { value } }." }, { status: 400 })
            for (const [platform, entry] of Object.entries(entries as Record<string, unknown>)) {
                if (!isSocialPlatformId(platform))
                    return NextResponse.json({ success: false, error: `Unknown social network: ${platform}.` }, { status: 400 })
                if (typeof entry !== "object" || entry === null || Array.isArray(entry))
                    return NextResponse.json({ success: false, error: `Invalid value for ${platform}.` }, { status: 400 })
                const cell = entry as Record<string, unknown>
                for (const field of ["value", "label", "username"] as const) {
                    if (cell[field] !== undefined && typeof cell[field] !== "string")
                        return NextResponse.json({ success: false, error: `${platform}.${field} must be a string.` }, { status: 400 })
                }
                // A value that survives trimming but not normalization is a typo,
                // and silently storing nothing would look like the save failed.
                const handle = typeof cell.value === "string" ? cell.value : ""
                if (handle.trim() !== "" && normalizeSocialValue(platform, handle) === "")
                    return NextResponse.json({ success: false, error: `"${handle}" is not a usable ${platform} handle.` }, { status: 400 })
            }
        }
    }

    if (publicContactEmail !== undefined) {
        if (typeof publicContactEmail !== "string")
            return NextResponse.json({ success: false, error: "Invalid value for publicContactEmail." }, { status: 400 })
        if (publicContactEmail.trim() !== "" && !isValidEmail(publicContactEmail.trim()))
            return NextResponse.json(
                { success: false, error: "publicContactEmail must be a valid email address or empty." },
                { status: 400 }
            )
    }

    const MAX_PHONE_HOURS_NOTE = 500
    if (contactPhoneHoursNoteEn !== undefined) {
        if (typeof contactPhoneHoursNoteEn !== "string")
            return NextResponse.json({ success: false, error: "Invalid value for contactPhoneHoursNoteEn." }, { status: 400 })
        if (contactPhoneHoursNoteEn.length > MAX_PHONE_HOURS_NOTE) {
            return NextResponse.json(
                { success: false, error: `contactPhoneHoursNoteEn must be at most ${MAX_PHONE_HOURS_NOTE} characters.` },
                { status: 400 }
            )
        }
    }
    if (contactPhoneHoursNoteEs !== undefined) {
        if (typeof contactPhoneHoursNoteEs !== "string")
            return NextResponse.json({ success: false, error: "Invalid value for contactPhoneHoursNoteEs." }, { status: 400 })
        if (contactPhoneHoursNoteEs.length > MAX_PHONE_HOURS_NOTE) {
            return NextResponse.json(
                { success: false, error: `contactPhoneHoursNoteEs must be at most ${MAX_PHONE_HOURS_NOTE} characters.` },
                { status: 400 }
            )
        }
    }

    if (chatBubblePosition !== undefined && !VALID_CHAT_POSITIONS.includes(chatBubblePosition))
        return NextResponse.json({ success: false, error: `chatBubblePosition must be one of: ${VALID_CHAT_POSITIONS.join(", ")}.` }, { status: 400 })

    if (dateFormat !== undefined && !VALID_DATE_FORMATS.includes(dateFormat))
        return NextResponse.json({ success: false, error: `dateFormat must be one of: ${VALID_DATE_FORMATS.join(", ")}.` }, { status: 400 })

    if (timeFormat !== undefined && !VALID_TIME_FORMATS.includes(timeFormat))
        return NextResponse.json({ success: false, error: `timeFormat must be one of: ${VALID_TIME_FORMATS.join(", ")}.` }, { status: 400 })

    if (adminEmailNotificationsEnabled !== undefined && typeof adminEmailNotificationsEnabled !== "boolean")
        return NextResponse.json({ success: false, error: "Invalid value for adminEmailNotificationsEnabled." }, { status: 400 })

    if (notificationEmail !== undefined) {
        if (typeof notificationEmail !== "string")
            return NextResponse.json({ success: false, error: "Invalid value for notificationEmail." }, { status: 400 })
        if (notificationEmail !== "" && !isValidEmail(notificationEmail))
            return NextResponse.json({ success: false, error: "notificationEmail must be a valid email address." }, { status: 400 })
    }

    // ── Payments & Orders validations ──────────────────────────────
    const booleanPaymentFields: Record<string, unknown> = {
        walletEnabled, walletAllowDualCurrency, pickupEnabled, deliveryEnabled,
        boletaEnabled, facturaEnabled,
    }
    for (const [field, val] of Object.entries(booleanPaymentFields)) {
        if (val !== undefined && typeof val !== "boolean")
            return NextResponse.json({ success: false, error: `Invalid value for ${field}.` }, { status: 400 })
    }

    for (const [field, val] of Object.entries({ initialBalancePEN, initialBalanceUSD })) {
        if (val !== undefined && !isValidInitialBalanceAmount(val))
            return NextResponse.json({ success: false, error: `${field} must be a number between 0 and ${MAX_INITIAL_BALANCE} with at most 2 decimals.` }, { status: 400 })
    }

    // At least one fulfillment method stays on, counting the one this request
    // does not send as it is stored.
    if (pickupEnabled === false || deliveryEnabled === false) {
        const current = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { pickupEnabled: true, deliveryEnabled: true },
        })
        const pickupOn = pickupEnabled ?? current?.pickupEnabled ?? DEFAULTS.pickupEnabled
        const deliveryOn = deliveryEnabled ?? current?.deliveryEnabled ?? DEFAULTS.deliveryEnabled
        if (!pickupOn && !deliveryOn)
            return NextResponse.json({ success: false, error: "At least one fulfillment method must be enabled." }, { status: 400 })
    }

    if (pickupLeadTimeMinutes !== undefined && (!Number.isInteger(pickupLeadTimeMinutes) || pickupLeadTimeMinutes < 0 || pickupLeadTimeMinutes > 480))
        return NextResponse.json({ success: false, error: "pickupLeadTimeMinutes must be an integer between 0 and 480." }, { status: 400 })

    if (igvRate !== undefined && (typeof igvRate !== "number" || isNaN(igvRate) || igvRate < 0 || igvRate > 100))
        return NextResponse.json({ success: false, error: "igvRate must be a number between 0 and 100." }, { status: 400 })

    if (restaurantLat !== undefined && restaurantLat !== null && (typeof restaurantLat !== "number" || isNaN(restaurantLat) || restaurantLat < -90 || restaurantLat > 90))
        return NextResponse.json({ success: false, error: "restaurantLat must be a number between -90 and 90 or null." }, { status: 400 })

    if (restaurantLng !== undefined && restaurantLng !== null && (typeof restaurantLng !== "number" || isNaN(restaurantLng) || restaurantLng < -180 || restaurantLng > 180))
        return NextResponse.json({ success: false, error: "restaurantLng must be a number between -180 and 180 or null." }, { status: 400 })

    if (orderNumberPrefix !== undefined && (typeof orderNumberPrefix !== "string" || orderNumberPrefix.trim().length === 0 || orderNumberPrefix.length > 10))
        return NextResponse.json({ success: false, error: "orderNumberPrefix must be a non-empty string of up to 10 characters." }, { status: 400 })

    const stringFiscalFields: Record<string, unknown> = { companyRuc, companyLegalName, companyFiscalAddress, boletaSeries, facturaSeries }
    for (const [field, val] of Object.entries(stringFiscalFields)) {
        if (val !== undefined && typeof val !== "string")
            return NextResponse.json({ success: false, error: `Invalid value for ${field}.` }, { status: 400 })
    }

    // Cross-field validation: warning threshold must not exceed max party size.
    if (maxPartySize !== undefined || largeGroupWarningFrom !== undefined) {
        const current = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { maxPartySize: true, largeGroupWarningFrom: true },
        })
        const effectiveMaxPartySize = maxPartySize ?? current?.maxPartySize ?? DEFAULTS.maxPartySize
        const effectiveLargeGroupWarningFrom =
            largeGroupWarningFrom ?? current?.largeGroupWarningFrom ?? DEFAULTS.largeGroupWarningFrom

        if (effectiveLargeGroupWarningFrom > effectiveMaxPartySize) {
            return NextResponse.json(
                {
                    success: false,
                    error: "largeGroupWarningFrom must be less than or equal to maxPartySize.",
                },
                { status: 400 }
            )
        }
    }

    // ── build update payload ─────────────────────────────────────
    const updateData: Record<string, unknown> = {}
    if (advanceReservationEnabled!== undefined) updateData.advanceReservationEnabled = advanceReservationEnabled
    if (advanceReservationValue  !== undefined) updateData.advanceReservationValue  = advanceReservationValue
    if (advanceReservationUnit   !== undefined) updateData.advanceReservationUnit   = advanceReservationUnit
    if (productImageLimit        !== undefined) updateData.productImageLimit        = productImageLimit
    if (defaultCurrency          !== undefined) updateData.defaultCurrency          = defaultCurrency
    if (reviewPhotoLimit         !== undefined) updateData.reviewPhotoLimit         = reviewPhotoLimit
    if (chatMode                 !== undefined) updateData.chatMode                 = chatMode
    if (sageShareIngredients     !== undefined) updateData.sageShareIngredients     = sageShareIngredients
    if (sageMenuPageSize         !== undefined) updateData.sageMenuPageSize         = sageMenuPageSize
    if (sageMenuDefaultCount     !== undefined) updateData.sageMenuDefaultCount     = sageMenuDefaultCount
    if (sageShowTechnicalDetails !== undefined) updateData.sageShowTechnicalDetails = sageShowTechnicalDetails
    if (aiProvider               !== undefined) updateData.aiProvider               = aiProvider
    if (aiBaseUrl                !== undefined) updateData.aiBaseUrl                = aiBaseUrl.trim()
    if (aiModel                  !== undefined) updateData.aiModel                  = aiModel.trim()
    if (aiSummaryModel           !== undefined) updateData.aiSummaryModel           = aiSummaryModel.trim()
    if (aiTemperature            !== undefined) updateData.aiTemperature            = aiTemperature
    if (aiMaxTokens              !== undefined) updateData.aiMaxTokens              = aiMaxTokens
    if (galleryAutoPlayInterval  !== undefined) updateData.galleryAutoPlayInterval  = galleryAutoPlayInterval
    if (reviewsEnabled           !== undefined) updateData.reviewsEnabled           = reviewsEnabled
    if (maxPartySize             !== undefined) updateData.maxPartySize             = maxPartySize
    if (largeGroupWarningFrom    !== undefined) updateData.largeGroupWarningFrom    = largeGroupWarningFrom
    if (maxReservationsPerSlot   !== undefined) updateData.maxReservationsPerSlot   = maxReservationsPerSlot
    if (timeSlotIncrement        !== undefined) updateData.timeSlotIncrement        = timeSlotIncrement
    if (reservationDurationEnabled!==undefined) updateData.reservationDurationEnabled=reservationDurationEnabled
    if (reservationDurationValue !== undefined) updateData.reservationDurationValue = reservationDurationValue
    if (reservationDurationUnit  !== undefined) updateData.reservationDurationUnit  = reservationDurationUnit
    if (maxDaysAhead             !== undefined) updateData.maxDaysAhead             = maxDaysAhead
    if (operatingDays            !== undefined) updateData.operatingDays            = operatingDays
    if (openingTime              !== undefined) updateData.openingTime              = openingTime
    if (closingTime              !== undefined) updateData.closingTime              = closingTime
    if (closedTimeRanges         !== undefined) {
        updateData.closedTimeRanges = normalizeClosedTimeRangesForStorage(closedTimeRanges)
    }
    if (contactPhone             !== undefined) updateData.contactPhone             = contactPhone
    if (contactAddress           !== undefined) updateData.contactAddress           = contactAddress
    if (socialLinks              !== undefined) updateData.socialLinks              = normalizeSocialLinksForStorage(socialLinks)
    if (publicContactEmail       !== undefined) updateData.publicContactEmail       = publicContactEmail.trim()
    if (contactPhoneHoursNoteEn !== undefined) updateData.contactPhoneHoursNoteEn = contactPhoneHoursNoteEn.trim()
    if (contactPhoneHoursNoteEs !== undefined) updateData.contactPhoneHoursNoteEs = contactPhoneHoursNoteEs.trim()
    if (chatBubblePosition       !== undefined) updateData.chatBubblePosition       = chatBubblePosition
    if (dateFormat               !== undefined) updateData.dateFormat               = dateFormat
    if (timeFormat               !== undefined) updateData.timeFormat               = timeFormat
    if (adminEmailNotificationsEnabled !== undefined) updateData.adminEmailNotificationsEnabled = adminEmailNotificationsEnabled
    if (notificationEmail        !== undefined) updateData.notificationEmail        = notificationEmail
    // Payments & Orders
    if (walletEnabled                !== undefined) updateData.walletEnabled                = walletEnabled
    if (walletAllowDualCurrency      !== undefined) updateData.walletAllowDualCurrency      = walletAllowDualCurrency
    if (initialBalancePEN            !== undefined) updateData.initialBalancePEN            = initialBalancePEN
    if (initialBalanceUSD            !== undefined) updateData.initialBalanceUSD            = initialBalanceUSD
    if (pickupEnabled                !== undefined) updateData.pickupEnabled                = pickupEnabled
    if (deliveryEnabled              !== undefined) updateData.deliveryEnabled              = deliveryEnabled
    if (pickupLeadTimeMinutes        !== undefined) updateData.pickupLeadTimeMinutes        = pickupLeadTimeMinutes
    if (restaurantLat                !== undefined) updateData.restaurantLat                = restaurantLat
    if (restaurantLng                !== undefined) updateData.restaurantLng                = restaurantLng
    if (orderNumberPrefix            !== undefined) updateData.orderNumberPrefix            = orderNumberPrefix.trim()
    if (companyRuc                   !== undefined) updateData.companyRuc                   = companyRuc
    if (companyLegalName             !== undefined) updateData.companyLegalName             = companyLegalName
    if (companyFiscalAddress         !== undefined) updateData.companyFiscalAddress         = companyFiscalAddress
    if (igvRate                      !== undefined) updateData.igvRate                      = igvRate
    if (boletaSeries                 !== undefined) updateData.boletaSeries                 = boletaSeries
    if (facturaSeries                !== undefined) updateData.facturaSeries                = facturaSeries
    if (boletaEnabled                !== undefined) updateData.boletaEnabled                = boletaEnabled
    if (facturaEnabled               !== undefined) updateData.facturaEnabled               = facturaEnabled
    // Dashboard preferences
    if (dashboardKitchenAlertMinutes !== undefined && Number.isInteger(dashboardKitchenAlertMinutes) && dashboardKitchenAlertMinutes >= 1 && dashboardKitchenAlertMinutes <= 240) updateData.dashboardKitchenAlertMinutes = dashboardKitchenAlertMinutes
    if (dashboardPickupAlertMinutes  !== undefined && Number.isInteger(dashboardPickupAlertMinutes)  && dashboardPickupAlertMinutes  >= 1 && dashboardPickupAlertMinutes  <= 120) updateData.dashboardPickupAlertMinutes  = dashboardPickupAlertMinutes
    if (dashboardLowStockThreshold   !== undefined && Number.isInteger(dashboardLowStockThreshold)   && dashboardLowStockThreshold   >= 1 && dashboardLowStockThreshold   <= 1000) updateData.dashboardLowStockThreshold  = dashboardLowStockThreshold
    if (dashboardEtaToleranceMinutes !== undefined && Number.isInteger(dashboardEtaToleranceMinutes) && dashboardEtaToleranceMinutes >= 0 && dashboardEtaToleranceMinutes <= 120) updateData.dashboardEtaToleranceMinutes = dashboardEtaToleranceMinutes
    if (dashboardDefaultPreset       !== undefined && typeof dashboardDefaultPreset === "string" && ["today","yesterday","last7d","last30d","thisMonth","lastMonth"].includes(dashboardDefaultPreset)) updateData.dashboardDefaultPreset = dashboardDefaultPreset

    if (Object.keys(updateData).length === 0)
        return NextResponse.json({ success: false, error: "No valid fields provided." }, { status: 400 })

    const currentSchedule = await prisma.appSettings.findUnique({
        where: { key: "global" },
        select: { openingTime: true, closingTime: true, closedTimeRanges: true },
    })
    const mergedOpen = (openingTime ?? currentSchedule?.openingTime ?? DEFAULTS.openingTime) as string
    const mergedClose = (closingTime ?? currentSchedule?.closingTime ?? DEFAULTS.closingTime) as string
    const mergedClosed =
        closedTimeRanges !== undefined
            ? normalizeClosedTimeRangesForStorage(closedTimeRanges)
            : normalizeClosedTimeRangesForStorage(currentSchedule?.closedTimeRanges ?? [])
    if (!closedRangesFullyInsideOpeningHours(mergedOpen, mergedClose, mergedClosed)) {
        return NextResponse.json(
            {
                success: false,
                error: "Each break must fall entirely within opening hours (start inclusive, end inclusive of the window).",
            },
            { status: 400 }
        )
    }

    const settings = await prisma.appSettings.upsert({
        where:  { key: "global" },
        update: updateData,
        create: { key: "global", ...DEFAULTS, ...updateData },
    })

    await revalidatePublic(SETTINGS_CACHE_TAG)
    revalidatePath("/", "layout")

    return NextResponse.json({ success: true, data: pick(settings as Record<string, unknown>) })
}
