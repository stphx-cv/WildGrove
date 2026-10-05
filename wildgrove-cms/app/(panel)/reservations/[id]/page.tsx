"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Reservation Detail Page — /reservations/[id]
// View + edit reservation fields, change status, delete
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@wildgrove/core/clients/client"
import {
    adminReservationDetailChannel,
    ADMIN_RESERVATION_UPDATED_EVENT,
} from "@wildgrove/core/admin/reservationsRealtimeShared"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { AdminSelect } from "@/components/AdminSelect"
import { AdminDatePicker } from "@/components/AdminDatePicker"
import { AdminTimePicker } from "@/components/AdminTimePicker"
import { AdminGuestsPicker } from "@/components/AdminGuestsPicker"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { LoadingState } from "@/components/LoadingState"
import { Textarea } from "@wildgrove/ui/Textarea"
import { useCmsQuery } from "@/lib/cms-query"
import { APP_DATETIME_TIMEZONE } from "@wildgrove/core/app-datetime-format"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"
import { generateTimeSlots, parseClosedTimeRanges } from "@wildgrove/core/reservation-schedule"
import { nextReservationStatuses } from "@wildgrove/core/reservation-status"
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    CheckIcon,
    CloseIcon,
    EyeIcon,
    EyeSlashIcon,
    PencilSquareIcon,
    SpinnerThinIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

interface ReservationDetail {
    id: string
    date: string
    partySize: number
    notes: string | null
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
    remindedAt: string | null
    hiddenByAdmin: boolean
    createdAt: string
    updatedAt: string
    profile: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
        phoneCountryCode: string | null
        phoneNumber: string | null
        avatarUrl: string | null
    }
}

/** The booking hours from the panel settings, for the time picker. */
interface ScheduleSettings {
    openingTime?: string
    closingTime?: string
    timeSlotIncrement?: number
    closedTimeRanges?: unknown
}

/** The Lima wall-clock time of a stored instant, as HH:MM. */
function limaTimeOf(instant: string): string {
    return new Date(instant).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: APP_DATETIME_TIMEZONE,
    })
}

const STATUS_OPTIONS = [
    { value: "PENDING", label: "Pending", icon: <span className="w-2 h-2 rounded-full bg-amber-400" /> },
    { value: "CONFIRMED", label: "Confirmed", icon: <span className="w-2 h-2 rounded-full bg-emerald-400" /> },
    { value: "CANCELLED", label: "Cancelled", icon: <span className="w-2 h-2 rounded-full bg-red-400" /> },
    { value: "COMPLETED", label: "Completed", icon: <span className="w-2 h-2 rounded-full bg-blue-400" /> },
]

const inputCls =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border " +
    "bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text " +
    "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 " +
    "focus:outline-none focus:ring-2 focus:ring-wg-accent/30 focus:border-wg-accent dark:focus:border-wg-dark-accent " +
    "transition-all"

const labelCls = "block text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-1.5"

function formatPhone(countryCode: string | null, number: string | null): string | null {
    if (!number) return null
    const code = countryCode ? countryCode.replace(/^\+/, "") : null
    return code ? `(+${code}) ${number}` : number
}

function getInitials(firstName: string | null, lastName: string | null): string {
    const f = firstName?.[0] ?? ""
    const l = lastName?.[0] ?? ""
    return (f + l).toUpperCase() || "?"
}

// ── Detail row used in the right column card ──
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-3 border-b border-wg-border/30 dark:border-wg-dark-border last:border-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted shrink-0 pt-0.5">
                {label}
            </span>
            <span className="text-sm text-wg-text dark:text-wg-dark-text text-right tabular-nums">
                {value}
            </span>
        </div>
    )
}

export default function AdminReservationDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const { formatDate, formatTime } = useAdminAppDateTime()
    const [reservation, setReservation] = useState<ReservationDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    // Shared with every other `/api/role` reader in the panel: one request.
    const { data: roleData } = useCmsQuery<{ role?: "ADMIN" | "OWNER" }>("/api/role")
    const adminRole = roleData?.role ?? "ADMIN"
    const { data: scheduleSettings } = useCmsQuery<ScheduleSettings>("/api/settings")

    // ── Edit state ──
    const [isEditing, setIsEditing] = useState(false)
    const [editDateOnly, setEditDateOnly] = useState("")
    const [editTime, setEditTime] = useState("")
    const [editPartySize, setEditPartySize] = useState(2)
    const [editNotes, setEditNotes] = useState("")
    const [editStatus, setEditStatus] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")

    // ── Delete state ──
    const [showDelete, setShowDelete] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // ── Hide from queue ──
    const [isHiding, setIsHiding] = useState(false)
    const [hideError, setHideError] = useState<string | null>(null)

    // ── Status quick-action state (non-edit mode) ──
    const [actionTarget, setActionTarget] = useState<string | null>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const [statusError, setStatusError] = useState<string | null>(null)
    const [customerUpdatedBanner, setCustomerUpdatedBanner] = useState(false)
    const isEditingRef = useRef(false)

    useEffect(() => {
        isEditingRef.current = isEditing
    }, [isEditing])

    const fetchReservation = useCallback(async (options?: { silent?: boolean }) => {
        if (!options?.silent) setIsLoading(true)
        try {
            const res = await fetch(`/api/reservations/${id}`)
            const json = await res.json()
            if (json.success) {
                setReservation((prev) => {
                    if (prev && options?.silent && prev.updatedAt !== json.data.updatedAt) {
                        const hideOnly =
                            prev.hiddenByAdmin !== json.data.hiddenByAdmin &&
                            prev.date === json.data.date &&
                            prev.status === json.data.status &&
                            prev.partySize === json.data.partySize &&
                            prev.notes === json.data.notes
                        if (!hideOnly) setCustomerUpdatedBanner(true)
                    }
                    return json.data
                })
                window.dispatchEvent(new CustomEvent("admin:reservation-viewed"))
            }
        } catch (error) {
            console.error("Failed to fetch reservation:", error)
        } finally {
            if (!options?.silent) setIsLoading(false)
        }
    }, [id])

    useEffect(() => { fetchReservation() }, [fetchReservation])

    // The booking grid from the settings, plus the reservation's own time when
    // it falls off the grid. Until the settings load, the picker's fixed grid.
    const reservationDate = reservation?.date
    const timeSlotOptions = useMemo(() => {
        if (!scheduleSettings?.openingTime || !scheduleSettings.closingTime || !scheduleSettings.timeSlotIncrement) {
            return undefined
        }
        const slots = generateTimeSlots(
            scheduleSettings.openingTime,
            scheduleSettings.closingTime,
            scheduleSettings.timeSlotIncrement,
            parseClosedTimeRanges(scheduleSettings.closedTimeRanges),
        )
        const current = reservationDate ? limaTimeOf(reservationDate) : null
        if (!current || slots.includes(current)) return slots
        return [...slots, current].sort((a, b) => a.localeCompare(b))
    }, [scheduleSettings, reservationDate])

    useEffect(() => {
        const insforge = createClient()
        const channel = insforge.channel(adminReservationDetailChannel(id))
        channel
            .on("broadcast", { event: ADMIN_RESERVATION_UPDATED_EVENT }, () => {
                fetchReservation({ silent: true })
            })
            .subscribe()
        return () => { insforge.removeChannel(channel) }
    }, [id, fetchReservation])

    const enterEditMode = useCallback(() => {
        if (!reservation) return
        // The form edits the Lima date and time, whatever timezone the browser is in.
        const dt = new Date(reservation.date)
        setEditDateOnly(dt.toLocaleDateString("en-CA", { timeZone: APP_DATETIME_TIMEZONE }))
        setEditTime(limaTimeOf(reservation.date))
        setEditPartySize(reservation.partySize)
        setEditNotes(reservation.notes ?? "")
        setEditStatus(reservation.status)
        setSaveError("")
        setIsEditing(true)
    }, [reservation])

    const cancelEdit = useCallback(() => {
        setIsEditing(false)
        setSaveError("")
    }, [])

    const handleSave = useCallback(async () => {
        if (!reservation) return
        setIsSaving(true)
        setSaveError("")

        try {
            const body: Record<string, unknown> = {}

            const editDt = limaSlotStart(editDateOnly, editTime || "00:00")
            const origDt = new Date(reservation.date)
            if (editDt.getTime() !== origDt.getTime()) {
                body.date = editDt.toISOString()
            }

            if (editPartySize !== reservation.partySize) {
                body.partySize = editPartySize
            }

            if (adminRole === "OWNER") {
                const newNotes = editNotes.trim() || null
                if (newNotes !== (reservation.notes ?? null)) {
                    body.notes = newNotes
                }
            }
            if (editStatus !== reservation.status) {
                body.status = editStatus
            }

            if (Object.keys(body).length === 0) {
                setIsEditing(false)
                return
            }

            const res = await fetch(`/api/reservations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            const json = await res.json()
            if (json.success) {
                setReservation(json.data)
                setIsEditing(false)
            } else {
                setSaveError(json.error || "Failed to save changes")
            }
        } catch {
            setSaveError("Network error — please try again")
        } finally {
            setIsSaving(false)
        }
    }, [reservation, id, editDateOnly, editTime, editPartySize, editNotes, editStatus, adminRole])

    const handleStatusUpdate = useCallback(async () => {
        if (!actionTarget) return
        setIsUpdating(true)
        setStatusError(null)
        try {
            const res = await fetch(`/api/reservations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: actionTarget }),
            })
            const json = await res.json()
            if (json.success) {
                setReservation(json.data)
                setActionTarget(null)
            } else {
                // The dialog stays open with the server's reason.
                setStatusError(json.error || "Failed to update the status")
            }
        } catch (error) {
            console.error("Status update failed:", error)
            setStatusError("Network error — please try again")
        } finally {
            setIsUpdating(false)
        }
    }, [actionTarget, id])

    const handleDelete = useCallback(async () => {
        setIsDeleting(true)
        setDeleteError(null)
        try {
            const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" })
            const json = await res.json()
            if (json.success) {
                router.push("/reservations")
            } else {
                setDeleteError(json.error || "Failed to delete the reservation")
            }
        } catch (error) {
            console.error("Delete failed:", error)
            setDeleteError("Network error — please try again")
        } finally {
            setIsDeleting(false)
        }
    }, [id, router])

    const handleToggleHidden = useCallback(async () => {
        if (!reservation) return
        setIsHiding(true)
        setHideError(null)
        try {
            const res = await fetch(`/api/reservations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hiddenByAdmin: !reservation.hiddenByAdmin }),
            })
            const json = await res.json()
            if (json.success) {
                setReservation((prev) => prev ? { ...prev, ...json.data } : json.data)
            } else {
                setHideError(json.error || "Failed to change the queue visibility")
            }
        } catch (error) {
            console.error("Failed to toggle reservation visibility:", error)
            setHideError("Network error — please try again")
        } finally {
            setIsHiding(false)
        }
    }, [id, reservation])

    // ── Loading skeleton ──
    if (isLoading) {
        return (
            <LoadingState size="page" message="Loading reservation…" />
        )
    }

    if (!reservation) {
        return (
            <div className="text-center py-12">
                <p className="text-wg-muted dark:text-wg-dark-muted">Reservation not found</p>
            </div>
        )
    }

    const dt = new Date(reservation.date)
    const allowedActions = nextReservationStatuses(reservation.status)
    const allowedStatusOptions = STATUS_OPTIONS.filter(
        opt => opt.value === reservation.status || allowedActions.some(s => s === opt.value)
    )
    const phone = formatPhone(reservation.profile?.phoneCountryCode, reservation.profile?.phoneNumber)
    const fullName = [reservation.profile?.firstName, reservation.profile?.lastName].filter(Boolean).join(" ")
    const initials = getInitials(reservation.profile?.firstName ?? null, reservation.profile?.lastName ?? null)
    const refCode = `#${id.slice(-8).toUpperCase()}`

    // ── Edit mode: wide 2-column layout ──
    if (isEditing) {
        return (
            <div className="max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={cancelEdit}
                        className="p-2 rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                                Edit Reservation
                            </h1>
                            <span className="text-xs font-mono text-wg-muted dark:text-wg-dark-muted bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                                {refCode}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <StatusBadge status={reservation.status} />
                        {reservation.hiddenByAdmin && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-wg-muted dark:text-wg-dark-muted bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                                <EyeSlashIcon className="w-3.5 h-3.5" aria-hidden />
                                Hidden from queue
                            </span>
                        )}
                    </div>
                </div>

                {/* Body: 2-column grid */}
                <div className="grid lg:grid-cols-3 gap-6 items-start">

                    {/* LEFT: Customer + Edit Form */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Customer card (read-only) */}
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                    Customer
                                </h2>
                            </div>
                            <div className="px-5 py-4 flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-wg-accent/15 dark:bg-wg-dark-accent/20 flex items-center justify-center">
                                    {reservation.profile?.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={reservation.profile.avatarUrl}
                                            alt={fullName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-wg-accent dark:text-wg-dark-accent">{initials}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-3">
                                    <p className="text-base font-semibold text-wg-text dark:text-wg-dark-text">{fullName}</p>
                                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                                        {reservation.profile?.email && (
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-0.5">Email</p>
                                                <a
                                                    href={`mailto:${reservation.profile.email}`}
                                                    className="text-sm text-wg-accent dark:text-wg-dark-accent hover:underline truncate block"
                                                >
                                                    {reservation.profile.email}
                                                </a>
                                            </div>
                                        )}
                                        {phone && (
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-0.5">Phone</p>
                                                <a
                                                    href={`tel:${reservation.profile?.phoneCountryCode}${reservation.profile?.phoneNumber}`}
                                                    className="text-sm text-wg-text dark:text-wg-dark-text tabular-nums hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors"
                                                >
                                                    {phone}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Edit form card */}
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                    Reservation Details
                                </h2>
                            </div>
                            <div className="px-5 py-5 space-y-5">
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Date</label>
                                        <AdminDatePicker
                                            value={editDateOnly}
                                            onChange={setEditDateOnly}
                                            mode="date"
                                            placeholder="Select date…"
                                            nullable={false}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Time</label>
                                        <AdminTimePicker
                                            value={editTime}
                                            onChange={setEditTime}
                                            slotOptions={timeSlotOptions}
                                        />
                                    </div>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Party Size</label>
                                        <AdminGuestsPicker
                                            value={editPartySize}
                                            onChange={setEditPartySize}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Status</label>
                                        <AdminSelect
                                            value={editStatus}
                                            required
                                            onChange={setEditStatus}
                                            options={allowedStatusOptions}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>
                                        Notes
                                        {adminRole !== "OWNER" && (
                                            <span className="ml-2 normal-case font-normal tracking-normal text-wg-muted/60 dark:text-wg-dark-muted/60">
                                                — owner only
                                            </span>
                                        )}
                                    </label>
                                    {adminRole === "OWNER" ? (
                                        <Textarea
                                            maxHeight={240}
                                            value={editNotes}
                                            onChange={setEditNotes}
                                            minRows={4}
                                            placeholder="Optional notes..."
                                            className={inputCls}
                                        />
                                    ) : (
                                        <div className={`${inputCls} min-h-[100px] opacity-60 cursor-not-allowed select-text`}>
                                            {editNotes || <span className="text-wg-muted/40 dark:text-wg-dark-muted/40 italic">No notes</span>}
                                        </div>
                                    )}
                                </div>

                                {saveError && (
                                    <p className="text-sm text-red-500 dark:text-red-400">{saveError}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Metadata + Save/Cancel */}
                    <div className="space-y-5">

                        {/* Metadata card */}
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                    Info
                                </h2>
                            </div>
                            <div className="px-5 py-1">
                                <DetailRow
                                    label="Created"
                                    value={`${formatDate(reservation.createdAt)} · ${formatTime(reservation.createdAt)}`}
                                />
                                <DetailRow
                                    label="Updated"
                                    value={`${formatDate(reservation.updatedAt)} · ${formatTime(reservation.updatedAt)}`}
                                />
                                {reservation.remindedAt && (
                                    <DetailRow
                                        label="Reminded"
                                        value={`${formatDate(reservation.remindedAt)} · ${formatTime(reservation.remindedAt)}`}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Change requests (read-only context while editing) */}
                        {/* Save / Cancel actions card */}
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                    Actions
                                </h2>
                            </div>
                            <div className="px-5 py-4 space-y-2.5">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <SpinnerThinIcon className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckIcon className="w-4 h-4" strokeWidth={2} />
                                    )}
                                    Save Changes
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    disabled={isSaving}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ── View mode: wide 2-column layout ──
    return (
        <div className="max-w-5xl space-y-6">

            {customerUpdatedBanner && (
                <div
                    role="status"
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-card border border-amber-300/60 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3"
                >
                    <p className="text-sm text-amber-900 dark:text-amber-200">
                        The customer updated this reservation. Details below are up to date.
                    </p>
                    <button
                        type="button"
                        onClick={() => setCustomerUpdatedBanner(false)}
                        className="text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline shrink-0"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push("/reservations")}
                    className="p-2 rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                            Reservation Details
                        </h1>
                        <span className="text-xs font-mono text-wg-muted dark:text-wg-dark-muted bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                            {refCode}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <StatusBadge status={reservation.status} />
                    {reservation.hiddenByAdmin && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-wg-muted dark:text-wg-dark-muted bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                            <EyeSlashIcon className="w-3.5 h-3.5" aria-hidden />
                            Hidden from queue
                        </span>
                    )}
                </div>
            </div>

            {/* ── Body: 2-column grid ── */}
            <div className="grid lg:grid-cols-3 gap-6 items-start">

                {/* ── LEFT: Customer + Notes ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Customer card */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                Customer
                            </h2>
                        </div>
                        <div className="px-5 py-4 flex items-start gap-4">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-wg-accent/15 dark:bg-wg-dark-accent/20 flex items-center justify-center">
                                {reservation.profile?.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={reservation.profile.avatarUrl}
                                        alt={fullName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-sm font-bold text-wg-accent dark:text-wg-dark-accent">{initials}</span>
                                )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0 space-y-3">
                                <p className="text-base font-semibold text-wg-text dark:text-wg-dark-text">{fullName}</p>
                                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                                    {reservation.profile?.email && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-0.5">Email</p>
                                            <a
                                                href={`mailto:${reservation.profile.email}`}
                                                className="text-sm text-wg-accent dark:text-wg-dark-accent hover:underline truncate block"
                                            >
                                                {reservation.profile.email}
                                            </a>
                                        </div>
                                    )}
                                    {phone && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-0.5">Phone</p>
                                            <a
                                                href={`tel:${reservation.profile?.phoneCountryCode}${reservation.profile?.phoneNumber}`}
                                                className="text-sm text-wg-text dark:text-wg-dark-text tabular-nums hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors"
                                            >
                                                {phone}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes card */}
                    {reservation.notes ? (
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                    Special Requests
                                </h2>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-sm text-wg-text dark:text-wg-dark-text whitespace-pre-wrap leading-relaxed">
                                    {reservation.notes}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-card border border-dashed border-wg-border/40 dark:border-wg-dark-border/60 px-5 py-4">
                            <p className="text-xs text-wg-muted/60 dark:text-wg-dark-muted/60">No special requests</p>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Details + Actions ── */}
                <div className="space-y-5">

                    {/* Reservation details card */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                Details
                            </h2>
                        </div>
                        <div className="px-5 py-1">
                            <DetailRow
                                label="Date"
                                value={formatDate(dt)}
                            />
                            <DetailRow
                                label="Time"
                                value={formatTime(dt)}
                            />
                            <DetailRow
                                label="Party"
                                value={`${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"}`}
                            />
                            <DetailRow
                                label="Created"
                                value={`${formatDate(reservation.createdAt)} · ${formatTime(reservation.createdAt)}`}
                            />
                            {reservation.remindedAt && (
                                <DetailRow
                                    label="Reminded"
                                    value={`${formatDate(reservation.remindedAt)} · ${formatTime(reservation.remindedAt)}`}
                                />
                            )}
                        </div>
                    </div>

                    {/* Actions card */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                Actions
                            </h2>
                        </div>
                        <div className="px-5 py-4 space-y-2.5">
                            {/* Edit */}
                            {reservation.status !== "COMPLETED" && (
                                <button
                                    onClick={enterEditMode}
                                    className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors"
                                >
                                    <PencilSquareIcon className="w-4 h-4 shrink-0" />
                                    Edit reservation
                                </button>
                            )}

                            {/* Confirm */}
                            {allowedActions.includes("CONFIRMED") && (
                                <button
                                    onClick={() => setActionTarget("CONFIRMED")}
                                    className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand bg-green-600 hover:bg-green-700 text-white transition-colors"
                                >
                                    <CheckIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                    Confirm reservation
                                </button>
                            )}

                            {/* Mark Completed */}
                            {allowedActions.includes("COMPLETED") && (
                                <button
                                    onClick={() => setActionTarget("COMPLETED")}
                                    className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                >
                                    <CheckCircleIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                    Mark as completed
                                </button>
                            )}

                            {/* Reopen */}
                            {allowedActions.includes("PENDING") && (
                                <button
                                    onClick={() => setActionTarget("PENDING")}
                                    className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                >
                                    <ArrowPathIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                    Reopen reservation
                                </button>
                            )}

                            {/* Cancel */}
                            {allowedActions.includes("CANCELLED") && (
                                <button
                                    onClick={() => setActionTarget("CANCELLED")}
                                    className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <CloseIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                    Cancel reservation
                                </button>
                            )}

                            {/* Hide / show in queue */}
                            <button
                                type="button"
                                onClick={handleToggleHidden}
                                disabled={isHiding}
                                className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors disabled:opacity-50"
                            >
                                {reservation.hiddenByAdmin ? (
                                    <>
                                        <EyeIcon className="w-4 h-4 shrink-0" aria-hidden />
                                        {isHiding ? "Showing…" : "Show in queue"}
                                    </>
                                ) : (
                                    <>
                                        <EyeSlashIcon className="w-4 h-4 shrink-0" aria-hidden />
                                        {isHiding ? "Hiding…" : "Hide from queue"}
                                    </>
                                )}
                            </button>
                            {hideError && (
                                <p role="alert" className="text-xs text-red-600 dark:text-red-400">{hideError}</p>
                            )}

                            {/* Divider + Delete */}
                            <div className="pt-1 border-t border-wg-border/30 dark:border-wg-dark-border">
                                <button
                                    onClick={() => setShowDelete(true)}
                                    className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-1"
                                >
                                    <TrashIcon className="w-4 h-4 shrink-0" />
                                    Delete reservation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status quick-action confirm dialog */}
            <ConfirmDialog
                isOpen={!!actionTarget}
                onClose={() => { setActionTarget(null); setStatusError(null) }}
                onConfirm={handleStatusUpdate}
                title={
                    actionTarget === "CANCELLED" ? "Cancel Reservation"
                    : actionTarget === "CONFIRMED" ? "Confirm Reservation"
                    : actionTarget === "COMPLETED" ? "Complete Reservation"
                    : "Reopen Reservation"
                }
                message={
                    actionTarget === "CANCELLED"
                        ? "Are you sure you want to cancel this reservation? The customer will be notified."
                        : actionTarget === "CONFIRMED"
                        ? "Confirm this reservation? The customer will receive a confirmation email."
                        : `Mark this reservation as ${actionTarget?.toLowerCase()}?`
                }
                confirmLabel={actionTarget === "CANCELLED" ? "Cancel Reservation" : "Confirm"}
                variant={actionTarget === "CANCELLED" ? "danger" : "warning"}
                isLoading={isUpdating}
                error={statusError}
            />

            {/* Delete confirm dialog */}
            <ConfirmDialog
                isOpen={showDelete}
                onClose={() => { setShowDelete(false); setDeleteError(null) }}
                onConfirm={handleDelete}
                title="Delete Reservation"
                message="This will permanently delete this reservation. This action cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
                error={deleteError}
            />
        </div>
    )
}
