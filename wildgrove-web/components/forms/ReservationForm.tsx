"use client"

import { useReducer, useCallback, useEffect, useId, useMemo, useState } from "react"
import { useRouter } from "@/i18n/routing"
import { useRouter as useNextRouter } from "next/navigation"
import { getPathname, type Locale } from "@wildgrove/core/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import { DatePicker } from "./DatePicker"
import { TimePicker } from "./TimePicker"
import { GuestsPicker } from "./GuestsPicker"
import type { UserProfile } from "@wildgrove/core/types"
import { PhoneInput } from "@wildgrove/ui/PhoneInput"
import type { ClosedTimeRange } from "@wildgrove/core/reservation-schedule"
import { dateHasBookableTimeSlot, parseOperatingDays } from "@wildgrove/core/reservation-schedule"
import { limaEarliestBookableDateIso, limaMaxBookableDateIso } from "@wildgrove/core/reservation-dates-lima"
import { formatWallClockSlotLabel, normalizeTimeFormatPreference } from "@wildgrove/core/app-datetime-format"
import { useCurrencyFormatter } from "@/components/providers/CurrencyProvider"
import { Textarea } from "@wildgrove/ui/Textarea"
import {
    CalendarBandIcon,
    CheckIcon,
    ListBulletIcon,
    LockClosedIcon,
    PencilSquareIcon,
    Spinner,
} from "@wildgrove/ui/icons"

// ══════════════════════════════════════════════════════════════════
// Reservation Form — functional, connected to API
// Applies form-cro principles: easy→sensitive field order,
// inline validation, availability check, discount code support
// ══════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────
interface FormState {
    date: string
    time: string
    partySize: number
    name: string
    email: string
    phone: string
    notes: string
    discountCode: string
}

interface Availability {
    available: boolean
    slotsLeft: number
}

interface DiscountInfo {
    name: string
    description: string | null
    valueType: string
    value: number
    currency?: string
}

type FormAction =
    | { type: "SET_FIELD"; field: keyof FormState; value: string | number }
    | { type: "RESET"; initial: FormState }

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case "SET_FIELD":
            return { ...state, [action.field]: action.value }
        case "RESET":
            return action.initial
        default:
            return state
    }
}

type SubmitStatus = "idle" | "loading" | "success" | "error"

interface ReservationFormProps {
    user?: UserProfile | null
    onReservationCreated?: () => void
    advanceNoticeMs?: number // default: 2h
    maxPartySize?: number
    largeGroupWarningFrom?: number
    timeSlotIncrement?: number
    operatingDays?: string
    openingTime?: string
    closingTime?: string
    maxDaysAhead?: number
    closedTimeRanges?: ClosedTimeRange[]
    /** CMS time format — slot values remain HH:mm for the API */
    displayTimeFormat?: "12h" | "24h"
    /** Public address from CMS for Google Calendar event location */
    calendarEventLocation?: string | null
}

export function ReservationForm({
    user,
    onReservationCreated,
    advanceNoticeMs = 2 * 60 * 60 * 1000,
    maxPartySize = 40,
    largeGroupWarningFrom = 8,
    timeSlotIncrement = 30,
    operatingDays = "1,2,3,4,5,6,7",
    openingTime = "09:00",
    closingTime = "22:00",
    maxDaysAhead = 30,
    closedTimeRanges = [],
    displayTimeFormat = "24h",
    calendarEventLocation = null,
}: ReservationFormProps) {
    const router = useRouter()
    const nextRouter = useNextRouter()
    const t = useTranslations("reservationForm")
    const fieldId = useId()
    const tc = useTranslations("common")
    const tf = useTranslations("contactForm")
    const ta = useTranslations("auth")
    const locale = useLocale()
    const { formatAmount } = useCurrencyFormatter()
    const initialState: FormState = {
        date: "",
        time: "",
        partySize: 0,
        name: user?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone ?? "",
        notes: "",
        discountCode: "",
    }

    const [state, dispatch] = useReducer(formReducer, initialState)
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle")
    const [submitError, setSubmitError] = useState("")
    const [availability, setAvailability] = useState<Availability | null>(null)
    const [checkingAvailability, setCheckingAvailability] = useState(false)
    const [showPromoField, setShowPromoField] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    const [editPopover, setEditPopover] = useState<"name" | "email" | "phone" | null>(null)
    const enabledWeekdays = useMemo(() => parseOperatingDays(operatingDays), [operatingDays])
    const timeDisplayPref = normalizeTimeFormatPreference(displayTimeFormat)

    const maxSelectableDate = useMemo(() => limaMaxBookableDateIso(maxDaysAhead), [maxDaysAhead])

    useEffect(() => {
        const minD = limaEarliestBookableDateIso(advanceNoticeMs)
        if (!state.date) return
        if (state.date < minD || state.date > maxSelectableDate) {
            dispatch({ type: "SET_FIELD", field: "date", value: "" })
            if (state.time) dispatch({ type: "SET_FIELD", field: "time", value: "" })
        }
    }, [advanceNoticeMs, maxSelectableDate, state.date, state.time])

    useEffect(() => {
        if (!state.date) return
        if (
            !dateHasBookableTimeSlot(state.date, {
                advanceNoticeMs,
                openingTime,
                closingTime,
                timeSlotIncrement,
                operatingDays: enabledWeekdays,
                closedTimeRanges,
            })
        ) {
            dispatch({ type: "SET_FIELD", field: "date", value: "" })
            if (state.time) dispatch({ type: "SET_FIELD", field: "time", value: "" })
        }
    }, [
        advanceNoticeMs,
        closedTimeRanges,
        enabledWeekdays,
        openingTime,
        closingTime,
        state.date,
        state.time,
        timeSlotIncrement,
    ])

    const dateHasAnyBookableSlot = useCallback(
        (iso: string) =>
            dateHasBookableTimeSlot(iso, {
                advanceNoticeMs,
                openingTime,
                closingTime,
                timeSlotIncrement,
                operatingDays: enabledWeekdays,
                closedTimeRanges,
            }),
        [
            advanceNoticeMs,
            closedTimeRanges,
            enabledWeekdays,
            openingTime,
            closingTime,
            timeSlotIncrement,
        ],
    )

    // Confirmation data
    const [confirmation, setConfirmation] = useState<{
        reservationId: string
        discountApplied?: DiscountInfo
    } | null>(null)

    const setField = useCallback(
        (field: keyof FormState, value: string | number) =>
            dispatch({ type: "SET_FIELD", field, value }),
        []
    )

    // ── Availability check (debounced) ──────────────────────────
    useEffect(() => {
        if (!state.date || !state.time || state.partySize < 1) {
            setAvailability(null)
            return
        }

        const timer = setTimeout(async () => {
            setCheckingAvailability(true)
            try {
                const params = new URLSearchParams({
                    date: state.date,
                    time: state.time,
                    partySize: String(state.partySize),
                })
                const res = await fetch(`/api/reservations/availability?${params}`)
                const json = await res.json()
                if (json.success) {
                    setAvailability(json.data)
                }
            } catch {
                setAvailability(null)
            }
            setCheckingAvailability(false)
        }, 500)

        return () => clearTimeout(timer)
    }, [state.date, state.time, state.partySize])

    useEffect(() => {
        if (state.partySize > maxPartySize) {
            setField("partySize", maxPartySize)
        }
    }, [maxPartySize, setField, state.partySize])

    // ── Inline validation ───────────────────────────────────────
    function validateField(field: string, value: string) {
        const errors = { ...fieldErrors }

        switch (field) {
            case "email":
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errors.email = t("emailError")
                } else {
                    delete errors.email
                }
                break
            case "name":
                if (value && value.length < 2) {
                    errors.name = t("nameError")
                } else {
                    delete errors.name
                }
                break
        }

        setFieldErrors(errors)
    }

    // ── Get minimum date (Lima calendar, advance notice) ─────────
    function getMinDate(): string {
        return limaEarliestBookableDateIso(advanceNoticeMs)
    }

    // ── Submit ───────────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitStatus("loading")
        setSubmitError("")

        try {
            const res = await fetch("/api/reservations", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-locale": locale },
                body: JSON.stringify({
                    date: state.date,
                    time: state.time,
                    partySize: state.partySize,
                    name: state.name,
                    email: state.email,
                    phone: state.phone || undefined,
                    notes: state.notes || undefined,
                    discountCode: state.discountCode || undefined,
                }),
            })

            const json = await res.json()

            if (!json.success) {
                setSubmitStatus("error")
                setSubmitError(json.error || ta("somethingWrong"))
                return
            }

            setSubmitStatus("success")
            setConfirmation({
                reservationId: json.data.reservationId,
                discountApplied: json.data.discountApplied,
            })
            window.dispatchEvent(new CustomEvent("reservation:created"))
            onReservationCreated?.()
        } catch {
            setSubmitStatus("error")
            setSubmitError(t("connectionError"))
        }
    }

    // ── Google Calendar link ────────────────────────────────────
    function getCalendarUrl(): string {
        const startDate = new Date(`${state.date}T${state.time}:00`)
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)

        const format = (d: Date) =>
            d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"

        const loc = calendarEventLocation?.trim()
        const locParam = loc ? `&location=${encodeURIComponent(loc)}` : ""
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Dinner at Wild Grove")}&dates=${format(startDate)}/${format(endDate)}${locParam}&details=${encodeURIComponent(`Reservation for ${state.partySize} guest(s)`)}`
    }

    // ── Shared input classes ────────────────────────────────────
    const inputClasses =
        "w-full px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition"

    const labelClasses =
        "block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2"

    // ═════════════════════════════════════════════════════════════
    // CONFIRMATION STATE
    // ═════════════════════════════════════════════════════════════
    if (submitStatus === "success" && confirmation) {
        return (
            <div className="text-center py-4 space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckIcon className="w-8 h-8 text-green-600 dark:text-green-400" strokeWidth={2} />
                </div>

                <div>
                    <h3 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                        {t("successTitle")}
                    </h3>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-2">
                        {t.rich("successEmail", {
                            email: state.email,
                            strong: (chunks) => <span className="font-medium text-wg-text dark:text-wg-dark-text">{chunks}</span>,
                        })}
                    </p>
                </div>

                {/* Booking details */}
                <div className="bg-wg-bg dark:bg-wg-dark-raised rounded-card p-6 text-left space-y-3 border border-wg-border/50 dark:border-wg-dark-border">
                    <div className="flex justify-between text-sm">
                        <span className="text-wg-muted dark:text-wg-dark-muted">{t("detailDate")}</span>
                        <span className="font-medium text-wg-text dark:text-wg-dark-text">
                            {new Date(state.date + "T12:00:00").toLocaleDateString(locale === "es" ? "es-PE" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-wg-muted dark:text-wg-dark-muted">{t("detailTime")}</span>
                        <span className="font-medium text-wg-text dark:text-wg-dark-text">{formatWallClockSlotLabel(state.time, timeDisplayPref)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-wg-muted dark:text-wg-dark-muted">{t("detailGuests")}</span>
                        <span className="font-medium text-wg-text dark:text-wg-dark-text">{state.partySize}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-wg-muted dark:text-wg-dark-muted">{t("detailName")}</span>
                        <span className="font-medium text-wg-text dark:text-wg-dark-text">{state.name}</span>
                    </div>
                    {confirmation.discountApplied && (
                        <div className="flex justify-between text-sm pt-2 border-t border-wg-border/50 dark:border-wg-dark-border">
                            <span className="text-wg-accent dark:text-wg-dark-accent">{t("promoApplied")}</span>
                            <span className="font-medium text-wg-accent dark:text-wg-dark-accent">
                                {confirmation.discountApplied.valueType === "PERCENTAGE"
                                    ? t("percentOff", { value: confirmation.discountApplied.value })
                                    : t("amountOffFormatted", {
                                        amount: formatAmount(
                                            confirmation.discountApplied.value,
                                            confirmation.discountApplied.currency ?? "PEN"
                                        ),
                                    })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => {
                            const historyPath = getPathname({ locale: locale as Locale, href: "/account/reservations" })
                            nextRouter.push(`/${locale}${historyPath === "/" ? "" : historyPath}#reservation-${confirmation.reservationId}`)
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition"
                    >
                        <ListBulletIcon className="w-4 h-4" />
                        {t("viewReservations")}
                    </button>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <a
                            href={getCalendarUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition"
                        >
                            <CalendarBandIcon className="w-4 h-4" />
                            {t("addToCalendar")}
                        </a>
                        <button
                            onClick={() => {
                                dispatch({ type: "RESET", initial: initialState })
                                setSubmitStatus("idle")
                                setConfirmation(null)
                                setAvailability(null)
                            }}
                            className="flex-1 px-5 py-3 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition"
                        >
                            {t("makeAnother")}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ═════════════════════════════════════════════════════════════
    // FORM STATE
    // ═════════════════════════════════════════════════════════════
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Date + Time + Guests (easy fields first) ─────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label id={`${fieldId}-date-label`} htmlFor={`${fieldId}-date`} className={labelClasses}>{t("dateLabel")}</label>
                    <DatePicker
                        id={`${fieldId}-date`}
                        labelledBy={`${fieldId}-date-label`}
                        value={state.date}
                        min={getMinDate()}
                        max={maxSelectableDate}
                        enabledWeekdays={enabledWeekdays}
                        hasBookableSlot={dateHasAnyBookableSlot}
                        onChange={(d) => {
                            setField("date", d)
                            // Clear selected time when date changes; valid slots can differ by day and cutoff.
                            if (state.time) setField("time", "")
                        }}
                        required
                    />
                </div>
                <div>
                    <label id={`${fieldId}-time-label`} htmlFor={`${fieldId}-time`} className={labelClasses}>{t("timeLabel")}</label>
                    <TimePicker
                        id={`${fieldId}-time`}
                        labelledBy={`${fieldId}-time-label`}
                        value={state.time}
                        onChange={(t) => setField("time", t)}
                        required
                        selectedDate={state.date}
                        advanceNoticeMs={advanceNoticeMs}
                        openingTime={openingTime}
                        closingTime={closingTime}
                        timeSlotIncrement={timeSlotIncrement}
                        enabledWeekdays={enabledWeekdays}
                        closedTimeRanges={closedTimeRanges}
                        displayTimeFormat={timeDisplayPref}
                    />
                </div>
                <div>
                    <label id={`${fieldId}-guests-label`} htmlFor={`${fieldId}-guests`} className={labelClasses}>{t("guestsLabel")}</label>
                    <GuestsPicker
                        id={`${fieldId}-guests`}
                        labelledBy={`${fieldId}-guests-label`}
                        value={state.partySize}
                        onChange={(n) => setField("partySize", n)}
                        required
                        maxGuests={maxPartySize}
                        largeGroupWarningFrom={largeGroupWarningFrom}
                    />
                </div>
            </div>

            {/* ── Availability indicator ──────────────────────── */}
            {(state.date && state.time && state.partySize >= 1) && (
                <div className="text-sm">
                    {checkingAvailability ? (
                        <span className="text-wg-muted dark:text-wg-dark-muted flex items-center gap-1.5">
                            <Spinner className="animate-spin h-3.5 w-3.5" />
                            {t("checkingAvailability")}
                        </span>
                    ) : availability ? (
                        availability.available ? (
                            <span className="text-green-700 dark:text-green-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                {t("available")}
                            </span>
                        ) : (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                {t("fullyBooked")}
                            </span>
                        )
                    ) : null}
                </div>
            )}

            {/* ── Name ────────────────────────────────────────── */}
            <div>
                <label htmlFor={`${fieldId}-name`} className={labelClasses}>{t("nameLabel")}</label>
                <div className="relative">
                    <input
                        id={`${fieldId}-name`}
                        type="text"
                        value={state.name}
                        onChange={(e) => !user && setField("name", e.target.value)}
                        onBlur={(e) => validateField("name", e.target.value)}
                        placeholder={t("namePlaceholder")}
                        required
                        readOnly={!!user}
                        autoComplete="name"
                        className={`${inputClasses} ${fieldErrors.name ? "ring-2 ring-red-400 dark:ring-red-500" : ""} ${user ? "bg-wg-surface dark:bg-wg-dark-surface cursor-default pr-14" : ""}`}
                    />
                    {user && (
                        <>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setEditPopover(editPopover === "name" ? null : "name")}
                                    className="p-0.5 text-wg-muted/40 dark:text-wg-dark-muted/40 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors rounded"
                                    title={t("updateInAccount")}
                                    aria-label={t("nameInAccountLabel")}
                                >
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                                <LockClosedIcon className="w-4 h-4 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                            </div>
                            {editPopover === "name" && (
                                <div className="absolute top-full left-0 right-0 z-20 mt-1.5 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated">
                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">{tf("updateName")}</p>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">
                                        {tf("nameFromProfile")}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => router.push({ pathname: "/account", query: { highlight: "name" } })}
                                            className="flex-1 text-xs font-medium px-3 py-2 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition"
                                        >
                                            {tc("goToAccount")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditPopover(null)}
                                            className="flex-1 text-xs font-medium px-3 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition"
                                        >
                                            {tc("notNow")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                {fieldErrors.name && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.name}</p>
                )}
            </div>

            {/* ── Email + Phone ────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`${fieldId}-email`} className={labelClasses}>{t("emailLabel")}</label>
                    <div className="relative">
                        <input
                            id={`${fieldId}-email`}
                            type="email"
                            value={state.email}
                            onChange={(e) => !user && setField("email", e.target.value)}
                            onBlur={(e) => validateField("email", e.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            readOnly={!!user}
                            autoComplete="email"
                            className={`${inputClasses} ${fieldErrors.email ? "ring-2 ring-red-400 dark:ring-red-500" : ""} ${user ? "bg-wg-surface dark:bg-wg-dark-surface cursor-default pr-14" : ""}`}
                        />
                        {user && (
                            <>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setEditPopover(editPopover === "email" ? null : "email")}
                                        className="p-0.5 text-wg-muted/40 dark:text-wg-dark-muted/40 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors rounded"
                                        title={t("updateInAccount")}
                                        aria-label={t("emailInAccountLabel")}
                                    >
                                        <PencilSquareIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <LockClosedIcon className="w-4 h-4 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                                </div>
                                {editPopover === "email" && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1.5 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated">
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">{tf("updateEmail")}</p>
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">
                                            {tf("emailFromProfile")}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => router.push({ pathname: "/account", query: { highlight: "email" } })}
                                                className="flex-1 text-xs font-medium px-3 py-2 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition"
                                            >
                                                {tc("goToAccount")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditPopover(null)}
                                                className="flex-1 text-xs font-medium px-3 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition"
                                            >
                                                {tc("notNow")}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {fieldErrors.email && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.email}</p>
                    )}
                </div>
                <div>
                    <label htmlFor={`${fieldId}-phone`} className={labelClasses}>
                        {t("phoneLabel")}{" "}
                        <span className="text-wg-muted dark:text-wg-dark-muted font-normal">{tc("optional")}</span>
                    </label>
                    <div className="relative">
                        <PhoneInput
                            id={`${fieldId}-phone`}
                            value={state.phone}
                            onChange={(v) => !user?.phone && setField("phone", v)}
                            readOnly={!!(user?.phone)}
                            locale={locale}
                            searchPlaceholder={tc("phoneCountrySearch")}
                            noResultsLabel={tc("phoneCountryNoResults")}
                            countryCodeLabel={tc("selectCountryCode")}
                            className="w-full"
                        />
                        {user?.phone && (
                            <>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setEditPopover(editPopover === "phone" ? null : "phone")}
                                        className="p-0.5 text-wg-muted/40 dark:text-wg-dark-muted/40 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors rounded"
                                        title={t("updateInAccount")}
                                        aria-label={t("phoneInAccountLabel")}
                                    >
                                        <PencilSquareIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <LockClosedIcon className="w-4 h-4 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                                </div>
                                {editPopover === "phone" && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1.5 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated">
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1">{tf("updatePhone")}</p>
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">
                                            {tf("phoneFromProfile")}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => router.push({ pathname: "/account", query: { highlight: "phone" } })}
                                                className="flex-1 text-xs font-medium px-3 py-2 rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition"
                                            >
                                                {tc("goToAccount")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditPopover(null)}
                                                className="flex-1 text-xs font-medium px-3 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition"
                                            >
                                                {tc("notNow")}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
                        {t("phoneHint")}
                    </p>
                </div>
            </div>

            {/* ── Notes ───────────────────────────────────────── */}
            <div>
                <label htmlFor={`${fieldId}-notes`} className={labelClasses}>
                    {t("notesLabel")}{" "}
                    <span className="text-wg-muted dark:text-wg-dark-muted font-normal">{tc("optional")}</span>
                </label>
                <Textarea
                    id={`${fieldId}-notes`}
                    maxHeight={220}
                    minRows={3}
                    value={state.notes}
                    onChange={(v) => setField("notes", v)}
                    placeholder={t("notesPlaceholder")}
                    maxLength={500}
                    className={inputClasses}
                />
            </div>

            {/* ── Discount code (collapsible) ─────────────────── */}
            <div>
                {!showPromoField ? (
                    <button
                        type="button"
                        onClick={() => setShowPromoField(true)}
                        className="text-sm text-wg-accent dark:text-wg-dark-accent hover:underline transition"
                    >
                        {t("havePromoCode")}
                    </button>
                ) : (
                    <div>
                        <label htmlFor={`${fieldId}-promo`} className={labelClasses}>{t("promoLabel")}</label>
                        <input
                            id={`${fieldId}-promo`}
                            type="text"
                            value={state.discountCode}
                            onChange={(e) =>
                                setField("discountCode", e.target.value.toUpperCase())
                            }
                            placeholder={t("promoPlaceholder")}
                            className={inputClasses}
                        />
                    </div>
                )}
            </div>

            {/* ── Error message ────────────────────────────────── */}
            {submitStatus === "error" && (
                <div className="p-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                    <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                </div>
            )}

            {/* ── Submit button ────────────────────────────────── */}
            <button
                type="submit"
                disabled={
                    submitStatus === "loading" ||
                    !state.date ||
                    !state.time ||
                    state.partySize < 1 ||
                    (availability !== null && !availability.available)
                }
                className="w-full px-7 py-4 text-base font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
                {submitStatus === "loading" ? (
                    <>
                        <Spinner className="animate-spin h-5 w-5" />
                        {t("submitting")}
                    </>
                ) : (
                    t("submitButton")
                )}
            </button>
        </form>
    )
}
