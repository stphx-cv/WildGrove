// ══════════════════════════════════════════════════════════════════
// Admin Settings — Feature flags & configuration (OWNER only)
// ══════════════════════════════════════════════════════════════════

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { APIProvider } from "@wildgrove/ui/places/maps"
import { ContactAddressField } from "@/components/ContactAddressField"
import { AddressAutocomplete, type PlaceDetails } from "@wildgrove/ui/places/AddressAutocomplete"
import { MapPicker } from "@wildgrove/ui/places/MapPicker"
import { Switch } from "@wildgrove/ui/Switch"
import { SocialIcon } from "@wildgrove/ui/social/SocialIcon"
import { PhoneInput } from "@wildgrove/ui/PhoneInput"
import { toE164 } from "@wildgrove/core/public-contact"
import { Textarea } from "@wildgrove/ui/Textarea"
import { AdminSelect, type SelectOption } from "@/components/AdminSelect"
import { AdminTimePicker } from "@/components/AdminTimePicker"
import { AdminNumberInput } from "@/components/AdminNumberInput"
import { CURRENCY_LABELS, isSupportedCurrency, type SupportedCurrency } from "@wildgrove/core/currency"
import {
    AI_MAX_TOKENS_RANGE,
    AI_PROVIDER_ENV_VARS,
    AI_PROVIDER_LABELS,
    AI_PROVIDERS,
    AI_TEMPERATURE_RANGE,
    isValidCustomBaseUrl,
    type AiProvider,
} from "@wildgrove/core/chat/ai-providers"
import {
    CHAT_MODES,
    DEFAULT_CHAT_MODE,
    DEFAULT_SAGE_MENU_DEFAULT_COUNT,
    DEFAULT_SAGE_MENU_PAGE_SIZE,
    OPENROUTER_API_KEY_ENV,
    SAGE_MENU_PAGE_SIZE_RANGE,
    TYPESAFE_API_KEY_ENV,
    chatModeUsesSage,
    isChatMode,
    type ChatMode,
    type ChatStatus,
} from "@wildgrove/core/chat/chat-settings"
import type { ClosedTimeRange } from "@wildgrove/core/reservation-schedule"
import { APP_DATETIME_TIMEZONE } from "@wildgrove/core/app-datetime-format"
import {
    DEFAULT_MAX_RESERVATIONS_PER_SLOT,
    MAX_RESERVATIONS_PER_SLOT_RANGE,
} from "@wildgrove/core/reservation-capacity"
import {
    EMPTY_SOCIAL_LINKS,
    SOCIAL_PLATFORMS,
    WHATSAPP_USERNAME_KEY,
    normalizeSocialLabel,
    normalizeSocialLinksForStorage,
    normalizeSocialValue,
    type SocialLinksConfig,
    type SocialPlatformId,
} from "@wildgrove/core/social-links"
import { LoadingState } from "@/components/LoadingState"
import {
    closedRangesFullyInsideOpeningHours,
    generateTimeSlots,
    normalizeClosedTimeRangesForStorage,
    timeToMinutes,
} from "@wildgrove/core/reservation-schedule"
import {
    ClockRightAngleIcon,
    DocumentLinesIcon,
    EnvelopeIcon,
    ExclamationTriangleBarIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    Spinner,
    StarOutlineIcon,
} from "@wildgrove/ui/icons"

type FetchStatus = "loading" | "idle" | "error"
type AdvanceUnit = "minutes" | "hours" | "days" | "weeks"
type SettingsSectionKey =
    | "reservations"
    | "general"
    | "chatbot"
    | "catalog"
    | "reviews"
    | "contact"
    | "security"
    | "notifications"
    | "payments"
    | "dashboard"

const UNIT_OPTIONS: SelectOption[] = [
    { value: "minutes", label: "Minutes" },
    { value: "hours",   label: "Hours"   },
    { value: "days",    label: "Days"    },
    { value: "weeks",   label: "Weeks"   },
]

const TIME_SLOT_OPTIONS: SelectOption[] = [
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour"     },
]

const DATE_FORMAT_OPTIONS: SelectOption[] = [
    { value: "DD/MM/YYYY",  label: "DD/MM/YYYY"  },
    { value: "MM/DD/YYYY",  label: "MM/DD/YYYY"  },
    { value: "YYYY-MM-DD",  label: "YYYY-MM-DD"  },
]

const CHAT_POSITION_OPTIONS: SelectOption[] = [
    { value: "right", label: "Right" },
    { value: "left",  label: "Left"  },
]

const AI_PROVIDER_OPTIONS: SelectOption[] = AI_PROVIDERS.map((provider) => ({
    value: provider,
    label: AI_PROVIDER_LABELS[provider],
}))

const CHAT_MODE_OPTIONS: Record<ChatMode, { label: string; description: string }> = {
    off:   { label: "Off",            description: "No chat bubble, and no chat button on the contact page." },
    staff: { label: "Staff only",     description: "Every conversation goes to the team and is answered from this panel. No AI, and no keys needed." },
    sage:  { label: "Sage only",      description: "Sage answers every message. Asked for a person, it gives the contact channels." },
    mixed: { label: "Sage and staff", description: "Sage answers, and hands the conversation to the team when the guest asks for a person." },
}

const DECISION_VIA_LABELS: Record<string, string> = {
    openrouter: "OpenRouter",
    typesafe: "TypeSafe, the fallback key",
}

function formatStatusTime(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: APP_DATETIME_TIMEZONE,
    })
}

/** One line of the read-only key status: whether an env var is set on the storefront. */
function KeyStatusRow({ label, envVar, set, optional = false }: { label: string; envVar: string; set: boolean; optional?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
                <p className="text-sm text-wg-text dark:text-wg-dark-text">{label}</p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted"><code className="font-mono">{envVar}</code></p>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                set && !optional
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-wg-border/40 text-wg-muted dark:bg-wg-dark-border/40 dark:text-wg-dark-muted"
            }`}>
                {optional ? "Optional" : set ? "Set" : "Not set"}
            </span>
        </div>
    )
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const CURRENCY_OPTIONS: SelectOption[] = [
    {
        value: "PEN",
        label: CURRENCY_LABELS.PEN,
        icon: (
            <span className="text-xs font-bold">S/</span>
        ),
    },
    {
        value: "USD",
        label: CURRENCY_LABELS.USD,
        icon: (
            <span className="text-xs font-bold">$</span>
        ),
    },
]

/** Fallback map center (Lima) when coordinates are not set yet — same order of magnitude as placeholders */
const DEFAULT_RESTAURANT_MAP_CENTER = { lat: -12.046374, lng: -77.042793 } as const

const MAPS_PUBLIC_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

const SETTINGS_SECTION_TABS: Array<{ key: SettingsSectionKey; label: string }> = [
    { key: "general", label: "General" },
    { key: "dashboard", label: "Dashboard" },
    { key: "notifications", label: "Notifications" },
    { key: "catalog", label: "Catalog" },
    { key: "reservations", label: "Reservations" },
    { key: "chatbot", label: "Chatbot" },
    { key: "reviews", label: "Reviews" },
    { key: "payments", label: "Payments & Orders" },
    { key: "contact", label: "Contact" },
    { key: "security", label: "Security" },
]

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

/** Marks a settings card as editable only by users with the Owner role */
function OwnerSettingBadge() {
    return (
        <span
            title="Requires Owner role to modify"
            className="inline-flex shrink-0 items-center rounded-md border border-wg-primary/35 dark:border-wg-dark-accent/45 bg-wg-primary/[0.09] dark:bg-wg-dark-accent/[0.14] px-2 py-0.5 text-[11px] font-semibold text-wg-primary dark:text-wg-dark-accent"
        >
            Owner
        </span>
    )
}

/** Card title + description with a single Owner badge (top-right on wide screens) */
function OwnerSettingCardHeader({ title, description }: { title: string; description: string }) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">{title}</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">{description}</p>
            </div>
            <div className="flex shrink-0 justify-end sm:self-start sm:pt-0.5">
                <OwnerSettingBadge />
            </div>
        </div>
    )
}

/** Snapshot of persisted settings — used to compute unsaved changes */
interface SettingsBaseline {
    advanceReservationEnabled: boolean
    advanceReservationValue: number
    advanceReservationUnit: string
    productImageLimit: number
    defaultCurrency: string
    reviewPhotoLimit: number
    chatMode: ChatMode
    sageShareIngredients: boolean
    sageMenuPageSize: number
    sageMenuDefaultCount: number
    sageShowTechnicalDetails: boolean
    aiProvider: string
    aiBaseUrl: string
    aiModel: string
    aiSummaryModel: string
    aiTemperature: number
    aiMaxTokens: number
    galleryAutoPlayInterval: number
    reviewsEnabled: boolean
    maxPartySize: number
    largeGroupWarningFrom: number
    maxReservationsPerSlot: number
    timeSlotIncrement: number
    reservationDurationEnabled: boolean
    reservationDurationValue: number
    reservationDurationUnit: string
    maxDaysAhead: number
    operatingDays: string
    openingTime: string
    closingTime: string
    closedTimeRanges: ClosedTimeRange[]
    contactPhone: string
    contactPhoneHoursNoteEn: string
    contactPhoneHoursNoteEs: string
    contactAddress: string
    socialLinks: SocialLinksConfig
    publicContactEmail: string
    chatBubblePosition: string
    dateFormat: string
    timeFormat: string
    adminEmailNotificationsEnabled: boolean
    notificationEmail: string
    // Payments & Orders
    walletEnabled: boolean
    walletAllowDualCurrency: boolean
    initialBalancePEN: string
    initialBalanceUSD: string
    pickupEnabled: boolean
    deliveryEnabled: boolean
    pickupLeadTimeMinutes: number
    orderNumberPrefix: string
    restaurantLat: string | null
    restaurantLng: string | null
    // Fiscal
    companyRuc: string
    companyLegalName: string
    companyFiscalAddress: string
    igvRate: string
    boletaSeries: string
    facturaSeries: string
    boletaEnabled: boolean
    facturaEnabled: boolean
    // Dashboard preferences
    dashboardKitchenAlertMinutes: number
    dashboardPickupAlertMinutes: number
    dashboardLowStockThreshold: number
    dashboardEtaToleranceMinutes: number
    dashboardDefaultPreset: string
}

function normalizeOperatingDaysString(days: number[]): string {
    return [...new Set(days.filter((d) => d >= 1 && d <= 7))]
        .sort((a, b) => a - b)
        .join(",")
}

/** Keep current values visible in the picker when they are not on the generated slot grid. */
function mergeValidTimeSlots(base: string[], extras: string[]): string[] {
    const s = new Set(base)
    for (const raw of extras) {
        const t = raw?.trim() ?? ""
        if (t && timeToMinutes(t) !== null) s.add(t)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
}

function baselineFromApi(d: Record<string, unknown>): SettingsBaseline {
    return {
        advanceReservationEnabled: Boolean(d.advanceReservationEnabled ?? true),
        advanceReservationValue:   Number(d.advanceReservationValue ?? 2),
        advanceReservationUnit:    String(d.advanceReservationUnit ?? "hours"),
        productImageLimit:         Number(d.productImageLimit ?? 4),
        defaultCurrency:           String(d.defaultCurrency ?? "PEN"),
        reviewPhotoLimit:          Number(d.reviewPhotoLimit ?? 3),
        chatMode:                  isChatMode(d.chatMode) ? d.chatMode : DEFAULT_CHAT_MODE,
        sageShareIngredients:      Boolean(d.sageShareIngredients ?? true),
        sageMenuPageSize:          Number(d.sageMenuPageSize ?? DEFAULT_SAGE_MENU_PAGE_SIZE),
        sageMenuDefaultCount:      Number(d.sageMenuDefaultCount ?? DEFAULT_SAGE_MENU_DEFAULT_COUNT),
        sageShowTechnicalDetails:  Boolean(d.sageShowTechnicalDetails ?? false),
        aiProvider:                String(d.aiProvider ?? "openai"),
        aiBaseUrl:                 String(d.aiBaseUrl ?? ""),
        aiModel:                   String(d.aiModel ?? "gpt-4o-mini"),
        aiSummaryModel:            String(d.aiSummaryModel ?? ""),
        aiTemperature:             Number(d.aiTemperature ?? 0.7),
        aiMaxTokens:               Number(d.aiMaxTokens ?? 1600),
        galleryAutoPlayInterval:   Number(d.galleryAutoPlayInterval ?? 5),
        reviewsEnabled:            Boolean(d.reviewsEnabled ?? true),
        maxPartySize:              Number(d.maxPartySize ?? 40),
        largeGroupWarningFrom:     Number(d.largeGroupWarningFrom ?? 8),
        maxReservationsPerSlot:    Number(d.maxReservationsPerSlot ?? DEFAULT_MAX_RESERVATIONS_PER_SLOT),
        timeSlotIncrement:         Number(d.timeSlotIncrement ?? 30),
        reservationDurationEnabled: Boolean(d.reservationDurationEnabled ?? false),
        reservationDurationValue:  Number(d.reservationDurationValue ?? 1),
        reservationDurationUnit:   String(d.reservationDurationUnit ?? "hours"),
        maxDaysAhead:              Number(d.maxDaysAhead ?? 30),
        operatingDays:             normalizeOperatingDaysString(
            String(d.operatingDays ?? "1,2,3,4,5,6,7")
                .split(",")
                .map(Number)
                .filter(Boolean),
        ),
        openingTime:               String(d.openingTime ?? "09:00"),
        closingTime:               String(d.closingTime ?? "22:00"),
        closedTimeRanges:          normalizeClosedTimeRangesForStorage(d.closedTimeRanges ?? []),
        contactPhone:              toE164(String(d.contactPhone ?? "")),
        contactPhoneHoursNoteEn:   String(d.contactPhoneHoursNoteEn ?? ""),
        contactPhoneHoursNoteEs:   String(d.contactPhoneHoursNoteEs ?? ""),
        contactAddress:            String(d.contactAddress ?? ""),
        socialLinks:               normalizeSocialLinksForStorage(d.socialLinks),
        publicContactEmail:      String(d.publicContactEmail ?? ""),
        chatBubblePosition:        String(d.chatBubblePosition ?? "right"),
        dateFormat:                String(d.dateFormat ?? "DD/MM/YYYY"),
        timeFormat:                String(d.timeFormat ?? "24h"),
        adminEmailNotificationsEnabled: Boolean(d.adminEmailNotificationsEnabled ?? true),
        notificationEmail:         String(d.notificationEmail ?? ""),
        // Payments & Orders
        walletEnabled:             Boolean(d.walletEnabled ?? true),
        walletAllowDualCurrency:   Boolean(d.walletAllowDualCurrency ?? true),
        initialBalancePEN:         String(d.initialBalancePEN ?? "200"),
        initialBalanceUSD:         String(d.initialBalanceUSD ?? "80"),
        pickupEnabled:             Boolean(d.pickupEnabled ?? true),
        deliveryEnabled:           Boolean(d.deliveryEnabled ?? true),
        pickupLeadTimeMinutes:     Number(d.pickupLeadTimeMinutes ?? 15),
        orderNumberPrefix:         String(d.orderNumberPrefix ?? "WG"),
        restaurantLat:             d.restaurantLat != null ? String(d.restaurantLat) : null,
        restaurantLng:             d.restaurantLng != null ? String(d.restaurantLng) : null,
        companyRuc:                String(d.companyRuc ?? ""),
        companyLegalName:          String(d.companyLegalName ?? ""),
        companyFiscalAddress:      String(d.companyFiscalAddress ?? ""),
        igvRate:                   String(d.igvRate ?? "18"),
        boletaSeries:              String(d.boletaSeries ?? "B001"),
        facturaSeries:             String(d.facturaSeries ?? "F001"),
        boletaEnabled:             Boolean(d.boletaEnabled ?? true),
        facturaEnabled:            Boolean(d.facturaEnabled ?? true),
        // Dashboard preferences
        dashboardKitchenAlertMinutes: Number(d.dashboardKitchenAlertMinutes ?? 20),
        dashboardPickupAlertMinutes:  Number(d.dashboardPickupAlertMinutes ?? 10),
        dashboardLowStockThreshold:   Number(d.dashboardLowStockThreshold ?? 5),
        dashboardEtaToleranceMinutes: Number(d.dashboardEtaToleranceMinutes ?? 15),
        dashboardDefaultPreset:       String(d.dashboardDefaultPreset ?? "today"),
    }
}


export default function SettingsPage() {
    const [fetchStatus, setFetchStatus] = useState<FetchStatus>("loading")
    const [error, setError] = useState("")
    const [isOwner, setIsOwner] = useState(true)
    const [baseline, setBaseline] = useState<SettingsBaseline | null>(null)
    const [bulkSaving, setBulkSaving] = useState(false)
    const [bulkBarError, setBulkBarError] = useState("")
    const [bulkBarSuccess, setBulkBarSuccess] = useState(false)

    // Advance reservation
    const [advEnabled, setAdvEnabled] = useState(true)
    const [advValue, setAdvValue]     = useState("2")
    const [advUnit, setAdvUnit]       = useState<AdvanceUnit>("hours")
    const [advError, setAdvError]     = useState("")

    // Product gallery limit
    const [imgLimit, setImgLimit]       = useState("4")
    const [imgLimitError, setImgLimitError]   = useState("")

    // Review photo limit
    const [reviewPhotoLimit, setReviewPhotoLimit]         = useState("3")
    const [reviewPhotoError, setReviewPhotoError]         = useState("")

    // Default currency
    const [defaultCurrency, setDefaultCurrency]       = useState<SupportedCurrency>("PEN")

    // Gallery auto-play interval
    const [galleryInterval, setGalleryInterval]           = useState("5")
    const [galleryIntervalError, setGalleryIntervalError]   = useState("")

    // Customer Reviews toggle
    const [reviewsEnabled, setReviewsEnabled]         = useState(true)
    const [reviewsError, setReviewsError]             = useState("")

    // Who answers the chat, and what the storefront says about the keys Sage needs
    const [chatMode, setChatMode]                     = useState<ChatMode>(DEFAULT_CHAT_MODE)
    const [chatStatus, setChatStatus]                 = useState<ChatStatus | null>(null)
    const [chatStatusState, setChatStatusState]       = useState<"loading" | "ok" | "unreachable">("loading")
    const [sageShareIngredients, setSageShareIngredients] = useState(true)
    const [sageMenuPageSize, setSageMenuPageSize]     = useState(String(DEFAULT_SAGE_MENU_PAGE_SIZE))
    const [sageMenuDefaultCount, setSageMenuDefaultCount] = useState(String(DEFAULT_SAGE_MENU_DEFAULT_COUNT))
    const [sageShowTechnicalDetails, setSageShowTechnicalDetails] = useState(false)
    const [sageDecisionModel, setSageDecisionModel]   = useState("")

    // Max party size
    const [maxPartySize, setMaxPartySize]             = useState("40")
    const [maxPartySizeError, setMaxPartySizeError]   = useState("")
    const [largeGroupWarningFrom, setLargeGroupWarningFrom]             = useState("8")
    const [largeGroupWarningError, setLargeGroupWarningError]           = useState("")

    // Reservations per time slot (capacity)
    const [maxResPerSlot, setMaxResPerSlot]           = useState(String(DEFAULT_MAX_RESERVATIONS_PER_SLOT))
    const [maxResPerSlotError, setMaxResPerSlotError] = useState("")

    // Time slot increment
    const [timeSlotIncrement, setTimeSlotIncrement]   = useState("30")
    const [timeSlotError, setTimeSlotError]           = useState("")

    // Reservation duration
    const [resDurEnabled, setResDurEnabled]           = useState(false)
    const [resDurValue, setResDurValue]               = useState("1")
    const [resDurUnit, setResDurUnit]                 = useState<AdvanceUnit>("hours")
    const [resDurError, setResDurError]               = useState("")

    // Max days ahead
    const [maxDaysAhead, setMaxDaysAhead]             = useState("30")
    const [maxDaysError, setMaxDaysError]             = useState("")

    // Operating days
    const [operatingDays, setOperatingDays]           = useState<number[]>([1,2,3,4,5,6,7])
    const [opDaysError, setOpDaysError]               = useState("")

    // Opening / closing hours
    const [openingTime, setOpeningTime]               = useState("09:00")
    const [closingTime, setClosingTime]               = useState("22:00")
    const [hoursError, setHoursError]                 = useState("")
    const [closedRanges, setClosedRanges]             = useState<ClosedTimeRange[]>([])
    const [closedRangesError, setClosedRangesError]   = useState("")

    // Contact phone
    const [contactPhone, setContactPhone]             = useState("")
    const [contactPhoneError, setContactPhoneError]   = useState("")
    const [contactPhoneHoursNoteEn, setContactPhoneHoursNoteEn] = useState("")
    const [contactPhoneHoursNoteEs, setContactPhoneHoursNoteEs] = useState("")

    // Contact address
    const [contactAddress, setContactAddress]                 = useState("")
    const [contactAddressError, setContactAddressError]       = useState("")

    // Social networks — raw text per platform; normalized on blur and on save
    const [socialLinks, setSocialLinks]                       = useState<SocialLinksConfig>(EMPTY_SOCIAL_LINKS)
    const [socialLinksError, setSocialLinksError]             = useState("")

    // Public contact email (visitor-facing; does not change SMTP / .env)
    const [publicContactEmail, setPublicContactEmail]         = useState("")
    const [publicContactEmailError, setPublicContactEmailError] = useState("")

    // Sage's AI provider — the API key stays in the storefront's env, never here
    const [aiProvider, setAiProvider]                         = useState<AiProvider>("openai")
    const [aiBaseUrl, setAiBaseUrl]                           = useState("")
    const [aiModel, setAiModel]                               = useState("gpt-4o-mini")
    const [aiSummaryModel, setAiSummaryModel]                 = useState("")
    const [aiTemperature, setAiTemperature]                   = useState("0.7")
    const [aiMaxTokens, setAiMaxTokens]                       = useState("1600")
    const [aiError, setAiError]                               = useState("")

    // Chat bubble position
    const [chatBubblePosition, setChatBubblePosition]         = useState("right")
    const [chatPosError, setChatPosError]                     = useState("")

    // Date format
    const [dateFormat, setDateFormat]                         = useState("DD/MM/YYYY")
    const [dateFormatError, setDateFormatError]               = useState("")

    // Time format
    const [timeFormat, setTimeFormat]                         = useState("24h")
    const [timeFormatError, setTimeFormatError]               = useState("")

    // Admin email notifications
    const [adminEmailNotificationsEnabled, setAdminEmailNotificationsEnabled] = useState(true)
    const [notifEmail, setNotifEmail]                         = useState("")
    const [notifEmailError, setNotifEmailError]               = useState("")

    // Payments & Orders
    const [walletEnabled, setWalletEnabled]                   = useState(true)
    const [walletAllowDualCurrency, setWalletAllowDualCurrency] = useState(true)
    const [initialBalancePEN, setInitialBalancePEN]           = useState("200")
    const [initialBalanceUSD, setInitialBalanceUSD]           = useState("80")
    const [pickupEnabled, setPickupEnabled]                   = useState(true)
    const [deliveryEnabled, setDeliveryEnabled]               = useState(true)
    const [fulfillmentError, setFulfillmentError]             = useState("")
    const [pickupLeadTimeMinutes, setPickupLeadTimeMinutes]   = useState("15")
    const [orderNumberPrefix, setOrderNumberPrefix]           = useState("WG")
    const [restaurantLat, setRestaurantLat]                   = useState("")
    const [restaurantLng, setRestaurantLng]                   = useState("")
    /** Places search field — not persisted */
    const [restaurantLocationSearch, setRestaurantLocationSearch] = useState("")
    // Dashboard preferences
    const [dashKitchenAlertMin, setDashKitchenAlertMin]   = useState("20")
    const [dashPickupAlertMin, setDashPickupAlertMin]     = useState("10")
    const [dashLowStockThreshold, setDashLowStockThreshold] = useState("5")
    const [dashEtaToleranceMin, setDashEtaToleranceMin]   = useState("15")
    const [dashDefaultPreset, setDashDefaultPreset]       = useState("today")

    // CMS narrative fields
    // Fiscal data
    const [companyRuc, setCompanyRuc]                         = useState("")
    const [companyLegalName, setCompanyLegalName]             = useState("")
    const [companyFiscalAddress, setCompanyFiscalAddress]     = useState("")
    const [igvRate, setIgvRate]                               = useState("18")
    const [boletaSeries, setBoletaSeries]                     = useState("B001")
    const [facturaSeries, setFacturaSeries]                   = useState("F001")
    const [boletaEnabled, setBoletaEnabled]                   = useState(true)
    const [facturaEnabled, setFacturaEnabled]                 = useState(true)

    const [activeSection, setActiveSection]                   = useState<SettingsSectionKey>("general")
    const parsedMaxPartySize = Number.parseInt(maxPartySize, 10)
    const effectiveMaxPartySize = Number.isFinite(parsedMaxPartySize) ? clampNumber(parsedMaxPartySize, 1, 50) : 50

    const parsedSlotInc = Number.parseInt(timeSlotIncrement, 10)
    const effectiveSlotIncrement =
        Number.isFinite(parsedSlotInc) && (parsedSlotInc === 15 || parsedSlotInc === 30 || parsedSlotInc === 60)
            ? parsedSlotInc
            : 30

    const restaurantMapPin = useMemo(() => {
        const lat = Number.parseFloat(restaurantLat.trim())
        const lng = Number.parseFloat(restaurantLng.trim())
        const valid =
            restaurantLat.trim() !== "" &&
            restaurantLng.trim() !== "" &&
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        if (valid) return { lat, lng }
        return { lat: DEFAULT_RESTAURANT_MAP_CENTER.lat, lng: DEFAULT_RESTAURANT_MAP_CENTER.lng }
    }, [restaurantLat, restaurantLng])

    const onRestaurantAddressPick = useCallback((details: PlaceDetails) => {
        if (details.lat == null || details.lng == null) return
        setRestaurantLat(String(details.lat))
        setRestaurantLng(String(details.lng))
        setRestaurantLocationSearch(details.fullAddress)
    }, [])

    const onRestaurantMapDrag = useCallback((lat: number, lng: number) => {
        setRestaurantLat(String(lat))
        setRestaurantLng(String(lng))
    }, [])

    const openingHoursSlotOptions = useMemo(
        () => generateTimeSlots("00:00", "23:45", effectiveSlotIncrement, []),
        [effectiveSlotIncrement],
    )

    const breakSlotOptionsBase = useMemo(
        () => generateTimeSlots(openingTime, closingTime, effectiveSlotIncrement, []),
        [openingTime, closingTime, effectiveSlotIncrement],
    )

    // Fetch current settings
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/settings")
                const data = await res.json()
                if (!res.ok) {
                    setError(data.error || "Failed to load settings.")
                    setFetchStatus("error")
                    return
                }
                setAdvEnabled(data.data.advanceReservationEnabled ?? true)
                setAdvValue(String(data.data.advanceReservationValue ?? 2))
                setAdvUnit((data.data.advanceReservationUnit ?? "hours") as AdvanceUnit)
                setImgLimit(String(data.data.productImageLimit ?? 4))
                setReviewPhotoLimit(String(data.data.reviewPhotoLimit ?? 3))
                setDefaultCurrency((data.data.defaultCurrency ?? "PEN") as SupportedCurrency)
                setChatMode(isChatMode(data.data.chatMode) ? data.data.chatMode : DEFAULT_CHAT_MODE)
                setSageShareIngredients(data.data.sageShareIngredients ?? true)
                setSageMenuPageSize(String(data.data.sageMenuPageSize ?? DEFAULT_SAGE_MENU_PAGE_SIZE))
                setSageMenuDefaultCount(String(data.data.sageMenuDefaultCount ?? DEFAULT_SAGE_MENU_DEFAULT_COUNT))
                setSageShowTechnicalDetails(data.data.sageShowTechnicalDetails ?? false)
                setSageDecisionModel(String(data.data.sageDecisionModel ?? ""))
                setAiProvider((data.data.aiProvider ?? "openai") as AiProvider)
                setAiBaseUrl(data.data.aiBaseUrl ?? "")
                setAiModel(data.data.aiModel ?? "gpt-4o-mini")
                setAiSummaryModel(data.data.aiSummaryModel ?? "")
                setAiTemperature(String(data.data.aiTemperature ?? 0.7))
                setAiMaxTokens(String(data.data.aiMaxTokens ?? 1600))
                setGalleryInterval(String(data.data.galleryAutoPlayInterval ?? 5))
                setReviewsEnabled(data.data.reviewsEnabled ?? true)
                setMaxPartySize(String(data.data.maxPartySize ?? 40))
                setLargeGroupWarningFrom(String(data.data.largeGroupWarningFrom ?? 8))
                setMaxResPerSlot(String(data.data.maxReservationsPerSlot ?? DEFAULT_MAX_RESERVATIONS_PER_SLOT))
                setTimeSlotIncrement(String(data.data.timeSlotIncrement ?? 30))
                setResDurEnabled(data.data.reservationDurationEnabled ?? false)
                setResDurValue(String(data.data.reservationDurationValue ?? 1))
                setResDurUnit((data.data.reservationDurationUnit ?? "hours") as AdvanceUnit)
                setMaxDaysAhead(String(data.data.maxDaysAhead ?? 30))
                const rawDays = data.data.operatingDays ?? "1,2,3,4,5,6,7"
                setOperatingDays(String(rawDays).split(",").map(Number).filter(Boolean))
                setOpeningTime(data.data.openingTime ?? "09:00")
                setClosingTime(data.data.closingTime ?? "22:00")
                setClosedRanges(normalizeClosedTimeRangesForStorage(data.data.closedTimeRanges ?? []))
                setContactPhone(toE164(data.data.contactPhone ?? ""))
                setContactPhoneHoursNoteEn(data.data.contactPhoneHoursNoteEn ?? "")
                setContactPhoneHoursNoteEs(data.data.contactPhoneHoursNoteEs ?? "")
                setContactAddress(data.data.contactAddress ?? "")
                setSocialLinks(normalizeSocialLinksForStorage(data.data.socialLinks))
                setPublicContactEmail(data.data.publicContactEmail ?? "")
                setChatBubblePosition(data.data.chatBubblePosition ?? "right")
                setDateFormat(data.data.dateFormat ?? "DD/MM/YYYY")
                setTimeFormat(data.data.timeFormat ?? "24h")
                setAdminEmailNotificationsEnabled(data.data.adminEmailNotificationsEnabled ?? true)
                setNotifEmail(data.data.notificationEmail ?? "")
                // Payments & Orders
                setWalletEnabled(data.data.walletEnabled ?? true)
                setWalletAllowDualCurrency(data.data.walletAllowDualCurrency ?? true)
                setInitialBalancePEN(String(data.data.initialBalancePEN ?? "200"))
                setInitialBalanceUSD(String(data.data.initialBalanceUSD ?? "80"))
                setPickupEnabled(data.data.pickupEnabled ?? true)
                setDeliveryEnabled(data.data.deliveryEnabled ?? true)
                setPickupLeadTimeMinutes(String(data.data.pickupLeadTimeMinutes ?? 15))
                setOrderNumberPrefix(data.data.orderNumberPrefix ?? "WG")
                setRestaurantLat(data.data.restaurantLat != null ? String(data.data.restaurantLat) : "")
                setRestaurantLng(data.data.restaurantLng != null ? String(data.data.restaurantLng) : "")
                setRestaurantLocationSearch("")
                setCompanyRuc(data.data.companyRuc ?? "")
                setCompanyLegalName(data.data.companyLegalName ?? "")
                setCompanyFiscalAddress(data.data.companyFiscalAddress ?? "")
                setIgvRate(String(data.data.igvRate ?? "18"))
                setBoletaSeries(data.data.boletaSeries ?? "B001")
                setFacturaSeries(data.data.facturaSeries ?? "F001")
                setBoletaEnabled(data.data.boletaEnabled ?? true)
                setFacturaEnabled(data.data.facturaEnabled ?? true)
                // Dashboard preferences
                setDashKitchenAlertMin(String(data.data.dashboardKitchenAlertMinutes ?? 20))
                setDashPickupAlertMin(String(data.data.dashboardPickupAlertMinutes ?? 10))
                setDashLowStockThreshold(String(data.data.dashboardLowStockThreshold ?? 5))
                setDashEtaToleranceMin(String(data.data.dashboardEtaToleranceMinutes ?? 15))
                setDashDefaultPreset(data.data.dashboardDefaultPreset ?? "today")
                setBaseline(baselineFromApi(data.data as Record<string, unknown>))
                setFetchStatus("idle")
            } catch {
                setError("Failed to load settings.")
                setFetchStatus("error")
            }
        }
        load()
    }, [])

    // The storefront answers whether its keys are set; the panel never sees them.
    const loadChatStatus = useCallback(async () => {
        setChatStatusState("loading")
        try {
            const res = await fetch("/api/settings/chat-status", { cache: "no-store" })
            const json = await res.json()
            if (res.ok && json.success) {
                setChatStatus(json.data as ChatStatus)
                setChatStatusState("ok")
                return
            }
        } catch {
            // Reported below as unreachable.
        }
        setChatStatus(null)
        setChatStatusState("unreachable")
    }, [])

    useEffect(() => {
        loadChatStatus()
    }, [loadChatStatus])

    function clearFieldErrors() {
        setError("")
        setBulkBarError("")
        setAdvError("")
        setImgLimitError("")
        setReviewPhotoError("")
        setGalleryIntervalError("")
        setReviewsError("")
        setAiError("")
        setMaxPartySizeError("")
        setLargeGroupWarningError("")
        setMaxResPerSlotError("")
        setTimeSlotError("")
        setResDurError("")
        setMaxDaysError("")
        setOpDaysError("")
        setFulfillmentError("")
        setHoursError("")
        setClosedRangesError("")
        setContactPhoneError("")
        setContactAddressError("")
        setSocialLinksError("")
        setPublicContactEmailError("")
        setChatPosError("")
        setDateFormatError("")
        setTimeFormatError("")
        setNotifEmailError("")
    }

    function applyBaseline(b: SettingsBaseline) {
        setAdvEnabled(b.advanceReservationEnabled)
        setAdvValue(String(b.advanceReservationValue))
        setAdvUnit(b.advanceReservationUnit as AdvanceUnit)
        setImgLimit(String(b.productImageLimit))
        setReviewPhotoLimit(String(b.reviewPhotoLimit))
        setDefaultCurrency(b.defaultCurrency as SupportedCurrency)
        setChatMode(b.chatMode)
        setSageShareIngredients(b.sageShareIngredients)
        setSageMenuPageSize(String(b.sageMenuPageSize))
        setSageMenuDefaultCount(String(b.sageMenuDefaultCount))
        setSageShowTechnicalDetails(b.sageShowTechnicalDetails)
        setAiProvider(b.aiProvider as AiProvider)
        setAiBaseUrl(b.aiBaseUrl)
        setAiModel(b.aiModel)
        setAiSummaryModel(b.aiSummaryModel)
        setAiTemperature(String(b.aiTemperature))
        setAiMaxTokens(String(b.aiMaxTokens))
        setGalleryInterval(String(b.galleryAutoPlayInterval))
        setReviewsEnabled(b.reviewsEnabled)
        setMaxPartySize(String(b.maxPartySize))
        setLargeGroupWarningFrom(String(b.largeGroupWarningFrom))
        setMaxResPerSlot(String(b.maxReservationsPerSlot))
        setTimeSlotIncrement(String(b.timeSlotIncrement))
        setResDurEnabled(b.reservationDurationEnabled)
        setResDurValue(String(b.reservationDurationValue))
        setResDurUnit(b.reservationDurationUnit as AdvanceUnit)
        setMaxDaysAhead(String(b.maxDaysAhead))
        setOperatingDays(
            b.operatingDays
                .split(",")
                .map(Number)
                .filter(Boolean)
                .sort((a, c) => a - c),
        )
        setOpeningTime(b.openingTime)
        setClosingTime(b.closingTime)
        setClosedRanges([...b.closedTimeRanges])
        setContactPhone(b.contactPhone)
        setContactPhoneHoursNoteEn(b.contactPhoneHoursNoteEn)
        setContactPhoneHoursNoteEs(b.contactPhoneHoursNoteEs)
        setContactAddress(b.contactAddress)
        setSocialLinks({ hideHandles: b.socialLinks.hideHandles, links: { ...b.socialLinks.links } })
        setPublicContactEmail(b.publicContactEmail)
        setChatBubblePosition(b.chatBubblePosition)
        setDateFormat(b.dateFormat)
        setTimeFormat(b.timeFormat)
        setAdminEmailNotificationsEnabled(b.adminEmailNotificationsEnabled)
        setNotifEmail(b.notificationEmail)
        // Payments & Orders
        setWalletEnabled(b.walletEnabled)
        setWalletAllowDualCurrency(b.walletAllowDualCurrency)
        setInitialBalancePEN(b.initialBalancePEN)
        setInitialBalanceUSD(b.initialBalanceUSD)
        setPickupEnabled(b.pickupEnabled)
        setDeliveryEnabled(b.deliveryEnabled)
        setPickupLeadTimeMinutes(String(b.pickupLeadTimeMinutes))
        setOrderNumberPrefix(b.orderNumberPrefix)
        setRestaurantLat(b.restaurantLat ?? "")
        setRestaurantLng(b.restaurantLng ?? "")
        setRestaurantLocationSearch("")
        setCompanyRuc(b.companyRuc)
        setCompanyLegalName(b.companyLegalName)
        setCompanyFiscalAddress(b.companyFiscalAddress)
        setIgvRate(b.igvRate)
        setBoletaSeries(b.boletaSeries)
        setFacturaSeries(b.facturaSeries)
        setBoletaEnabled(b.boletaEnabled)
        setFacturaEnabled(b.facturaEnabled)
        // Dashboard preferences
        setDashKitchenAlertMin(String(b.dashboardKitchenAlertMinutes))
        setDashPickupAlertMin(String(b.dashboardPickupAlertMinutes))
        setDashLowStockThreshold(String(b.dashboardLowStockThreshold))
        setDashEtaToleranceMin(String(b.dashboardEtaToleranceMinutes))
        setDashDefaultPreset(b.dashboardDefaultPreset)
    }

    const dirtyPatch = useMemo(() => {
        if (!baseline) return {}
        const b = baseline
        const p: Record<string, unknown> = {}


        if (advEnabled !== b.advanceReservationEnabled) {
            p.advanceReservationEnabled = advEnabled
        }
        if (advEnabled) {
            const av = Number.parseInt(advValue, 10)
            if (
                Number.isFinite(av) &&
                (av !== b.advanceReservationValue || advUnit !== b.advanceReservationUnit)
            ) {
                p.advanceReservationValue = av
                p.advanceReservationUnit = advUnit
            }
        }

        const imgN = Number.parseInt(imgLimit, 10)
        if (Number.isFinite(imgN) && imgN !== b.productImageLimit) p.productImageLimit = imgN

        const revN = Number.parseInt(reviewPhotoLimit, 10)
        if (Number.isFinite(revN) && revN !== b.reviewPhotoLimit) p.reviewPhotoLimit = revN

        if (defaultCurrency !== b.defaultCurrency) p.defaultCurrency = defaultCurrency

        const galN = Number.parseInt(galleryInterval, 10)
        if (Number.isFinite(galN) && galN !== b.galleryAutoPlayInterval) {
            p.galleryAutoPlayInterval = galN
        }

        if (reviewsEnabled !== b.reviewsEnabled) p.reviewsEnabled = reviewsEnabled
        if (chatMode !== b.chatMode) p.chatMode = chatMode
        if (sageShareIngredients !== b.sageShareIngredients) p.sageShareIngredients = sageShareIngredients
        const pageSizeN = Number.parseInt(sageMenuPageSize, 10)
        const usualN = Number.parseInt(sageMenuDefaultCount, 10)
        const effPageSize = Number.isFinite(pageSizeN)
            ? clampNumber(pageSizeN, SAGE_MENU_PAGE_SIZE_RANGE.min, SAGE_MENU_PAGE_SIZE_RANGE.max)
            : b.sageMenuPageSize
        const effUsual = Number.isFinite(usualN)
            ? clampNumber(usualN, SAGE_MENU_PAGE_SIZE_RANGE.min, effPageSize)
            : Math.min(b.sageMenuDefaultCount, effPageSize)
        if (effPageSize !== b.sageMenuPageSize || effUsual !== b.sageMenuDefaultCount) {
            p.sageMenuPageSize = effPageSize
            p.sageMenuDefaultCount = effUsual
        }
        if (sageShowTechnicalDetails !== b.sageShowTechnicalDetails) p.sageShowTechnicalDetails = sageShowTechnicalDetails

        if (aiProvider !== b.aiProvider) p.aiProvider = aiProvider
        if (aiBaseUrl.trim() !== b.aiBaseUrl) p.aiBaseUrl = aiBaseUrl.trim()
        if (aiModel.trim() !== "" && aiModel.trim() !== b.aiModel) p.aiModel = aiModel.trim()
        if (aiSummaryModel.trim() !== b.aiSummaryModel) p.aiSummaryModel = aiSummaryModel.trim()
        const tempN = Number.parseFloat(aiTemperature)
        if (Number.isFinite(tempN) && Math.abs(tempN - b.aiTemperature) > 0.001) p.aiTemperature = tempN
        const aiTokensN = Number.parseInt(aiMaxTokens, 10)
        if (Number.isFinite(aiTokensN) && aiTokensN !== b.aiMaxTokens) p.aiMaxTokens = aiTokensN

        const maxParsed = Number.parseInt(maxPartySize, 10)
        const warnParsed = Number.parseInt(largeGroupWarningFrom, 10)
        const effMax = Number.isFinite(maxParsed) ? clampNumber(maxParsed, 1, 50) : b.maxPartySize
        const effWarn = Number.isFinite(warnParsed)
            ? clampNumber(warnParsed, 1, effMax)
            : b.largeGroupWarningFrom
        if (effMax !== b.maxPartySize || effWarn !== b.largeGroupWarningFrom) {
            p.maxPartySize = effMax
            p.largeGroupWarningFrom = effWarn
        }

        const perSlotParsed = Number.parseInt(maxResPerSlot, 10)
        if (Number.isFinite(perSlotParsed)) {
            const effPerSlot = clampNumber(
                perSlotParsed,
                MAX_RESERVATIONS_PER_SLOT_RANGE.min,
                MAX_RESERVATIONS_PER_SLOT_RANGE.max,
            )
            if (effPerSlot !== b.maxReservationsPerSlot) p.maxReservationsPerSlot = effPerSlot
        }

        const slot = Number.parseInt(timeSlotIncrement, 10)
        if (Number.isFinite(slot) && slot !== b.timeSlotIncrement) p.timeSlotIncrement = slot

        if (resDurEnabled !== b.reservationDurationEnabled) {
            p.reservationDurationEnabled = resDurEnabled
        }
        if (resDurEnabled) {
            const rv = Number.parseInt(resDurValue, 10)
            if (
                Number.isFinite(rv) &&
                (rv !== b.reservationDurationValue || resDurUnit !== b.reservationDurationUnit)
            ) {
                p.reservationDurationValue = rv
                p.reservationDurationUnit = resDurUnit
            }
        }

        const md = Number.parseInt(maxDaysAhead, 10)
        if (Number.isFinite(md) && md !== b.maxDaysAhead) p.maxDaysAhead = md

        const opStr = normalizeOperatingDaysString(operatingDays)
        if (opStr !== b.operatingDays) p.operatingDays = opStr

        if (openingTime !== b.openingTime || closingTime !== b.closingTime) {
            p.openingTime = openingTime
            p.closingTime = closingTime
        }

        const normCurClosed = normalizeClosedTimeRangesForStorage(closedRanges)
        const normBaseClosed = normalizeClosedTimeRangesForStorage(b.closedTimeRanges)
        const closedRangesDirty =
            JSON.stringify(normCurClosed) !== JSON.stringify(normBaseClosed) ||
            closedRanges.length !== b.closedTimeRanges.length
        if (closedRangesDirty) {
            p.closedTimeRanges = normCurClosed
        }

        if (contactPhone !== b.contactPhone) p.contactPhone = contactPhone
        if (contactPhoneHoursNoteEn !== b.contactPhoneHoursNoteEn) p.contactPhoneHoursNoteEn = contactPhoneHoursNoteEn
        if (contactPhoneHoursNoteEs !== b.contactPhoneHoursNoteEs) p.contactPhoneHoursNoteEs = contactPhoneHoursNoteEs
        if (contactAddress !== b.contactAddress) p.contactAddress = contactAddress
        const normSocial = normalizeSocialLinksForStorage(socialLinks)
        if (JSON.stringify(normSocial) !== JSON.stringify(b.socialLinks)) p.socialLinks = normSocial
        if (publicContactEmail !== b.publicContactEmail) p.publicContactEmail = publicContactEmail
        if (chatBubblePosition !== b.chatBubblePosition) p.chatBubblePosition = chatBubblePosition
        if (dateFormat !== b.dateFormat) p.dateFormat = dateFormat
        if (timeFormat !== b.timeFormat) p.timeFormat = timeFormat
        if (adminEmailNotificationsEnabled !== b.adminEmailNotificationsEnabled) {
            p.adminEmailNotificationsEnabled = adminEmailNotificationsEnabled
        }
        if (notifEmail !== b.notificationEmail) p.notificationEmail = notifEmail

        // ── Payments & Orders ──────────────────────────────────────
        if (walletEnabled !== b.walletEnabled) p.walletEnabled = walletEnabled
        if (walletAllowDualCurrency !== b.walletAllowDualCurrency) p.walletAllowDualCurrency = walletAllowDualCurrency
        const initialPEN = parseFloat(initialBalancePEN)
        if (!isNaN(initialPEN) && initialPEN !== parseFloat(b.initialBalancePEN)) p.initialBalancePEN = initialPEN
        const initialUSD = parseFloat(initialBalanceUSD)
        if (!isNaN(initialUSD) && initialUSD !== parseFloat(b.initialBalanceUSD)) p.initialBalanceUSD = initialUSD
        if (pickupEnabled !== b.pickupEnabled) p.pickupEnabled = pickupEnabled
        if (deliveryEnabled !== b.deliveryEnabled) p.deliveryEnabled = deliveryEnabled
        const pickupLead = Number.parseInt(pickupLeadTimeMinutes, 10)
        if (Number.isFinite(pickupLead) && pickupLead !== b.pickupLeadTimeMinutes) p.pickupLeadTimeMinutes = pickupLead
        if (orderNumberPrefix.trim() && orderNumberPrefix.trim() !== b.orderNumberPrefix) p.orderNumberPrefix = orderNumberPrefix.trim()
        const rLat = restaurantLat.trim() !== "" ? parseFloat(restaurantLat) : null
        const bLat = b.restaurantLat != null ? parseFloat(b.restaurantLat) : null
        if (rLat !== bLat) p.restaurantLat = rLat
        const rLng = restaurantLng.trim() !== "" ? parseFloat(restaurantLng) : null
        const bLng = b.restaurantLng != null ? parseFloat(b.restaurantLng) : null
        if (rLng !== bLng) p.restaurantLng = rLng
        if (companyRuc !== b.companyRuc) p.companyRuc = companyRuc
        if (companyLegalName !== b.companyLegalName) p.companyLegalName = companyLegalName
        if (companyFiscalAddress !== b.companyFiscalAddress) p.companyFiscalAddress = companyFiscalAddress
        const igvN = parseFloat(igvRate)
        if (!isNaN(igvN) && igvRate !== b.igvRate) p.igvRate = igvN
        if (boletaSeries !== b.boletaSeries) p.boletaSeries = boletaSeries
        if (facturaSeries !== b.facturaSeries) p.facturaSeries = facturaSeries
        if (boletaEnabled !== b.boletaEnabled) p.boletaEnabled = boletaEnabled
        if (facturaEnabled !== b.facturaEnabled) p.facturaEnabled = facturaEnabled

        // ── Dashboard preferences ──────────────────────────────────
        const kitchenN = Number.parseInt(dashKitchenAlertMin, 10)
        if (Number.isFinite(kitchenN) && kitchenN !== b.dashboardKitchenAlertMinutes) p.dashboardKitchenAlertMinutes = kitchenN
        const pickupAlertN = Number.parseInt(dashPickupAlertMin, 10)
        if (Number.isFinite(pickupAlertN) && pickupAlertN !== b.dashboardPickupAlertMinutes) p.dashboardPickupAlertMinutes = pickupAlertN
        const lowStockN = Number.parseInt(dashLowStockThreshold, 10)
        if (Number.isFinite(lowStockN) && lowStockN !== b.dashboardLowStockThreshold) p.dashboardLowStockThreshold = lowStockN
        const etaToleranceN = Number.parseInt(dashEtaToleranceMin, 10)
        if (Number.isFinite(etaToleranceN) && etaToleranceN !== b.dashboardEtaToleranceMinutes) p.dashboardEtaToleranceMinutes = etaToleranceN
        if (dashDefaultPreset !== b.dashboardDefaultPreset) p.dashboardDefaultPreset = dashDefaultPreset

        return p
    }, [
        baseline,
        advEnabled,
        advValue,
        advUnit,
        imgLimit,
        reviewPhotoLimit,
        defaultCurrency,
        galleryInterval,
        reviewsEnabled,
        chatMode,
        sageShareIngredients,
        sageMenuPageSize,
        sageMenuDefaultCount,
        sageShowTechnicalDetails,
        aiProvider,
        aiBaseUrl,
        aiModel,
        aiSummaryModel,
        aiTemperature,
        aiMaxTokens,
        maxPartySize,
        largeGroupWarningFrom,
        maxResPerSlot,
        timeSlotIncrement,
        resDurEnabled,
        resDurValue,
        resDurUnit,
        maxDaysAhead,
        operatingDays,
        openingTime,
        closingTime,
        closedRanges,
        contactPhone,
        contactPhoneHoursNoteEn,
        contactPhoneHoursNoteEs,
        contactAddress,
        socialLinks,
        publicContactEmail,
        chatBubblePosition,
        dateFormat,
        timeFormat,
        adminEmailNotificationsEnabled,
        notifEmail,
        walletEnabled, walletAllowDualCurrency, initialBalancePEN, initialBalanceUSD, pickupEnabled, deliveryEnabled,
        pickupLeadTimeMinutes, orderNumberPrefix,
        restaurantLat, restaurantLng,
        companyRuc, companyLegalName, companyFiscalAddress,
        igvRate, boletaSeries, facturaSeries, boletaEnabled, facturaEnabled,
        dashKitchenAlertMin, dashPickupAlertMin, dashLowStockThreshold, dashEtaToleranceMin, dashDefaultPreset,
    ])

    const dirtyFieldCount = Object.keys(dirtyPatch).length
    const hasUnsavedChanges = dirtyFieldCount > 0

    // The keys a mode with Sage needs and the storefront reports missing, for
    // the provider chosen in this form. Empty while the status is unknown: the
    // save checks again on the server either way.
    const sageMissingKeys = useMemo(() => {
        if (!chatStatus) return []
        const missing: string[] = []
        if (!chatStatus.writerKeys[aiProvider]) missing.push(AI_PROVIDER_ENV_VARS[aiProvider])
        if (!chatStatus.decisionKeys.openrouter && !missing.includes(OPENROUTER_API_KEY_ENV)) missing.push(OPENROUTER_API_KEY_ENV)
        return missing
    }, [chatStatus, aiProvider])

    const breaksFitOpeningHours = useMemo(
        () =>
            closedRangesFullyInsideOpeningHours(
                openingTime,
                closingTime,
                normalizeClosedTimeRangesForStorage(closedRanges),
            ),
        [openingTime, closingTime, closedRanges],
    )

    function addClosedRangeRow() {
        if (!isOwner || bulkSaving) return
        setClosedRanges((prev) => (prev.length >= 20 ? prev : [...prev, { start: "", end: "" }]))
    }

    function removeClosedRangeRow(index: number) {
        if (!isOwner || bulkSaving) return
        setClosedRanges((prev) => prev.filter((_, i) => i !== index))
    }

    function updateClosedRangeRow(index: number, field: "start" | "end", value: string) {
        if (!isOwner || bulkSaving) return
        setClosedRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
    }

    function handleDiscardChanges() {
        if (!baseline || bulkSaving) return
        clearFieldErrors()
        applyBaseline(baseline)
    }

    async function handleSaveAll() {
        if (!isOwner || !baseline || bulkSaving) return
        clearFieldErrors()
        const patch = { ...dirtyPatch }
        if (Object.keys(patch).length === 0) return

        if (operatingDays.length === 0) {
            setOpDaysError("Select at least one operating day.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        if (!pickupEnabled && !deliveryEnabled) {
            setFulfillmentError("Turn on Pickup or Delivery. Customers need at least one way to receive an order.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        const maxParsed = Number.parseInt(maxPartySize, 10)
        if (!Number.isFinite(maxParsed)) {
            setMaxPartySizeError("Enter a valid number.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        if (!Number.isFinite(Number.parseInt(maxResPerSlot, 10))) {
            setMaxResPerSlotError("Enter a valid number.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        if (aiModel.trim() === "") {
            setAiError("Enter the model ID Sage should use.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        if (aiProvider === "custom" && !isValidCustomBaseUrl(aiBaseUrl.trim())) {
            setAiError("A custom provider needs an https base URL (http is allowed only for localhost).")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        if (notifEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifEmail.trim())) {
            setNotifEmailError("Enter a valid email address or leave blank.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        if (publicContactEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicContactEmail.trim())) {
            setPublicContactEmailError("Enter a valid email address or leave blank.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        for (const platform of SOCIAL_PLATFORMS) {
            const raw = (socialLinks.links[platform.id]?.value ?? "").trim()
            if (raw !== "" && normalizeSocialValue(platform.id, raw) === "") {
                setSocialLinksError(`"${raw}" is not a usable ${platform.label} handle. ${platform.hint}`)
                setBulkBarError("Fix validation errors before saving.")
                return
            }
        }

        if ((socialLinks.links.whatsapp?.username ?? "").trim() !== "" && (socialLinks.links.whatsapp?.value ?? "").trim() === "") {
            setSocialLinksError("A WhatsApp username needs the number too — the number is what the link opens.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        const mdSave = Number.parseInt(maxDaysAhead, 10)
        if (!Number.isFinite(mdSave) || mdSave < 1 || mdSave > 365) {
            setMaxDaysError("Enter a whole number between 1 and 365.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        for (const r of closedRanges) {
            const s = (r.start ?? "").trim()
            const e = (r.end ?? "").trim()
            if (s === "" && e === "") {
                setClosedRangesError("Remove empty break rows or set both From and To times.")
                setBulkBarError("Fix validation errors before saving.")
                return
            }
            if (s === "" || e === "") {
                setClosedRangesError("Each break needs both From and To times, or remove the row.")
                setBulkBarError("Fix validation errors before saving.")
                return
            }
        }

        const normClosed = normalizeClosedTimeRangesForStorage(closedRanges)
        if (!closedRangesFullyInsideOpeningHours(openingTime, closingTime, normClosed)) {
            setClosedRangesError("Every break must fall fully inside opening hours.")
            setBulkBarError("Fix validation errors before saving.")
            return
        }

        setBulkSaving(true)
        setBulkBarError("")
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            })
            const data = await res.json()
            if (!res.ok) {
                if (res.status === 403) setIsOwner(false)
                const msg = data.error || "Failed to save settings."
                setBulkBarError(msg)
                return
            }
            const next = baselineFromApi(data.data as Record<string, unknown>)
            setBaseline(next)
            applyBaseline(next)
            window.dispatchEvent(new CustomEvent("wg:admin-settings-updated"))
            setBulkBarSuccess(true)
            setTimeout(() => setBulkBarSuccess(false), 2200)
        } catch {
            setBulkBarError("Failed to save settings.")
        } finally {
            setBulkSaving(false)
        }
    }

    /** Raw while typing, so a pasted profile URL survives until it is normalized. */
    function setSocialField(id: SocialPlatformId, field: "value" | "label" | "username", next: string) {
        setSocialLinks((prev) => ({
            ...prev,
            links: { ...prev.links, [id]: { ...(prev.links[id] ?? { value: "" }), [field]: next } },
        }))
    }

    /** On blur the field shows exactly what will be stored. */
    function normalizeSocialField(id: SocialPlatformId, field: "value" | "label" | "username") {
        setSocialLinks((prev) => {
            const entry = prev.links[id] ?? { value: "" }
            const raw = entry[field] ?? ""
            const next =
                field === "label"
                    ? normalizeSocialLabel(raw)
                    : field === "username"
                      ? normalizeSocialValue(WHATSAPP_USERNAME_KEY, raw)
                      : normalizeSocialValue(id, raw)
            return { ...prev, links: { ...prev.links, [id]: { ...entry, [field]: next } } }
        })
    }

    function toggleDay(day: number) {
        if (!isOwner || bulkSaving) return
        setOperatingDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
        )
    }

    if (fetchStatus === "loading") {
        return (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Settings</h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">App configuration and feature flags.</p>
                </div>
                <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-6">
                    <LoadingState size="section" message="Loading settings…" />
                </div>
            </div>
        )
    }

    const showFloatingBar = hasUnsavedChanges || bulkSaving || Boolean(bulkBarError) || bulkBarSuccess

    return (
        <div
            className={`space-y-6 animate-fade-in ${
                hasUnsavedChanges || bulkSaving || Boolean(bulkBarError) || bulkBarSuccess ? "pb-32" : ""
            }`}
        >
            {/* Page header */}
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Settings</h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">App configuration and feature flags.</p>
            </div>

            {/* Load error — shown on every tab, not just one card */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                    <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                    <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-2">
                <div className="flex flex-wrap gap-2">
                    {SETTINGS_SECTION_TABS.map((tab) => {
                        const active = activeSection === tab.key
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveSection(tab.key)}
                                className={`h-9 px-4 text-sm font-medium rounded-brand border transition-colors focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 ${
                                    active
                                        ? "bg-wg-accent text-white border-wg-accent dark:border-wg-dark-accent"
                                        : "bg-wg-bg dark:bg-wg-dark-raised text-wg-muted dark:text-wg-dark-muted border-wg-border/50 dark:border-wg-dark-border hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50"
                                }`}
                            >
                                {tab.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {activeSection === "security" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Security & Verification</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">How accounts are verified and kept safe.</p>
            </div>

            {/* Nothing configurable lives here yet */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                        There are no configurable security controls at the moment. Account verification runs on
                        email only, and its limits (code lifetime, failed-attempt cap, rate limits) are set in
                        code rather than here.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "reservations" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Reservations</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Booking rules and customer reservation constraints.</p>
            </div>

            {/* Advance Reservation Notice Card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Advance Reservation Notice"
                        description="Minimum notice required before a reservation can be made. Bookings with less than this amount of lead time will be rejected."
                    />

                    {/* Toggle row */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-brand flex items-center justify-center ${
                                advEnabled
                                    ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent"
                                    : "bg-wg-border/30 dark:bg-wg-dark-border/30 text-wg-muted dark:text-wg-dark-muted"
                            }`}>
                                <ClockRightAngleIcon className="w-4.5 h-4.5" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                    {advEnabled ? "Advance notice is enabled" : "Advance notice is disabled"}
                                </p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                    {advEnabled
                                        ? "Reservations require a minimum lead time before they can be made."
                                        : "Reservations can be made at any time without a lead time requirement."
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <Switch
                            checked={advEnabled}
                            onChange={(next) => setAdvEnabled(next)}
                            label="Advance reservation notice"
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>

                    {/* Picker row — only shown when enabled */}
                    {advEnabled && (
                        <div className="mt-3 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">
                                Minimum advance notice
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Number input */}
                                <AdminNumberInput
                                    value={advValue}
                                    onChange={setAdvValue}
                                    min={1}
                                    max={10000}
                                    nullable={false}
                                    disabled={bulkSaving || !isOwner}
                                    className="w-32"
                                />

                                {/* Unit selector */}
                                <AdminSelect
                                    value={advUnit}
                                    required
                                    onChange={(v) => setAdvUnit(v as AdvanceUnit)}
                                    options={UNIT_OPTIONS}
                                    disabled={bulkSaving || !isOwner}
                                    className="w-36"
                                />
                            </div>
                        </div>
                    )}

                    {/* Advance — error / success */}
                    {advError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{advError}</p>
                        </div>
                    )}

                </div>

                {/* Footer note */}
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Applies to both the website booking form and the chat assistant.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "catalog" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Catalog & Menu</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Product gallery behavior and media configuration.</p>
            </div>
            {/* Product Gallery Limit Card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Product Gallery"
                        description="Maximum number of additional gallery photos allowed per menu item (not counting the main photo)."
                    />

                    {/* Picker row */}
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">
                            Max gallery images per product
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminNumberInput
                                value={imgLimit}
                                onChange={setImgLimit}
                                min={1}
                                max={20}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-32"
                            />
                        </div>
                    </div>

                    {/* Auto-play interval picker */}
                    <div className="mt-3 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">
                            Auto-play interval
                        </p>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3">
                            Seconds between automatic slide changes. Set to <strong>0</strong> to disable auto-play.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminNumberInput
                                value={galleryInterval}
                                onChange={setGalleryInterval}
                                min={0}
                                max={60}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-32"
                            />
                            <span className="text-sm text-wg-muted dark:text-wg-dark-muted">seconds</span>
                        </div>
                    </div>

                    {/* Gallery interval error / success */}
                    {galleryIntervalError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{galleryIntervalError}</p>
                        </div>
                    )}
                    {/* Error / success */}
                    {imgLimitError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{imgLimitError}</p>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Image limit range 1–20. Auto-play range 0–60 s (0 = off). Arrow buttons and swipe are shown automatically when a product has 2+ images.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "reviews" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Reviews</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Manage customer feedback and review photo limits.</p>
            </div>

            {/* Review Photos Card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Review Photos"
                        description="Maximum number of photos a customer can attach to a review. Set to 0 to disable photo uploads."
                    />

                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">
                            Max photos per review
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminNumberInput
                                value={reviewPhotoLimit}
                                onChange={setReviewPhotoLimit}
                                min={0}
                                max={10}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-32"
                            />
                        </div>
                    </div>

                    {reviewPhotoError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{reviewPhotoError}</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Range 0–10. Photos upload to InsForge &ldquo;review-photos&rdquo; storage bucket.
                    </p>
                </div>
            </div>

            {/* Customer Reviews Card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Customer Reviews"
                        description="Controls whether customers can submit reviews after a completed reservation. When disabled, the rating button will not appear on completed reservations."
                    />

                    {/* Toggle row */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-brand flex items-center justify-center ${
                                reviewsEnabled
                                    ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent"
                                    : "bg-wg-border/30 dark:bg-wg-dark-border/30 text-wg-muted dark:text-wg-dark-muted"
                            }`}>
                                <StarOutlineIcon className="w-4.5 h-4.5" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                    {reviewsEnabled ? "Customer reviews are enabled" : "Customer reviews are disabled"}
                                </p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                    {reviewsEnabled
                                        ? "Customers can rate and comment on their experience after a completed reservation."
                                        : "The rating button is hidden on completed reservations. No new reviews can be submitted."
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <Switch
                            checked={reviewsEnabled}
                            onChange={(next) => setReviewsEnabled(next)}
                            label="Customer reviews"
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>

                    {/* Warning when disabled */}
                    {!reviewsEnabled && (
                        <div className="mt-4 flex items-start gap-2.5 p-3 rounded-brand border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10">
                            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" strokeWidth={2} />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                Reviews are disabled. Completed reservations will show as completed without a rating option. Existing reviews are preserved and will remain visible once reviews are re-enabled.
                            </p>
                        </div>
                    )}

                    {/* Status messages */}
                    {reviewsError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{reviewsError}</p>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Disabling reviews hides the rating button from customers. Existing reviews are not deleted.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "chatbot" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Chatbot</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Visibility and behavior of the public chat assistant.</p>
            </div>

            {/* Chat mode card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Chat mode"
                        description="Who answers the chat on the public pages. The team can join any conversation from the Chat page in every mode."
                    />

                    <div className="space-y-2" role="radiogroup" aria-label="Chat mode">
                        {CHAT_MODES.map((mode) => {
                            const option = CHAT_MODE_OPTIONS[mode]
                            const needsKeys = chatModeUsesSage(mode)
                            const blocked = needsKeys && sageMissingKeys.length > 0
                            const selected = chatMode === mode
                            return (
                                <label
                                    key={mode}
                                    className={`flex items-start gap-3 p-3 rounded-brand border transition-colors ${
                                        selected
                                            ? "border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/10"
                                            : "border-wg-border/50 dark:border-wg-dark-border hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                                    } ${blocked || !isOwner ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                                >
                                    <input
                                        type="radio"
                                        name="chat-mode"
                                        value={mode}
                                        checked={selected}
                                        disabled={bulkSaving || !isOwner || blocked}
                                        onChange={() => setChatMode(mode)}
                                        className="wg-radio wg-control-accent mt-0.5 w-4 h-4"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{option.label}</div>
                                        <div className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">{option.description}</div>
                                        {needsKeys && (
                                            <div className={`text-[11px] mt-1 ${blocked ? "text-red-700 dark:text-red-300" : "text-wg-muted dark:text-wg-dark-muted"}`}>
                                                {blocked ? (
                                                    <>Missing on the storefront: {sageMissingKeys.map((name, i) => (
                                                        <span key={name}>{i > 0 && ", "}<code className="font-mono">{name}</code></span>
                                                    ))}</>
                                                ) : aiProvider === "openai" ? (
                                                    <>Needs <code className="font-mono">{AI_PROVIDER_ENV_VARS.openai}</code> and <code className="font-mono">{OPENROUTER_API_KEY_ENV}</code> on the storefront.</>
                                                ) : (
                                                    // OpenRouter's key serves both models; a custom endpoint may need no key.
                                                    <>Needs <code className="font-mono">{OPENROUTER_API_KEY_ENV}</code> on the storefront.</>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            )
                        })}
                    </div>

                    {chatStatusState === "unreachable" && (
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                            Could not check the storefront&apos;s keys: it did not answer. A mode with Sage is checked again when you save.
                        </p>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        A conversation follows the new mode from its next message. Conversations already with a person stay with the team in every mode except Off.
                    </p>
                </div>
            </div>

            {/* Dishes per message */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Sage: dishes per message"
                        description="How many dish cards Sage shows when the guest does not name a number, and the most one message may hold. A named number, such as show me 3, shows that many, up to the maximum. See N more brings another page of the usual amount."
                    />
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Dishes Sage shows on its own</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">When the guest does not name a number.</p>
                            </div>
                            <AdminNumberInput
                                value={sageMenuDefaultCount}
                                onChange={setSageMenuDefaultCount}
                                min={SAGE_MENU_PAGE_SIZE_RANGE.min}
                                max={Math.min(
                                    SAGE_MENU_PAGE_SIZE_RANGE.max,
                                    Number.parseInt(sageMenuPageSize, 10) || SAGE_MENU_PAGE_SIZE_RANGE.max,
                                )}
                                step={1}
                                decimals={0}
                                nullable={false}
                                suffix="dishes"
                                disabled={bulkSaving || !isOwner}
                                className="w-40"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Most dishes in one message</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">A request for more than this still stops here.</p>
                            </div>
                            <AdminNumberInput
                                value={sageMenuPageSize}
                                onChange={setSageMenuPageSize}
                                min={SAGE_MENU_PAGE_SIZE_RANGE.min} max={SAGE_MENU_PAGE_SIZE_RANGE.max} step={1} decimals={0}
                                nullable={false}
                                suffix="dishes"
                                disabled={bulkSaving || !isOwner}
                                className="w-40"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Sage: ingredient lists in chat"
                        description="When enabled, Sage can read the CMS ingredient lists on menu items and answer questions about what a dish contains or how it is prepared. When disabled, those lists are not exposed to the model and Sage will direct guests to staff or Contact instead."
                    />

                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-brand flex items-center justify-center ${
                                sageShareIngredients
                                    ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent"
                                    : "bg-wg-border/30 dark:bg-wg-dark-border/30 text-wg-muted dark:text-wg-dark-muted"
                            }`}>
                                <DocumentLinesIcon className="w-4.5 h-4.5" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                    {sageShareIngredients ? "Ingredient details in chat: on" : "Ingredient details in chat: off"}
                                </p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                    {sageShareIngredients
                                        ? "Sage uses the per-item ingredient lists from the Menu CMS (English and Spanish fields)."
                                        : "Sage will not quote CMS ingredient arrays; guests can still browse the menu and tags."
                                    }
                                </p>
                            </div>
                        </div>

                        <Switch
                            checked={sageShareIngredients}
                            onChange={(next) => setSageShareIngredients(next)}
                            label="Ingredient details in chat"
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                </div>

                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Ingredient lists are edited per menu item in the Catalog. This toggle only controls whether Sage may repeat them in the public chat widget.
                    </p>
                </div>
            </div>

            {/* Technical details in the panel chat */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Sage: technical details in chat"
                        description="Shows, under each Sage reply on the Chat page, what the decision model answered and which steps the reply took. For everyone in the panel. Customers never see it."
                    />
                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                {sageShowTechnicalDetails ? "Technical details: shown" : "Technical details: hidden"}
                            </p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                One line per reply, with the full answer a click away.
                            </p>
                        </div>
                        <Switch
                            checked={sageShowTechnicalDetails}
                            onChange={(next) => setSageShowTechnicalDetails(next)}
                            label="Show technical details in chat"
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                </div>
            </div>

            {/* Keys and decision model — read-only, as the storefront reports them */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">Sage: keys and decision model</h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                                Before Sage answers, a decision model reads each message and picks what to do. The keys live in the storefront&apos;s environment; the panel only learns whether each one is set.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={loadChatStatus}
                            disabled={chatStatusState === "loading"}
                            className="shrink-0 text-xs px-3 py-1.5 rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised disabled:opacity-50 transition-colors"
                        >
                            {chatStatusState === "loading" ? "Checking…" : "Check again"}
                        </button>
                    </div>

                    {chatStatusState === "unreachable" ? (
                        <p className="text-sm text-amber-700 dark:text-amber-300">Could not check: the storefront did not answer.</p>
                    ) : chatStatus ? (
                        <div className="divide-y divide-wg-border/40 dark:divide-wg-dark-border/60">
                            <KeyStatusRow
                                label="Writer key, for the provider saved below"
                                envVar={AI_PROVIDER_ENV_VARS[(baseline?.aiProvider ?? aiProvider) as AiProvider] ?? AI_PROVIDER_ENV_VARS[aiProvider]}
                                set={chatStatus.writerKey}
                                optional={(baseline?.aiProvider ?? aiProvider) === "custom"}
                            />
                            <KeyStatusRow label="Decision model key" envVar={OPENROUTER_API_KEY_ENV} set={chatStatus.decisionKeys.openrouter} />
                            <KeyStatusRow label="Decision model fallback key (optional)" envVar={TYPESAFE_API_KEY_ENV} set={chatStatus.decisionKeys.typesafe} />
                            <div className="flex items-center justify-between gap-4 py-2">
                                <p className="text-sm text-wg-text dark:text-wg-dark-text">Decision model</p>
                                <code className="text-xs font-mono text-wg-muted dark:text-wg-dark-muted">{sageDecisionModel || "—"}</code>
                            </div>
                            <div className="flex items-center justify-between gap-4 py-2">
                                <p className="text-sm text-wg-text dark:text-wg-dark-text">Last answer</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-right">
                                    {chatStatus.lastDecision
                                        ? `${formatStatusTime(chatStatus.lastDecision.at)} · ${DECISION_VIA_LABELS[chatStatus.lastDecision.via] ?? chatStatus.lastDecision.via}`
                                        : "None yet"}
                                </p>
                            </div>
                            <div className="flex items-center justify-between gap-4 py-2">
                                <p className="text-sm text-wg-text dark:text-wg-dark-text">Last failure</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-right">
                                    {chatStatus.lastFailure
                                        ? `${formatStatusTime(chatStatus.lastFailure.at)} · ${chatStatus.lastFailure.reason}`
                                        : "None"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">Checking…</p>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        The decision model is called through OpenRouter, and through TypeSafe when the first key fails or takes more than 2 seconds. If both fail, Sage apologizes in one sentence instead of answering.
                    </p>
                </div>
            </div>

            {/* AI provider card — the model Sage runs on */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6 space-y-5">
                    <OwnerSettingCardHeader
                        title="Sage: model provider"
                        description="Which API Sage sends conversations to. Any OpenAI-compatible provider works. The API key is not stored here: it is read from the storefront's server environment."
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Provider</p>
                            <AdminSelect
                                value={aiProvider}
                                required
                                onChange={(next) => setAiProvider(next as AiProvider)}
                                options={AI_PROVIDER_OPTIONS}
                                disabled={bulkSaving || !isOwner}
                            />
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-2">
                                Key read from <code className="font-mono">{AI_PROVIDER_ENV_VARS[aiProvider]}</code> on the storefront.
                            </p>
                        </div>
                        {aiProvider === "custom" && (
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Base URL</p>
                                <input type="url" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} placeholder="https://my-gateway.example/v1" disabled={bulkSaving || !isOwner}
                                    className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-2">
                                    Must speak the OpenAI chat-completions API. Plain http only for localhost.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Model</p>
                            <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder={aiProvider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini"} disabled={bulkSaving || !isOwner}
                                className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-2">
                                Must support tool calling. Sage answers from six tools, and a model without them invents menus and availability instead.
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Title model (optional)</p>
                            <input type="text" value={aiSummaryModel} onChange={(e) => setAiSummaryModel(e.target.value)} placeholder="Same as the model above" disabled={bulkSaving || !isOwner}
                                className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-2">
                                Names each conversation in the chat list. A cheaper model is enough for eight words.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Temperature</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Lower is more literal, higher is more talkative.</p>
                            <AdminNumberInput
                                value={aiTemperature}
                                onChange={setAiTemperature}
                                min={AI_TEMPERATURE_RANGE.min} max={AI_TEMPERATURE_RANGE.max} step={0.1} decimals={2}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-36"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Max tokens per reply</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Caps the length of a single answer.</p>
                            <AdminNumberInput
                                value={aiMaxTokens}
                                onChange={setAiMaxTokens}
                                min={AI_MAX_TOKENS_RANGE.min} max={AI_MAX_TOKENS_RANGE.max} step={50} decimals={0}
                                nullable={false}
                                suffix="tokens"
                                disabled={bulkSaving || !isOwner}
                                className="w-44"
                            />
                        </div>
                    </div>

                    {aiError && (
                        <div className="flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{aiError}</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        A change applies to the next message a guest sends. If the key for the selected provider is missing on the storefront, Sage replies with its contact-us fallback and the reason is logged there.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "reservations" && (
                <>
            {/* ── Max Party Size ──────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Max Party Size"
                        description="Maximum number of guests allowed per reservation. Bookings that exceed this limit will be automatically rejected."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Maximum guests per booking</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminNumberInput
                                value={maxPartySize}
                                onChange={(value) => {
                                    setMaxPartySize(value)
                                    const parsedValue = Number.parseInt(value, 10)
                                    if (!Number.isFinite(parsedValue)) return
                                    const nextMaxPartySize = clampNumber(parsedValue, 1, 50)
                                    setLargeGroupWarningFrom((previous) => {
                                        const parsedPrevious = Number.parseInt(previous, 10)
                                        const safePrevious = Number.isFinite(parsedPrevious) ? parsedPrevious : nextMaxPartySize
                                        return String(clampNumber(safePrevious, 1, nextMaxPartySize))
                                    })
                                    setLargeGroupWarningError("")
                                }}
                                min={1}
                                max={50}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-32"
                            />
                            <span className="text-sm text-wg-muted dark:text-wg-dark-muted">guests</span>
                        </div>
                    </div>
                    {maxPartySizeError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{maxPartySizeError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Range 1–50. Applies to both the booking form and the chat assistant.</p>
                </div>
            </div>

            {/* ── Reservations per Time Slot ──────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Reservations per Time Slot"
                        description="How many reservations may overlap at the same time. Once a slot reaches this number the booking form, Sage and the API all report it as fully booked."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Concurrent reservations allowed</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminNumberInput
                                value={maxResPerSlot}
                                onChange={(value) => {
                                    setMaxResPerSlot(value)
                                    setMaxResPerSlotError("")
                                }}
                                min={MAX_RESERVATIONS_PER_SLOT_RANGE.min}
                                max={MAX_RESERVATIONS_PER_SLOT_RANGE.max}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-32"
                            />
                            <span className="text-sm text-wg-muted dark:text-wg-dark-muted">reservations</span>
                        </div>
                    </div>
                    {maxResPerSlotError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{maxResPerSlotError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Range {MAX_RESERVATIONS_PER_SLOT_RANGE.min}&ndash;{MAX_RESERVATIONS_PER_SLOT_RANGE.max}. A reservation counts against every slot it overlaps, for as long as
                        &ldquo;Reservation Duration&rdquo; says a table stays occupied &mdash; or one time-slot increment while that setting is off.
                    </p>
                </div>
            </div>

            {/* ── Large Group Warning Threshold ───────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Large Group Warning"
                        description="Defines from how many guests the reservation form shows a recommendation message for large groups."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Show warning from</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminNumberInput
                                value={largeGroupWarningFrom}
                                onChange={(value) => {
                                    const parsedValue = Number.parseInt(value, 10)
                                    if (!Number.isFinite(parsedValue)) {
                                        setLargeGroupWarningFrom(String(effectiveMaxPartySize))
                                        setLargeGroupWarningError("")
                                        return
                                    }
                                    setLargeGroupWarningFrom(String(clampNumber(parsedValue, 1, effectiveMaxPartySize)))
                                    setLargeGroupWarningError("")
                                }}
                                min={1}
                                max={effectiveMaxPartySize}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-32"
                            />
                            <span className="text-sm text-wg-muted dark:text-wg-dark-muted">guests</span>
                        </div>
                    </div>
                    {largeGroupWarningError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{largeGroupWarningError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Range 1–50. The note appears when selected guests are equal or above this value.</p>
                </div>
            </div>

            {/* ── Time Slot Increment ─────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Time Slot Increment"
                        description="Granularity of the available booking times shown to customers. For example, with 30 minutes: 12:00, 12:30, 13:00…"
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Booking time granularity</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminSelect value={timeSlotIncrement} required onChange={(v) => setTimeSlotIncrement(v)} options={TIME_SLOT_OPTIONS} disabled={bulkSaving || !isOwner} className="w-40" />
                        </div>
                    </div>
                    {timeSlotError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{timeSlotError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Options: 15 min, 30 min, 1 hour.</p>
                </div>
            </div>

            {/* ── Reservation Duration ────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Reservation Duration"
                        description="How long each reservation occupies a slot. Used to prevent overlapping bookings at the same time."
                    />
                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-brand flex items-center justify-center ${resDurEnabled ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent" : "bg-wg-border/30 dark:bg-wg-dark-border/30 text-wg-muted dark:text-wg-dark-muted"}`}>
                                <ClockRightAngleIcon className="w-4.5 h-4.5" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{resDurEnabled ? "Custom duration is enabled" : "Custom duration is disabled"}</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">{resDurEnabled ? "Each reservation occupies the configured time slot." : "No fixed duration is enforced per reservation."}</p>
                            </div>
                        </div>
                        <Switch
                            checked={resDurEnabled}
                            onChange={(next) => setResDurEnabled(next)}
                            label="Custom reservation duration"
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                    {resDurEnabled && (
                        <div className="mt-3 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Duration per reservation</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <AdminNumberInput value={resDurValue} onChange={setResDurValue} min={1} max={10000} nullable={false} disabled={bulkSaving || !isOwner} className="w-32" />
                                <AdminSelect value={resDurUnit} required onChange={(v) => setResDurUnit(v as AdvanceUnit)} options={UNIT_OPTIONS} disabled={bulkSaving || !isOwner} className="w-36" />
                            </div>
                        </div>
                    )}
                    {resDurError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{resDurError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">When disabled, no fixed duration is applied per booking.</p>
                </div>
            </div>

            {/* ── Max Days Ahead ──────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Max Days Ahead"
                        description="How far in advance customers can book a reservation. Dates beyond this window will be unavailable in the booking form."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Maximum booking window</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <AdminNumberInput
                                value={maxDaysAhead}
                                onChange={setMaxDaysAhead}
                                min={1}
                                max={365}
                                nullable={false}
                                disabled={bulkSaving || !isOwner}
                                className="w-full max-w-[11rem] shrink-0"
                            />
                            <span className="text-sm text-wg-muted dark:text-wg-dark-muted shrink-0 leading-snug">
                                full Lima calendar days after today (last day = today + N; e.g. 1 → through tomorrow)
                            </span>
                        </div>
                    </div>
                    {maxDaysError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{maxDaysError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Range 1–365. Dates use America/Lima (no DST).</p>
                </div>
            </div>

            {/* ── Operating Days ──────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Operating Days"
                        description="Days of the week when reservations are accepted. The booking form will block disabled days automatically."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Select open days</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {DAY_LABELS.map((label, i) => {
                                const day = i + 1
                                const active = operatingDays.includes(day)
                                return (
                                    <button key={day} type="button" disabled={!isOwner || bulkSaving} onClick={() => toggleDay(day)}
                                        className={`h-9 w-14 text-sm font-medium rounded-brand border transition-colors focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed ${active ? "bg-wg-accent text-white border-wg-accent dark:border-wg-dark-accent" : "bg-wg-bg dark:bg-wg-dark-raised border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50"}`}>
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    {opDaysError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{opDaysError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">At least one day must remain active.</p>
                </div>
            </div>

            {/* ── Opening & Closing Hours ─────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Opening Hours"
                        description="Time range during which reservations are accepted. Slots outside this window will be unavailable in the booking form."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex items-end gap-4 flex-wrap">
                            <div className="min-w-[10rem]">
                                <label className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">Opening time</label>
                                <AdminTimePicker
                                    value={openingTime}
                                    onChange={setOpeningTime}
                                    slotOptions={mergeValidTimeSlots(openingHoursSlotOptions, [openingTime, closingTime])}
                                    disabled={bulkSaving || !isOwner}
                                    placeholder="Select…"
                                />
                            </div>
                            <div className="min-w-[10rem]">
                                <label className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">Closing time</label>
                                <AdminTimePicker
                                    value={closingTime}
                                    onChange={setClosingTime}
                                    slotOptions={mergeValidTimeSlots(openingHoursSlotOptions, [openingTime, closingTime])}
                                    disabled={bulkSaving || !isOwner}
                                    placeholder="Select…"
                                />
                            </div>
                        </div>
                    </div>
                    {hoursError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{hoursError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Uses 24-hour format internally.</p>
                </div>
            </div>

            {/* ── Break times (no bookings) ───────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Break times"
                        description="Blocks inside your opening hours when you do not accept reservations (for example a team break from 16:00 to 17:00). These times are hidden from the booking form and chat like outside opening hours."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised space-y-3">
                        {closedRanges.length === 0 ? (
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted">No breaks configured.</p>
                        ) : (
                            <ul className="space-y-3">
                                {closedRanges.map((range, index) => (
                                    <li key={index} className="flex flex-wrap items-end gap-3">
                                        <div className="min-w-[10rem]">
                                            <label className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">From</label>
                                            <AdminTimePicker
                                                value={range.start}
                                                onChange={(t) => updateClosedRangeRow(index, "start", t)}
                                                slotOptions={mergeValidTimeSlots(breakSlotOptionsBase, [range.start, range.end])}
                                                disabled={bulkSaving || !isOwner}
                                                placeholder="Select…"
                                            />
                                        </div>
                                        <div className="min-w-[10rem]">
                                            <label className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">To</label>
                                            <AdminTimePicker
                                                value={range.end}
                                                onChange={(t) => updateClosedRangeRow(index, "end", t)}
                                                slotOptions={mergeValidTimeSlots(breakSlotOptionsBase, [range.start, range.end])}
                                                disabled={bulkSaving || !isOwner}
                                                placeholder="Select…"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={bulkSaving || !isOwner}
                                            onClick={() => removeClosedRangeRow(index)}
                                            className="h-9 px-3 text-xs font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800/50 transition disabled:opacity-50 disabled:cursor-not-allowed mb-px"
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button
                            type="button"
                            disabled={bulkSaving || !isOwner || closedRanges.length >= 20}
                            onClick={addClosedRangeRow}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-surface/80 dark:hover:bg-wg-dark-surface/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-4 h-4" strokeWidth={2} />
                            Add break
                        </button>
                        {!breaksFitOpeningHours && (
                            <p className="text-xs text-amber-700 dark:text-amber-300/90">
                                Adjust breaks so each interval lies fully between opening and closing time, with start before end.
                            </p>
                        )}
                    </div>
                    {closedRangesError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{closedRangesError}</p>
                        </div>
                    )}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Up to 20 breaks, 24-hour times. Saved ranges must fit inside opening hours.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "contact" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Contact & Brand</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Business contact details shown across customer touchpoints.</p>
            </div>

            {/* ── Contact Phone ───────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Contact Phone"
                        description="Public phone number displayed on reservation confirmations and public-facing pages."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Phone number</p>
                        <PhoneInput
                            value={contactPhone}
                            onChange={setContactPhone}
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                    {contactPhoneError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{contactPhoneError}</p></div>}
                    <div className="mt-6 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised space-y-4">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Phone attendance hours (English)</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">
                                Second line under the phone number on the Contact page when the site is in English (e.g. Mon–Fri 9–6).
                            </p>
                            <div className="max-w-xl">
                                <Textarea
                                    value={contactPhoneHoursNoteEn}
                                    onChange={(v) => setContactPhoneHoursNoteEn(v.slice(0, 500))}
                                    minRows={2}
                                    maxHeight={180}
                                    maxLength={500}
                                    disabled={bulkSaving || !isOwner}
                                    placeholder="Mon–Sun, 9:00 a.m. – 10:00 p.m."
                                    aria-label="Phone attendance hours (English)"
                                    className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Phone attendance hours (Spanish)</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">
                                Same for Spanish locale (e.g. Lun–Dom, 9:00 – 22:00).
                            </p>
                            <div className="max-w-xl">
                                <Textarea
                                    value={contactPhoneHoursNoteEs}
                                    onChange={(v) => setContactPhoneHoursNoteEs(v.slice(0, 500))}
                                    minRows={2}
                                    maxHeight={180}
                                    maxLength={500}
                                    disabled={bulkSaving || !isOwner}
                                    placeholder="Lun–Dom, 9:00 – 22:00"
                                    aria-label="Phone attendance hours (Spanish)"
                                    className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Leave both empty to show only the phone number. Max 500 characters each.</p>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Leave phone blank to hide from public pages.</p>
                </div>
            </div>

            {/* ── Public contact email ───────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Public contact email"
                        description="Address shown on the Contact page, reservation sidebar, and Sage. Leave blank to hide the public email on the site (this does not configure SMTP delivery)."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Email</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="email"
                                value={publicContactEmail}
                                onChange={(e) => setPublicContactEmail(e.target.value)}
                                placeholder="hello@yourdomain.com"
                                disabled={bulkSaving || !isOwner}
                                autoComplete="email"
                                className="h-9 px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed w-80 max-w-full"
                            />
                        </div>
                    </div>
                    {publicContactEmailError && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
                            <ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} />
                            <p className="text-xs text-red-700 dark:text-red-300">{publicContactEmailError}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Contact Address ─────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Address"
                        description="Physical address of the restaurant. Shown on reservation confirmations and public-facing pages."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <ContactAddressField
                            value={contactAddress}
                            onChange={setContactAddress}
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                    {contactAddressError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{contactAddressError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Leave blank to hide from public pages.</p>
                </div>
            </div>

            {/* ── Social Networks ─────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Social Networks"
                        description="Shown in the site footer, on the Contact and Reservations pages, in the mobile menu, and to Sage. Every network you fill in appears in the order below."
                    />

                    <div className="mb-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Hide handles on the site</p>
                            <p className="mt-1 text-xs text-wg-muted dark:text-wg-dark-muted">
                                Buttons show only the network name, centred — no handle and no label. They stay clickable, and Sage still
                                knows the real handles.
                            </p>
                        </div>
                        <Switch
                            checked={socialLinks.hideHandles}
                            onChange={(next) => setSocialLinks((prev) => ({ ...prev, hideHandles: next }))}
                            disabled={bulkSaving || !isOwner}
                            label="Hide handles on the site"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {SOCIAL_PLATFORMS.map((platform) => {
                            const entry = socialLinks.links[platform.id]
                            const value = entry?.value ?? ""
                            return (
                                <div
                                    key={platform.id}
                                    className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="w-7 h-7 flex-shrink-0 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/15 flex items-center justify-center text-wg-accent dark:text-wg-dark-accent">
                                            <SocialIcon platform={platform.id} className="w-3.5 h-3.5" />
                                        </span>
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{platform.label}</p>
                                        {value.trim() !== "" && (
                                            <span className="ml-auto text-[0.6rem] font-medium uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/15 text-wg-accent dark:text-wg-dark-accent">
                                                Active
                                            </span>
                                        )}
                                    </div>

                                    {platform.phone ? (
                                        <div className="space-y-3">
                                            <PhoneInput
                                                value={value}
                                                onChange={(next) => setSocialField(platform.id, "value", next)}
                                                disabled={bulkSaving || !isOwner}
                                            />
                                            <div>
                                                <p className="text-xs font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                                    Username <span className="text-wg-muted dark:text-wg-dark-muted font-normal">(optional)</span>
                                                </p>
                                                <div className="flex items-center h-9 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface focus-within:ring-2 focus-within:ring-wg-accent/50 dark:focus-within:ring-wg-dark-accent/50 has-[input:disabled]:opacity-50">
                                                    <span className="pl-3 text-sm text-wg-muted dark:text-wg-dark-muted select-none">@</span>
                                                    <input
                                                        type="text"
                                                        value={entry?.username ?? ""}
                                                        onChange={(e) => setSocialField(platform.id, "username", e.target.value)}
                                                        onBlur={() => normalizeSocialField(platform.id, "username")}
                                                        placeholder="wildgrove"
                                                        disabled={bulkSaving || !isOwner}
                                                        aria-label="WhatsApp username"
                                                        className="flex-1 min-w-0 h-full bg-transparent px-1.5 pr-3 text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <p className="mt-1.5 text-xs text-wg-muted dark:text-wg-dark-muted">
                                                    Shown instead of the number. The link still opens the chat by number.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center h-9 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface focus-within:ring-2 focus-within:ring-wg-accent/50 dark:focus-within:ring-wg-dark-accent/50 has-[input:disabled]:opacity-50">
                                            <span className="pl-3 text-sm text-wg-muted dark:text-wg-dark-muted select-none whitespace-nowrap">
                                                {platform.inputPrefix}
                                            </span>
                                            <input
                                                type="text"
                                                value={value}
                                                onChange={(e) => setSocialField(platform.id, "value", e.target.value)}
                                                onBlur={() => normalizeSocialField(platform.id, "value")}
                                                placeholder={platform.placeholder}
                                                disabled={bulkSaving || !isOwner}
                                                aria-label={`${platform.label} handle`}
                                                className="flex-1 min-w-0 h-full bg-transparent px-1.5 pr-3 text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    )}

                                    <p className="mt-2 text-xs text-wg-muted dark:text-wg-dark-muted">{platform.hint}</p>

                                    <div className="mt-3 pt-3 border-t border-wg-border/40 dark:border-wg-dark-border/60">
                                        <p className="text-xs font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                            Label <span className="text-wg-muted dark:text-wg-dark-muted font-normal">(optional)</span>
                                        </p>
                                        <div className="flex items-center h-9 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface focus-within:ring-2 focus-within:ring-wg-accent/50 dark:focus-within:ring-wg-dark-accent/50 has-[input:disabled]:opacity-50">
                                            <input
                                                type="text"
                                                value={entry?.label ?? ""}
                                                onChange={(e) => setSocialField(platform.id, "label", e.target.value.slice(0, 40))}
                                                onBlur={() => normalizeSocialField(platform.id, "label")}
                                                placeholder={platform.label === "WhatsApp" ? "Message us" : "Follow us"}
                                                disabled={bulkSaving || !isOwner || socialLinks.hideHandles}
                                                maxLength={40}
                                                aria-label={`${platform.label} label`}
                                                className="flex-1 min-w-0 h-full bg-transparent px-1.5 pr-3 text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none disabled:cursor-not-allowed pl-3"
                                            />
                                        </div>
                                        <p className="mt-1.5 text-xs text-wg-muted dark:text-wg-dark-muted">
                                            {socialLinks.hideHandles
                                                ? "Nothing is shown while handles are hidden."
                                                : "Shown in place of the handle. Display only — the link is unchanged."}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {socialLinksError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{socialLinksError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        Type the handle or paste the whole profile URL, it is cleaned up when you leave the field. Leave blank to hide.
                    </p>
                </div>
            </div>
                </>
            )}

            {activeSection === "chatbot" && (
                <>
            {/* ── Chat Bubble Position ────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Chat Bubble Position"
                        description="Which side of the screen the chat bubble appears on for visitors on public-facing pages."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Bubble position</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminSelect value={chatBubblePosition} required onChange={(v) => setChatBubblePosition(v)} options={CHAT_POSITION_OPTIONS} disabled={bulkSaving || !isOwner} className="w-36" />
                        </div>
                    </div>
                    {chatPosError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{chatPosError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Applies in every chat mode except Off.</p>
                </div>
            </div>
                </>
            )}

            {activeSection === "general" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">General</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Global defaults used across the CMS and public site.</p>
            </div>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Formatting</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Regional display preferences for date and time across the experience.</p>
            </div>
            <div className="pt-2">
                <h2 className="sr-only">General Formatting Settings</h2>
            </div>

            {/* ── Date Format ─────────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Date Format"
                        description="How dates are displayed throughout the admin panel and public-facing pages."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Display format</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <AdminSelect value={dateFormat} required onChange={(v) => setDateFormat(v)} options={DATE_FORMAT_OPTIONS} disabled={bulkSaving || !isOwner} className="w-44" />
                        </div>
                    </div>
                    {dateFormatError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{dateFormatError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Affects how dates appear in the admin panel and on public pages.</p>
                </div>
            </div>

            {/* ── Time Format ─────────────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Time Format"
                        description="How times are displayed — 12-hour (AM/PM) or 24-hour format — across the admin panel and public pages."
                    />
                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-brand flex items-center justify-center bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent">
                                <ClockRightAngleIcon className="w-4.5 h-4.5" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                    {timeFormat === "24h"
                                        ? "Currently: 24-hour clock (e.g. 14:30)"
                                        : "Currently: 12-hour clock (e.g. 2:30 PM)"}
                                </p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                    {timeFormat === "24h"
                                        ? "Switch left to use AM/PM on the site and in admin."
                                        : "Switch right to use 24-hour times (14:30) on the site and in admin."}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={timeFormat === "24h"}
                            onChange={(next) => setTimeFormat(next ? "24h" : "12h")}
                            label={timeFormat === "24h" ? "24-hour time; click for 12-hour" : "12-hour time; click for 24-hour"}
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                    {timeFormatError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{timeFormatError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Green track + knob right = 24-hour · Gray track + knob left = 12-hour (AM/PM).</p>
                </div>
            </div>
                </>
            )}

            {activeSection === "notifications" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Notifications</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Control where admin alerts and operational events are delivered.</p>
            </div>
            {/* ── Admin email alerts ──────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Admin email alerts"
                        description="Send operational alert emails to the notification address below. In-app notifications in the admin panel are not affected."
                    />
                    <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-brand flex items-center justify-center ${
                                adminEmailNotificationsEnabled
                                    ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent"
                                    : "bg-wg-border/30 dark:bg-wg-dark-border/30 text-wg-muted dark:text-wg-dark-muted"
                            }`}>
                                <EnvelopeIcon className="w-4.5 h-4.5" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                    {adminEmailNotificationsEnabled ? "Email alerts enabled" : "Email alerts disabled"}
                                </p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                    {adminEmailNotificationsEnabled
                                        ? "New orders, reservations, tickets, and chat escalations can email the address below when SMTP is configured."
                                        : "No operational emails are sent to admins. You will still see alerts inside /notifications."}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={adminEmailNotificationsEnabled}
                            onChange={(next) => setAdminEmailNotificationsEnabled(next)}
                            label="Admin email alerts"
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">When enabled, these events can send email (requires SMTP and a notification address):</p>
                    <ul className="text-xs text-wg-muted dark:text-wg-dark-muted list-disc pl-4 space-y-0.5">
                        <li>New order placed</li>
                        <li>New reservation, cancellation, or reschedule by a customer</li>
                        <li>Reservation confirmed (staff copy)</li>
                        <li>New support ticket or customer reply on a ticket</li>
                        <li>Chat escalated to human support</li>
                    </ul>
                </div>
            </div>
            {/* ── Notification Email ──────────────────────────────────── */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Notification Email"
                        description="Single inbox for admin alert emails. Your personal admin account email is never used automatically."
                    />
                    <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Destination address</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input type="email" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} placeholder="admin@wildgrove.com" disabled={bulkSaving || !isOwner}
                                className="h-9 px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed w-72" />
                        </div>
                    </div>
                    {notifEmailError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{notifEmailError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Must be a valid email address. Leave blank to skip admin alert emails (or turn off &quot;Admin email alerts&quot; above).</p>
                </div>
            </div>
                </>
            )}

            {activeSection === "payments" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Payments &amp; Orders</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Configure wallet, fulfillment options, and payment methods.</p>
            </div>

            {/* Wallet settings */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader title="Wallet Settings" description="Control wallet availability and currency support for your customers." />
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Wallet Payments</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">Allow customers to pay with their wallet balance</p>
                            </div>
                            <Switch
                                checked={walletEnabled}
                                onChange={(next) => setWalletEnabled(next)}
                                label="Wallet payments"
                                disabled={bulkSaving || !isOwner}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Dual Currency (PEN + USD)</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">On: customers choose between soles and dollars. Off: the store shows and charges only in the store currency below.</p>
                            </div>
                            <Switch
                                checked={walletAllowDualCurrency}
                                onChange={(next) => setWalletAllowDualCurrency(next)}
                                label="Dual currency"
                                disabled={bulkSaving || !isOwner}
                            />
                        </div>
                        <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Store currency</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5 mb-3">
                                {walletAllowDualCurrency
                                    ? "Turn off Dual Currency to show and charge in a single currency."
                                    : "The only currency customers see and pay in. Prices, wallets and balances in the other currency stay editable here in the panel."}
                            </p>
                            <AdminSelect
                                value={defaultCurrency}
                                required
                                onChange={(v) => {
                                    // The list's empty row is ignored: the store always has a currency.
                                    if (isSupportedCurrency(v)) setDefaultCurrency(v)
                                }}
                                options={CURRENCY_OPTIONS}
                                disabled={bulkSaving || !isOwner || walletAllowDualCurrency}
                                className="w-56"
                            />
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Wallets are auto-created on first access. Disabling wallet payments hides the payment option at checkout.</p>
                </div>
            </div>

            {/* Starting test balance */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader title="Starting Test Balance" description="Credited once to each new account when it is created." />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Soles wallet</p>
                            <AdminNumberInput value={initialBalancePEN} onChange={setInitialBalancePEN} min={0} max={99999.99} step={10} decimals={2} prefix="S/" nullable={false} disabled={bulkSaving || !isOwner} className="w-44" />
                        </div>
                        <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Dollars wallet</p>
                            <AdminNumberInput value={initialBalanceUSD} onChange={setInitialBalanceUSD} min={0} max={99999.99} step={10} decimals={2} prefix="$" nullable={false} disabled={bulkSaving || !isOwner} className="w-44" />
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Changes apply to accounts created afterwards; accounts that already exist keep their balance. 0 leaves that currency empty.</p>
                </div>
            </div>

            {/* Fulfillment settings */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader title="Fulfillment Methods" description="Enable or disable Pickup and Delivery options for customers." />
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Pickup</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">Customers can pick up orders at the restaurant</p>
                            </div>
                            <Switch
                                checked={pickupEnabled}
                                onChange={(next) => setPickupEnabled(next)}
                                label="Pickup"
                                disabled={bulkSaving || !isOwner}
                            />
                        </div>
                        {pickupEnabled && (
                            <div className="p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Pickup lead time (minutes)</p>
                                <AdminNumberInput value={pickupLeadTimeMinutes} onChange={setPickupLeadTimeMinutes} min={0} max={480} step={5} suffix="min" disabled={bulkSaving || !isOwner} className="w-36" />
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-4 p-4 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Delivery</p>
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">Customers can order delivery to their address</p>
                            </div>
                            <Switch
                                checked={deliveryEnabled}
                                onChange={(next) => setDeliveryEnabled(next)}
                                label="Delivery"
                                disabled={bulkSaving || !isOwner}
                            />
                        </div>
                    </div>
                    {fulfillmentError && <div className="mt-4 flex items-center gap-2 p-3 rounded-brand border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10"><ExclamationTriangleBarIcon className="w-4 h-4 flex-shrink-0 text-red-500" strokeWidth={2} /><p className="text-xs text-red-700 dark:text-red-300">{fulfillmentError}</p></div>}
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">At least one fulfillment method must be enabled. Pickup lead time is the minimum minutes before scheduled pickup.</p>
                </div>
            </div>

            {/* Order number prefix */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader title="Order Number" description="Prefix prepended to all order numbers displayed to customers." />
                    <div className="flex items-center gap-3 flex-wrap">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Order prefix</p>
                            <input type="text" value={orderNumberPrefix} onChange={(e) => setOrderNumberPrefix(e.target.value.toUpperCase())} maxLength={10} placeholder="WG" disabled={bulkSaving || !isOwner}
                                className="h-9 w-24 px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                        </div>
                        <div className="mt-5">
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted">Preview: <span className="font-mono font-semibold text-wg-text dark:text-wg-dark-text">{(orderNumberPrefix || "WG").toUpperCase()}-0001</span></p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Max 10 characters. Changes affect new orders only.</p>
                </div>
            </div>

            {/* Restaurant coordinates */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader title="Restaurant Location" description="GPS coordinates of the restaurant. Used as origin for delivery distance calculations and RADIUS zones." />
                    {MAPS_PUBLIC_KEY ? (
                        <APIProvider apiKey={MAPS_PUBLIC_KEY}>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Search address or place</p>
                                    <AddressAutocomplete
                                        value={restaurantLocationSearch}
                                        onAddressSelect={onRestaurantAddressPick}
                                        placeholder="e.g. Av. Larco, Miraflores…"
                                        disabled={bulkSaving || !isOwner}
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Map</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Drag the pin to fine-tune. If coordinates are empty, the map starts at a default view in Lima until you search or place the pin.</p>
                                    <MapPicker
                                        withApiProvider={false}
                                        lat={restaurantMapPin.lat}
                                        lng={restaurantMapPin.lng}
                                        onChange={onRestaurantMapDrag}
                                        zoom={16}
                                        className="h-64 w-full rounded-brand overflow-hidden border border-wg-border/50 dark:border-wg-dark-border"
                                    />
                                </div>
                            </div>
                        </APIProvider>
                    ) : (
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">
                            Set <span className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span> to enable map search and pin placement (same key as checkout delivery).
                        </p>
                    )}
                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-3">Coordinates</p>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Latitude</p>
                            <input type="text" value={restaurantLat} onChange={(e) => setRestaurantLat(e.target.value)} placeholder="-12.046374" disabled={bulkSaving || !isOwner}
                                className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Longitude</p>
                            <input type="text" value={restaurantLng} onChange={(e) => setRestaurantLng(e.target.value)} placeholder="-77.042793" disabled={bulkSaving || !isOwner}
                                className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono" />
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Leave latitude and longitude blank if delivery distance calculations are not needed.</p>
                </div>
            </div>

            {/* Fiscal data — sales receipt / invoice */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader title="Tax information" description="Company details used to generate sales receipts and invoices. Required for the simulated tax document flow." />
                    <div className="space-y-4">
                        {/* Enable toggles */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center justify-between gap-4 p-3 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Sales receipt</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Document for individuals</p>
                                </div>
                                <Switch
                                    checked={boletaEnabled}
                                    onChange={(next) => setBoletaEnabled(next)}
                                    label="Sales receipt"
                                    disabled={bulkSaving || !isOwner}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-4 p-3 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised">
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Invoice</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">For businesses / RUC tax ID</p>
                                </div>
                                <Switch
                                    checked={facturaEnabled}
                                    onChange={(next) => setFacturaEnabled(next)}
                                    label="Invoice"
                                    disabled={bulkSaving || !isOwner}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Restaurant RUC</p>
                                <input type="text" value={companyRuc} onChange={(e) => setCompanyRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20XXXXXXXXX" maxLength={11} disabled={bulkSaving || !isOwner}
                                    className="h-9 w-48 px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono" />
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Legal business name</p>
                                <input type="text" value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} placeholder="WILD GROVE S.A.C." maxLength={200} disabled={bulkSaving || !isOwner}
                                    className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Registered fiscal address</p>
                                <input type="text" value={companyFiscalAddress} onChange={(e) => setCompanyFiscalAddress(e.target.value)} placeholder="123 Example Ave., Lima" maxLength={255} disabled={bulkSaving || !isOwner}
                                    className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">IGV rate (%)</p>
                                <AdminNumberInput value={igvRate} onChange={setIgvRate} min={0} max={100} step={1} decimals={2} suffix="%" disabled={bulkSaving || !isOwner} className="w-36" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Receipt series</p>
                                    <input type="text" value={boletaSeries} onChange={(e) => setBoletaSeries(e.target.value.toUpperCase().slice(0, 4))} placeholder="B001" maxLength={4} disabled={bulkSaving || !isOwner}
                                        className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Invoice series</p>
                                    <input type="text" value={facturaSeries} onChange={(e) => setFacturaSeries(e.target.value.toUpperCase().slice(0, 4))} placeholder="F001" maxLength={4} disabled={bulkSaving || !isOwner}
                                        className="h-9 w-full px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Used to issue simulated tax documents (portfolio demo). Not connected to a live billing operator (OSE/PSE).</p>
                </div>
            </div>
                </>
            )}

            {activeSection === "dashboard" && (
                <>
            <div className="pt-2">
                <h2 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">Dashboard</h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">Real-time dashboard thresholds and default view preferences.</p>
            </div>

            {/* Alert thresholds card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Alert Thresholds"
                        description="Time and quantity thresholds that trigger visual warnings in the live dashboard."
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Kitchen alert (minutes)</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Orders in kitchen longer than this appear red.</p>
                            <AdminNumberInput
                                value={dashKitchenAlertMin}
                                onChange={setDashKitchenAlertMin}
                                min={1} max={120} step={1} decimals={0}
                                suffix="min"
                                disabled={bulkSaving || !isOwner}
                                className="w-36"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Pickup alert (minutes)</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Ready-for-pickup orders older than this appear red.</p>
                            <AdminNumberInput
                                value={dashPickupAlertMin}
                                onChange={setDashPickupAlertMin}
                                min={1} max={120} step={1} decimals={0}
                                suffix="min"
                                disabled={bulkSaving || !isOwner}
                                className="w-36"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">Low-stock threshold (units)</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Items with stock at or below this count are flagged.</p>
                            <AdminNumberInput
                                value={dashLowStockThreshold}
                                onChange={setDashLowStockThreshold}
                                min={0} max={100} step={1} decimals={0}
                                suffix="units"
                                disabled={bulkSaving || !isOwner}
                                className="w-36"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">ETA tolerance (minutes)</p>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">Minutes beyond the estimated delivery time before an order counts as late.</p>
                            <AdminNumberInput
                                value={dashEtaToleranceMin}
                                onChange={setDashEtaToleranceMin}
                                min={0} max={60} step={1} decimals={0}
                                suffix="min"
                                disabled={bulkSaving || !isOwner}
                                className="w-36"
                            />
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-bg/50 dark:bg-wg-dark-raised/50 rounded-b-card">
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">Changes take effect on the next dashboard poll cycle (≤ 30 s).</p>
                </div>
            </div>

            {/* Default date preset card */}
            <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card">
                <div className="p-6">
                    <OwnerSettingCardHeader
                        title="Default Date Preset"
                        description="The date range shown when an admin first opens the dashboard. Each user can still change it locally."
                    />
                    <div className="max-w-xs">
                        <AdminSelect
                            value={dashDefaultPreset}
                            required
                            onChange={setDashDefaultPreset}
                            options={[
                                { value: "today",     label: "Today" },
                                { value: "yesterday", label: "Yesterday" },
                                { value: "last7d",    label: "Last 7 days" },
                                { value: "last30d",   label: "Last 30 days" },
                                { value: "thisMonth", label: "This month" },
                                { value: "lastMonth", label: "Last month" },
                            ]}
                            disabled={bulkSaving || !isOwner}
                        />
                    </div>
                </div>
            </div>
                </>
            )}

            <div
                role="region"
                aria-label="Unsaved settings actions"
                aria-live="polite"
                className={`fixed bottom-5 left-1/2 z-50 w-[min(100%,26rem)] -translate-x-1/2 px-3 transition-all duration-300 ease-out ${
                    showFloatingBar
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-8 opacity-0"
                }`}
            >
                <div className="rounded-card border border-wg-border/70 dark:border-wg-dark-border bg-wg-surface/95 dark:bg-wg-dark-surface/95 backdrop-blur-md shadow-elevated px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                        {bulkBarSuccess ? (
                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                All changes saved successfully.
                            </p>
                        ) : bulkBarError ? (
                            <p className="text-sm text-red-700 dark:text-red-300">{bulkBarError}</p>
                        ) : bulkSaving ? (
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Saving…</p>
                        ) : (
                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                <span className="text-wg-muted dark:text-wg-dark-muted font-normal">Unsaved · </span>
                                {dirtyFieldCount === 1 ? "1 change" : `${dirtyFieldCount} changes`}
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleDiscardChanges}
                            disabled={!hasUnsavedChanges || bulkSaving || !baseline}
                            className="h-9 px-4 text-sm font-medium rounded-brand border border-wg-border/70 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-wg-accent/40 dark:focus:ring-wg-dark-accent/40"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSaveAll()}
                            disabled={!hasUnsavedChanges || bulkSaving || !isOwner || !baseline}
                            className="h-9 px-4 text-sm font-medium rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50"
                        >
                            {bulkSaving ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="w-3.5 h-3.5 animate-spin" aria-hidden />
                                    Save
                                </span>
                            ) : (
                                "Save"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
