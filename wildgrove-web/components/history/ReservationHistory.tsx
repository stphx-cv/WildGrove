"use client"

import { useState, useEffect, useCallback, useId, useImperativeHandle, useMemo, forwardRef } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { DatePicker } from "@/components/forms/DatePicker"
import { TimePicker } from "@/components/forms/TimePicker"
import { GuestsPicker } from "@/components/forms/GuestsPicker"
import { ReviewForm } from "@/components/reviews/ReviewForm"
import {
    formatAppDateFromIso,
    formatAppTimeFromIso,
    normalizeDateFormatPreference,
    normalizeTimeFormatPreference,
} from "@wildgrove/core/app-datetime-format"
import { dateHasBookableTimeSlot, parseOperatingDays, type ClosedTimeRange } from "@wildgrove/core/reservation-schedule"
import { limaMaxBookableDateIso } from "@wildgrove/core/reservation-dates-lima"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"
import {
    CalendarBandIcon,
    CalendarDaysIcon,
    CheckIcon,
    ClockRightAngleIcon,
    CloseIcon,
    PencilIcon,
    Spinner,
    StarOutlineIcon,
    StarSharpIcon,
    TrashIcon,
    UsersIcon,
} from "@wildgrove/ui/icons"

interface ReservationEntry {
    id: string
    date: string
    partySize: number
    notes: string | null
    nickname: string | null
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
    createdAt: string
    hasReview: boolean
}

type LoadingState = "loading" | "loaded" | "error"

export interface ReservationHistoryHandle {
    refresh: () => void
}

/** The booking settings the page already reads, so rescheduling offers what the booking form offers. */
export interface ReservationSchedule {
    advanceNoticeMs: number
    timeSlotIncrement: number
    operatingDays: string
    openingTime: string
    closingTime: string
    maxDaysAhead: number
    closedTimeRanges: ClosedTimeRange[]
    maxPartySize: number
    largeGroupWarningFrom: number
}

function getMinDate(advanceNoticeMs = 0): string {
    return new Date(Date.now() + advanceNoticeMs).toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

function getLocalDateStr(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

function getLocalTimeStr(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Lima",
    })
}

export const ReservationHistory = forwardRef<ReservationHistoryHandle, { schedule: ReservationSchedule }>(
    function ReservationHistory({ schedule }, ref) {
        // Only one reservation is rescheduled at a time, so one set of ids.
        const rescheduleFieldId = useId()
        const t = useTranslations("reservationHistory")
        const locale = useLocale()

        const STATUS_CONFIG = {
            PENDING: {
                label: t("statusPending"),
                bg: "bg-amber-100 dark:bg-amber-900/40",
                text: "text-amber-700 dark:text-amber-300",
                border: "border-l-amber-400 dark:border-l-amber-500",
            },
            CONFIRMED: {
                label: t("statusConfirmed"),
                bg: "bg-emerald-100 dark:bg-emerald-900/40",
                text: "text-emerald-700 dark:text-emerald-300",
                border: "border-l-emerald-500 dark:border-l-emerald-400",
            },
            CANCELLED: {
                label: t("statusCancelled"),
                bg: "bg-red-100 dark:bg-red-900/40",
                text: "text-red-700 dark:text-red-300",
                border: "border-l-red-400 dark:border-l-red-500",
            },
            COMPLETED: {
                label: t("statusCompleted"),
                bg: "bg-gray-100 dark:bg-gray-800/40",
                text: "text-gray-600 dark:text-gray-400",
                border: "border-l-gray-400 dark:border-l-gray-500",
            },
        } as const

        const [entries, setEntries] = useState<ReservationEntry[]>([])
        const [loadingState, setLoadingState] = useState<LoadingState | "unauthenticated">("loading")
        const [highlightedId, setHighlightedId] = useState<string | null>(null)
        const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
            try {
                const stored = localStorage.getItem("wg:hidden-reservations")
                return new Set(stored ? JSON.parse(stored) : [])
            } catch { return new Set() }
        })

        // ── Rename state ──────────────────────────────────────────
        const [renamingId, setRenamingId] = useState<string | null>(null)
        const [renameDraft, setRenameDraft] = useState("")
        const [renameLoading, setRenameLoading] = useState(false)

        // ── Cancel state ─────────────────────────────────────────
        const [confirmCancel, setConfirmCancel] = useState<string | null>(null)
        const [cancelLoading, setCancelLoading] = useState<string | null>(null)

        // ── Delete from history state ─────────────────────────────
        const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

        // ── Review state (COMPLETED only) ────────────────────────
        const [reviewingId, setReviewingId] = useState<string | null>(null)
        const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
        const [maxReviewPhotos, setMaxReviewPhotos] = useState(0)
        const [reviewsEnabled, setReviewsEnabled] = useState(true)

        // ── Reschedule state (PENDING only) ───────────────────────
        const [reschedulingId, setReschedulingId] = useState<string | null>(null)
        const [rescheduleDate, setRescheduleDate] = useState("")
        const [rescheduleTime, setRescheduleTime] = useState("")
        const [reschedulePartySize, setReschedulePartySize] = useState(2)
        const [rescheduleLoading, setRescheduleLoading] = useState(false)
        const [rescheduleError, setRescheduleError] = useState("")
        const { advanceNoticeMs } = schedule
        const enabledWeekdays = useMemo(() => parseOperatingDays(schedule.operatingDays), [schedule.operatingDays])
        const maxRescheduleDate = useMemo(() => limaMaxBookableDateIso(schedule.maxDaysAhead), [schedule.maxDaysAhead])
        const [displayDateFormat, setDisplayDateFormat] = useState("DD/MM/YYYY")
        const [displayTimeFormat, setDisplayTimeFormat] = useState("24h")


        // ── Fetch ─────────────────────────────────────────────────
        const fetchHistory = useCallback(async () => {
            try {
                const res = await fetch("/api/reservations/history")
                if (res.status === 401) {
                    setLoadingState("unauthenticated")
                    return
                }
                const json = await res.json()
                if (json.success) {
                    setEntries(json.data)
                    setLoadingState("loaded")
                } else {
                    setLoadingState("error")
                }
            } catch {
                setLoadingState("error")
            }
        }, [])

        useImperativeHandle(ref, () => ({ refresh: fetchHistory }), [fetchHistory])

        useEffect(() => { fetchHistory() }, [fetchHistory])

        useEffect(() => {
            fetch("/api/reviews/config")
                .then((r) => r.json())
                .then((d) => {
                    setMaxReviewPhotos(d.maxPhotos ?? 0)
                    setReviewsEnabled(d.reviewsEnabled ?? true)
                })
                .catch(() => {})
        }, [])

        useEffect(() => {
            fetch("/api/reservation-config")
                .then((r) => r.json())
                .then((d) => {
                    if (typeof d.dateFormat === "string") setDisplayDateFormat(normalizeDateFormatPreference(d.dateFormat))
                    if (typeof d.timeFormat === "string") setDisplayTimeFormat(normalizeTimeFormatPreference(d.timeFormat))
                })
                .catch(() => {})
        }, [])

        const rescheduleDateHasBookableSlot = useCallback(
            (iso: string) =>
                dateHasBookableTimeSlot(iso, {
                    advanceNoticeMs,
                    openingTime: schedule.openingTime,
                    closingTime: schedule.closingTime,
                    timeSlotIncrement: schedule.timeSlotIncrement,
                    operatingDays: enabledWeekdays,
                    closedTimeRanges: schedule.closedTimeRanges,
                }),
            [advanceNoticeMs, enabledWeekdays, schedule.openingTime, schedule.closingTime, schedule.timeSlotIncrement, schedule.closedTimeRanges],
        )

        // Listen for new reservations created from the form
        useEffect(() => {
            const handler = () => { fetchHistory() }
            window.addEventListener("reservation:created", handler)
            return () => window.removeEventListener("reservation:created", handler)
        }, [fetchHistory])

        // Listen for open request (e.g. from "Ver esta reserva" button in chat)
        useEffect(() => {
            const handler = (e: Event) => {
                const id = (e as CustomEvent<{ id?: string }>).detail?.id
                if (id) {
                    setHighlightedId(id)
                    setTimeout(() => setHighlightedId(null), 3000)
                    setTimeout(() => {
                        document.getElementById(`reservation-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }, 50)
                }
            }
            window.addEventListener("reservation:openHistory", handler)
            return () => window.removeEventListener("reservation:openHistory", handler)
        }, [])

        // Scroll once the list is on screen. A fresh visit with #reservation-{id}
        // arrives before the fetch, so this waits until the cards exist.
        useEffect(() => {
            if (loadingState !== "loaded") return
            const hash = window.location.hash
            if (!hash.startsWith("#reservation-")) return
            const id = hash.slice("#reservation-".length)
            setHighlightedId(id)
            const clearHighlight = setTimeout(() => setHighlightedId(null), 3000)
            const scroll = setTimeout(() => {
                document.getElementById(`reservation-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 50)
            return () => {
                clearTimeout(clearHighlight)
                clearTimeout(scroll)
            }
        }, [loadingState])

        // ── Polling: auto-refresh every 20s while this page is open ──
        useEffect(() => {
            if (loadingState === "unauthenticated") return
            const interval = setInterval(() => { fetchHistory() }, 20_000)
            return () => clearInterval(interval)
        }, [loadingState, fetchHistory])

        // ── Hide (remove from history view) ──────────────────────
        // Marks hiddenByUser=true in DB (admin still sees it).
        // localStorage is kept as a fallback for instant local UI response.
        function hideEntry(id: string) {
            setHiddenIds(prev => {
                const next = new Set(prev)
                next.add(id)
                try { localStorage.setItem("wg:hidden-reservations", JSON.stringify([...next])) } catch { /* ignore */ }
                return next
            })
            setConfirmDelete(null)
            fetch(`/api/reservations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "hide" }),
            }).catch((err) => console.error("[ReservationHistory] hide error:", err))
        }

        // ── Rename handlers ───────────────────────────────────────
        function openRename(entry: ReservationEntry) {
            setRenamingId(entry.id)
            setRenameDraft(entry.nickname ?? "")
        }

        async function submitRename(id: string) {
            setRenameLoading(true)
            const nickname = renameDraft.trim() || null
            try {
                await fetch(`/api/reservations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "rename", nickname }),
                })
                setEntries(prev => prev.map(e => e.id === id ? { ...e, nickname } : e))
            } finally {
                setRenameLoading(false)
                setRenamingId(null)
            }
        }

        // ── Cancel handlers ───────────────────────────────────────
        async function handleCancelConfirm(id: string) {
            setCancelLoading(id)
            try {
                const res = await fetch(`/api/reservations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-locale": locale },
                    body: JSON.stringify({ action: "cancel" }),
                })
                const json = await res.json()
                if (json.success) {
                    setEntries(prev =>
                        prev.map(e => e.id === id ? { ...e, status: "CANCELLED" } : e)
                    )
                    setConfirmCancel(null)
                }
            } finally {
                setCancelLoading(null)
            }
        }

        // ── Reschedule handlers (PENDING only) ────────────────────
        function openReschedule(entry: ReservationEntry) {
            setConfirmCancel(null)
            setConfirmDelete(null)
            setReschedulingId(entry.id)
            setRescheduleDate(getLocalDateStr(entry.date))
            setRescheduleTime(getLocalTimeStr(entry.date))
            setReschedulePartySize(entry.partySize)
            setRescheduleError("")
        }

        function closeReschedule() {
            setReschedulingId(null)
            setRescheduleDate("")
            setRescheduleTime("")
            setReschedulePartySize(2)
            setRescheduleError("")
        }

        async function handleRescheduleSubmit(id: string) {
            if (!rescheduleDate || !rescheduleTime) {
                setRescheduleError(t("selectDateTime"))
                return
            }
            setRescheduleLoading(true)
            setRescheduleError("")
            try {
                const res = await fetch(`/api/reservations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "x-locale": locale },
                    body: JSON.stringify({ action: "reschedule", date: rescheduleDate, time: rescheduleTime, partySize: reschedulePartySize }),
                })
                const json = await res.json()
                if (json.success) {
                    const newDate = limaSlotStart(rescheduleDate, rescheduleTime).toISOString()
                    setEntries(prev =>
                        prev.map(e => e.id === id ? { ...e, date: newDate, partySize: reschedulePartySize, status: "PENDING" } : e)
                    )
                    closeReschedule()
                } else {
                    setRescheduleError(json.error || t("rescheduleError"))
                }
            } catch {
                setRescheduleError(t("connectionError"))
            } finally {
                setRescheduleLoading(false)
            }
        }


        if (loadingState === "unauthenticated") return null

        const visibleEntries = entries.filter(e => !hiddenIds.has(e.id))

        return (
            <div id="my-reservations" className="space-y-3">
                            {/* Loading skeleton */}
                            {loadingState === "loading" && (
                                <>
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="rounded-card border border-wg-border/50 dark:border-wg-dark-border p-5 animate-pulse">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-2">
                                                    <div className="h-4 w-48 bg-wg-border/50 dark:bg-wg-dark-border rounded" />
                                                    <div className="h-3 w-32 bg-wg-border/30 dark:bg-wg-dark-border/50 rounded" />
                                                </div>
                                                <div className="h-6 w-20 bg-wg-border/40 dark:bg-wg-dark-border/60 rounded-full" />
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Error */}
                            {loadingState === "error" && (
                                <div className="text-center py-6">
                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                                        {t("errorLoad")}
                                    </p>
                                </div>
                            )}

                            {/* Empty state */}
                            {loadingState === "loaded" && visibleEntries.length === 0 && (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-wg-primary/5 dark:bg-wg-dark-primary/10 flex items-center justify-center">
                                        <CalendarDaysIcon className="w-6 h-6 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                                    </div>
                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-3">
                                        {t("empty")}
                                    </p>
                                    <Link
                                        href="/reservations"
                                        className="inline-flex text-sm font-medium text-wg-accent dark:text-wg-dark-accent hover:underline"
                                    >
                                        {t("emptyCta")}
                                    </Link>
                                </div>
                            )}

                            {/* Entries */}
                            {loadingState === "loaded" && visibleEntries.map((entry) => {
                                const cfg = STATUS_CONFIG[entry.status]
                                const isPending = entry.status === "PENDING"
                                const isCompleted = entry.status === "COMPLETED"
                                const isCancelConfirm = confirmCancel === entry.id
                                const isRescheduling = reschedulingId === entry.id
                                const isReviewing = reviewingId === entry.id
                                const isConfirmDelete = confirmDelete === entry.id
                                const isRenaming = renamingId === entry.id
                                const alreadyReviewed = entry.hasReview || reviewedIds.has(entry.id)

                                const originalDate = getLocalDateStr(entry.date)
                                const originalTime = getLocalTimeStr(entry.date)
                                const rescheduleHasChanges =
                                    rescheduleDate !== originalDate ||
                                    rescheduleTime !== originalTime ||
                                    reschedulePartySize !== entry.partySize

                                const isHighlighted = highlightedId === entry.id
                                return (
                                    <div
                                        key={entry.id}
                                        id={`reservation-${entry.id}`}
                                        className={`rounded-card border-l-4 ${cfg.border} border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface transition-all duration-300 hover:shadow-card dark:hover:shadow-glow-sm ${
                                            isHighlighted ? "outline outline-2 outline-wg-accent dark:outline-wg-dark-accent" : ""
                                        }`}
                                    >
                                        {/* Main info */}
                                        <div className="p-5">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div className="space-y-1">
                                                    {/* Nickname / rename row */}
                                                    {isRenaming ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                autoFocus
                                                                value={renameDraft}
                                                                onChange={(e) => setRenameDraft(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") submitRename(entry.id)
                                                                    if (e.key === "Escape") setRenamingId(null)
                                                                }}
                                                                maxLength={60}
                                                                aria-label={t("renamePlaceholder")}
                                                                placeholder={t("renamePlaceholder")}
                                                                className="text-sm font-medium px-2 py-0.5 rounded-brand border border-wg-primary/40 dark:border-wg-dark-primary/40 bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text outline-none focus:border-wg-primary dark:focus:border-wg-dark-primary w-44"
                                                            />
                                                            <button
                                                                onClick={() => submitRename(entry.id)}
                                                                disabled={renameLoading}
                                                                className="p-1 rounded-brand bg-wg-primary/10 dark:bg-wg-dark-primary/10 text-wg-primary dark:text-wg-dark-primary hover:bg-wg-primary/20 transition disabled:opacity-50"
                                                                aria-label={t("renameSave")}
                                                            >
                                                                <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                            </button>
                                                            <button
                                                                onClick={() => setRenamingId(null)}
                                                                className="p-1 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition"
                                                                aria-label={t("cancel")}
                                                            >
                                                                <CloseIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 group">
                                                            <p className="font-medium text-wg-text dark:text-wg-dark-text">
                                                                {entry.nickname || (locale === "es" ? "Reserva" : "Reservation")}
                                                            </p>
                                                            <button
                                                                onClick={() => openRename(entry)}
                                                                className="shrink-0 p-0.5 rounded transition-opacity opacity-40 hover:opacity-100 text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary"
                                                                aria-label={t("renameTitle")}
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <p className="font-medium text-wg-text dark:text-wg-dark-text">
                                                        {formatAppDateFromIso(entry.date, displayDateFormat)}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-sm text-wg-muted dark:text-wg-dark-muted">
                                                        <span className="flex items-center gap-1">
                                                            <ClockRightAngleIcon className="w-3.5 h-3.5" />
                                                            {formatAppTimeFromIso(entry.date, displayTimeFormat)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <UsersIcon className="w-3.5 h-3.5" />
                                                            {entry.partySize} {entry.partySize === 1 ? t("guest") : t("guests")}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Status badge + trash icon for cancelled */}
                                                <div className="flex items-center gap-2 self-start">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                                                        {cfg.label}
                                                    </span>
                                                    {entry.status === "CANCELLED" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDelete(isConfirmDelete ? null : entry.id)}
                                                            className={`p-1.5 rounded-brand transition-colors ${isConfirmDelete
                                                                ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                                                                : "text-wg-muted/50 dark:text-wg-dark-muted/50 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                }`}
                                                            title={t("removeTitle")}
                                                            aria-label={t("removeTitle")}
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {entry.notes && (
                                                <p className="mt-3 text-sm text-wg-muted dark:text-wg-dark-muted italic border-t border-wg-border/30 dark:border-wg-dark-border/50 pt-3">
                                                    {entry.notes}
                                                </p>
                                            )}

                                            {/* Delete confirmation */}
                                            {isConfirmDelete && (
                                                <div className="mt-3 pt-3 border-t border-wg-border/30 dark:border-wg-dark-border/50">
                                                    <p className="text-xs font-medium text-wg-text dark:text-wg-dark-text mb-0.5">{t("removeConfirm")}</p>
                                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 leading-relaxed">
                                                        {t("removeDescription")}
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => hideEntry(entry.id)}
                                                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-brand bg-red-600 hover:bg-red-700 text-white transition"
                                                        >
                                                            {t("removeYes")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDelete(null)}
                                                            className="text-xs font-medium px-3 py-1.5 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition"
                                                        >
                                                            {t("keep")}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── PENDING: Reschedule + Cancel buttons ── */}
                                            {isPending && !isRescheduling && (
                                                <div className={`flex items-center gap-2 pt-3 ${entry.notes ? "mt-0" : "mt-3"} border-t border-wg-border/30 dark:border-wg-dark-border/50`}>
                                                    {!isCancelConfirm ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openReschedule(entry)}
                                                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition"
                                                            >
                                                                <CalendarBandIcon className="w-3.5 h-3.5" />
                                                                {t("reschedule")}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setConfirmCancel(entry.id); setReschedulingId(null) }}
                                                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-brand border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                                            >
                                                                <CloseIcon className="w-3.5 h-3.5" />
                                                                {t("cancel")}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        /* Cancel confirmation */
                                                        <div className="flex items-center gap-2 flex-wrap w-full">
                                                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mr-auto">
                                                                {t("cancelConfirm")}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCancelConfirm(entry.id)}
                                                                disabled={cancelLoading === entry.id}
                                                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-brand bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60"
                                                            >
                                                                {cancelLoading === entry.id && (
                                                                    <Spinner className="animate-spin w-3.5 h-3.5" />
                                                                )}
                                                                {t("cancelYes")}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmCancel(null)}
                                                                className="text-xs font-medium px-3 py-1.5 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition"
                                                            >
                                                                {t("keep")}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── COMPLETED: Rate button ── */}
                                            {isCompleted && reviewsEnabled && (
                                                <div className={`flex items-center gap-2 pt-3 ${entry.notes ? "mt-0" : "mt-3"} border-t border-wg-border/30 dark:border-wg-dark-border/50`}>
                                                    {alreadyReviewed ? (
                                                        <span className="flex items-center gap-1.5 text-xs text-wg-muted dark:text-wg-dark-muted">
                                                            <StarSharpIcon className="w-3.5 h-3.5 text-amber-400" />
                                                            {t("alreadyReviewed")}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setReviewingId(isReviewing ? null : entry.id)}
                                                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-brand border transition ${
                                                                isReviewing
                                                                    ? "border-wg-primary/40 dark:border-wg-dark-primary/40 bg-wg-primary/5 dark:bg-wg-dark-primary/10 text-wg-primary dark:text-wg-dark-primary"
                                                                    : "border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-surface dark:hover:bg-wg-dark-surface"
                                                            }`}
                                                        >
                                                            <StarOutlineIcon className="w-3.5 h-3.5" />
                                                            {isReviewing ? t("closeReview") : t("rate")}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                        </div>

                                        {/* ── Review form panel (COMPLETED) ── */}
                                        {isReviewing && reviewsEnabled && (
                                            <div className="border-t border-wg-border/40 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface px-5 py-4 rounded-b-card">
                                                <ReviewForm
                                                    reservationId={entry.id}
                                                    maxPhotos={maxReviewPhotos}
                                                    onSuccess={() => {
                                                        setReviewedIds(prev => new Set([...prev, entry.id]))
                                                        setTimeout(() => setReviewingId(null), 2500)
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* ── Reschedule picker panel (PENDING) ── */}
                                        {isRescheduling && (
                                            <div className="border-t border-wg-border/40 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface px-5 py-4 rounded-b-card space-y-4">
                                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                                    {t("pickNewDateTime")}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label id={`${rescheduleFieldId}-date-label`} htmlFor={`${rescheduleFieldId}-date`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">{t("dateLabel")}</label>
                                                        <DatePicker
                                                            id={`${rescheduleFieldId}-date`}
                                                            labelledBy={`${rescheduleFieldId}-date-label`}
                                                            value={rescheduleDate}
                                                            min={getMinDate(advanceNoticeMs)}
                                                            max={maxRescheduleDate}
                                                            enabledWeekdays={enabledWeekdays}
                                                            hasBookableSlot={rescheduleDateHasBookableSlot}
                                                            onChange={(d) => { setRescheduleDate(d); setRescheduleTime("") }}
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label id={`${rescheduleFieldId}-time-label`} htmlFor={`${rescheduleFieldId}-time`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">{t("timeLabel")}</label>
                                                        <TimePicker
                                                            id={`${rescheduleFieldId}-time`}
                                                            labelledBy={`${rescheduleFieldId}-time-label`}
                                                            value={rescheduleTime}
                                                            onChange={setRescheduleTime}
                                                            selectedDate={rescheduleDate}
                                                            advanceNoticeMs={advanceNoticeMs}
                                                            openingTime={schedule.openingTime}
                                                            closingTime={schedule.closingTime}
                                                            timeSlotIncrement={schedule.timeSlotIncrement}
                                                            enabledWeekdays={enabledWeekdays}
                                                            closedTimeRanges={schedule.closedTimeRanges}
                                                            required
                                                            displayTimeFormat={normalizeTimeFormatPreference(displayTimeFormat)}
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label id={`${rescheduleFieldId}-guests-label`} htmlFor={`${rescheduleFieldId}-guests`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-1.5">{t("guestsLabel")}</label>
                                                    <GuestsPicker
                                                        id={`${rescheduleFieldId}-guests`}
                                                        labelledBy={`${rescheduleFieldId}-guests-label`}
                                                        value={reschedulePartySize}
                                                        onChange={setReschedulePartySize}
                                                        maxGuests={schedule.maxPartySize}
                                                        largeGroupWarningFrom={schedule.largeGroupWarningFrom}
                                                    />
                                                </div>

                                                {rescheduleError && (
                                                    <p className="text-xs text-red-600 dark:text-red-400">{rescheduleError}</p>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRescheduleSubmit(entry.id)}
                                                        disabled={rescheduleLoading || !rescheduleDate || !rescheduleTime || !rescheduleHasChanges}
                                                        className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {rescheduleLoading && (
                                                            <Spinner className="animate-spin w-3.5 h-3.5" />
                                                        )}
                                                        {t("confirmReschedule")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={closeReschedule}
                                                        className="text-xs font-medium px-4 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition"
                                                    >
                                                        {t("cancel")}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                )
                            })}
            </div>
        )
    }
)
