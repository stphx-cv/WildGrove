"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Order Detail Page — /orders/[id]
// Shows customer, items, totals, delivery, billing document,
// event timeline, and actions (status transitions, cancel+refund,
// add staff note, set estimated ready time).
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { AdminSelect } from "@/components/AdminSelect"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { adminOrderDocumentPdfUrl } from "@wildgrove/core/pdf/orderDocumentPdfUrl"
import type { OrderPdfLocale } from "@wildgrove/core/pdf/orderDocumentCopy"
import { PDF_DOWNLOAD_LINK_CLASSNAME } from "@wildgrove/core/pdf/pdfDownloadLinkClassName"
import { billingDocumentTypeLabel } from "@wildgrove/core/orders/billingDocumentTypeLabel"
import { LoadingState } from "@/components/LoadingState"
import { Textarea } from "@wildgrove/ui/Textarea"
import {
    ArrowDownTrayIcon,
    ArrowLeftIcon,
    ArrowPathIcon,
    ArrowUturnLeftIcon,
    ChatBubbleTextIcon,
    CheckIcon,
    CloseIcon,
    CreditCardIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    EyeSlashIcon,
    MapPinIcon,
    PlusIcon,
    SpinnerThinIcon,
} from "@wildgrove/ui/icons"

// ── Types ──

interface OrderEvent {
    id: string
    type: string
    message: string | null
    actorId: string | null
    createdAt: string
}

interface OrderDetail {
    id: string
    orderNumber: number
    status: string
    fulfillment: "PICKUP" | "DELIVERY"
    currency: string
    subtotal: string
    discountTotal: string
    deliveryFee: string
    total: string
    paymentMethod: string
    paidAt: string | null
    scheduledFor: string | null
    estimatedReadyAt: string | null
    deliveryAddress: string | null
    deliveryAddressDetail: string | null
    deliveryLat: string | null
    deliveryLng: string | null
    deliveryZoneName: string | null
    customerPhone: string | null
    customerName: string | null
    notes: string | null
    cancelReason: string | null
    locale: string
    hiddenByAdmin: boolean
    createdAt: string
    updatedAt: string
    // Billing
    documentType: "BOLETA" | "FACTURA"
    documentSeries: string | null
    documentNumber: string | null
    buyerDni: string | null
    fiscalRuc: string | null
    fiscalLegalName: string | null
    fiscalAddress: string | null
    profile: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
        phoneCountryCode: string | null
        phoneNumber: string | null
        avatarUrl: string | null
    }
    items: {
        id: string
        nameSnapshot: string
        quantity: number
        unitPrice: string
        lineTotal: string
        notes: string | null
        menuItem: { id: string; slug: string } | null
    }[]
    appliedDiscounts: {
        amount: string
        codeUsed: string | null
        discount: { name: string }
    }[]
    events: OrderEvent[]
}

// ── Allowed admin transitions (mirrors OrderService.ALLOWED_TRANSITIONS) ──
const ADMIN_TRANSITIONS: Partial<Record<string, string[]>> = {
    PENDING:           ["PREPARING", "CANCELLED"],
    PREPARING:         ["READY", "CANCELLED"],
    READY:             ["OUT_FOR_DELIVERY", "COMPLETED"],
    OUT_FOR_DELIVERY:  ["COMPLETED", "CANCELLED"],
    COMPLETED:         [],
    CANCELLED:         [],
    REFUNDED:          [],
}

const STATUS_LABELS: Record<string, string> = {
    PREPARING:        "Mark as Preparing",
    READY:            "Mark as Ready",
    OUT_FOR_DELIVERY: "Mark as Out for Delivery",
    COMPLETED:        "Mark as Completed",
}

const ALL_OVERRIDABLE_STATUSES = ["PENDING", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"] as const

/** Dot + primary action button per order status (unique hue per state). */
const ORDER_STATUS_VISUAL: Record<string, { label: string; dot: string; primaryButton: string }> = {
    PENDING:          { label: "Pending",          dot: "bg-amber-400",   primaryButton: "bg-amber-500 hover:bg-amber-600 text-white" },
    PREPARING:        { label: "Preparing",        dot: "bg-blue-500",    primaryButton: "bg-blue-600 hover:bg-blue-700 text-white" },
    READY:            { label: "Ready",            dot: "bg-emerald-500", primaryButton: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", dot: "bg-indigo-500",  primaryButton: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    COMPLETED:        { label: "Completed",        dot: "bg-purple-500",  primaryButton: "bg-purple-600 hover:bg-purple-700 text-white" },
    CANCELLED:        { label: "Cancelled",        dot: "bg-red-500",     primaryButton: "bg-red-600 hover:bg-red-700 text-white" },
}

const EVENT_ICONS: Record<string, React.JSX.Element> = {
    CREATED: (
        <PlusIcon className="w-3.5 h-3.5" strokeWidth={2} />
    ),
    PAID: (
        <CreditCardIcon className="w-3.5 h-3.5" strokeWidth={2} />
    ),
    STATUS_CHANGED: (
        <ArrowPathIcon className="w-3.5 h-3.5" strokeWidth={2} />
    ),
    CANCELLED: (
        <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
    ),
    REFUNDED: (
        <ArrowUturnLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
    ),
    NOTE_ADDED: (
        <ChatBubbleTextIcon className="w-3.5 h-3.5" strokeWidth={2} />
    ),
}

const EVENT_COLORS: Record<string, string> = {
    CREATED:        "bg-wg-accent/15 text-wg-accent dark:bg-wg-dark-accent/15 dark:text-wg-dark-accent",
    PAID:           "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    STATUS_CHANGED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    CANCELLED:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    REFUNDED:       "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    NOTE_ADDED:     "bg-wg-border/30 text-wg-muted dark:bg-wg-dark-border dark:text-wg-dark-muted",
}

// ── Helpers ──

function formatCurrency(amount: string | number, currency: string) {
    const n = typeof amount === "string" ? parseFloat(amount) : amount
    if (currency === "USD") return `$${n.toFixed(2)}`
    return `S/ ${n.toFixed(2)}`
}

function getInitials(firstName: string | null, lastName: string | null) {
    return ([firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase()) || "?"
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5 border-b border-wg-border/30 dark:border-wg-dark-border last:border-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted shrink-0 pt-0.5">
                {label}
            </span>
            <span className="text-sm text-wg-text dark:text-wg-dark-text text-right tabular-nums">
                {value ?? <span className="text-wg-muted/60 dark:text-wg-dark-muted/60 italic font-normal">—</span>}
            </span>
        </div>
    )
}

// ── Page ──

export default function AdminOrderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const { formatDate, formatTime } = useAdminAppDateTime()

    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Actions
    const [actionTarget, setActionTarget] = useState<string | null>(null)
    const [isActioning, setIsActioning] = useState(false)
    const [actionError, setActionError] = useState("")

    // Cancel
    const [showCancel, setShowCancel] = useState(false)
    const [cancelReason, setCancelReason] = useState("")
    const [isCancelling, setIsCancelling] = useState(false)
    const [cancelError, setCancelError] = useState("")

    const [isHiding, setIsHiding] = useState(false)

    // Reactivate
    const [showReactivate, setShowReactivate] = useState(false)
    const [isReactivating, setIsReactivating] = useState(false)
    const [reactivateError, setReactivateError] = useState("")
    const [insufficientFunds, setInsufficientFunds] = useState<{ available: string; required: string; currency: string } | null>(null)

    // Override
    const [showOverride, setShowOverride] = useState(false)
    const [overrideStatus, setOverrideStatus] = useState("")
    const [overrideReason, setOverrideReason] = useState("")
    const [isOverriding, setIsOverriding] = useState(false)
    const [overrideError, setOverrideError] = useState("")

    // Add note
    const [showNoteForm, setShowNoteForm] = useState(false)
    const [noteText, setNoteText] = useState("")
    const [isAddingNote, setIsAddingNote] = useState(false)

    // PDF download language (defaults to order checkout locale once loaded)
    const [pdfDownloadLang, setPdfDownloadLang] = useState<OrderPdfLocale | null>(null)

    const fetchOrder = useCallback(async () => {
        try {
            const res = await fetch(`/api/orders/${id}`)
            const json = await res.json()
            if (json.success) setOrder(json.data)
        } catch (error) {
            console.error("Failed to fetch order:", error)
        } finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => { fetchOrder() }, [fetchOrder])

    const handleTransition = useCallback(async () => {
        if (!actionTarget) return
        setIsActioning(true)
        setActionError("")
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: actionTarget }),
            })
            const json = await res.json()
            if (json.success) {
                setOrder(prev => prev ? {
                    ...prev,
                    status: json.data.status,
                    estimatedReadyAt: json.data.estimatedReadyAt ?? prev.estimatedReadyAt,
                    events: json.data.events ?? prev.events,
                } : prev)
            } else {
                setActionError(json.error || "Failed to update status")
            }
            setActionTarget(null)
        } catch {
            setActionError("Network error — please try again")
        } finally {
            setIsActioning(false)
        }
    }, [actionTarget, id])

    const handleCancel = useCallback(async () => {
        if (!cancelReason.trim()) { setCancelError("Please enter a reason"); return }
        setIsCancelling(true)
        setCancelError("")
        try {
            const res = await fetch(`/api/orders/${id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: cancelReason.trim() }),
            })
            const json = await res.json()
            if (json.success) {
                fetchOrder()
                setShowCancel(false)
                setCancelReason("")
            } else {
                setCancelError(json.error || "Failed to cancel order")
            }
        } catch {
            setCancelError("Network error — please try again")
        } finally {
            setIsCancelling(false)
        }
    }, [cancelReason, id, fetchOrder])

    const handleAddNote = useCallback(async () => {
        if (!noteText.trim()) return
        setIsAddingNote(true)
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note: noteText.trim() }),
            })
            const json = await res.json()
            if (json.success) {
                setOrder(prev => prev ? { ...prev, events: json.data.events ?? prev.events } : prev)
                setNoteText("")
                setShowNoteForm(false)
            }
        } catch (error) {
            console.error("Failed to add note:", error)
        } finally {
            setIsAddingNote(false)
        }
    }, [noteText, id])

    const handleToggleHidden = useCallback(async () => {
        if (!order) return
        setIsHiding(true)
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hiddenByAdmin: !order.hiddenByAdmin }),
            })
            const json = await res.json()
            if (json.success) {
                setOrder((prev) => prev
                    ? { ...prev, hiddenByAdmin: json.data.hiddenByAdmin ?? !prev.hiddenByAdmin }
                    : prev)
            }
        } catch (error) {
            console.error("Failed to toggle order visibility:", error)
        } finally {
            setIsHiding(false)
        }
    }, [id, order])

    const handleReactivate = useCallback(async () => {
        setIsReactivating(true)
        setReactivateError("")
        setInsufficientFunds(null)
        try {
            const res = await fetch(`/api/orders/${id}/reactivate`, { method: "POST" })
            const json = await res.json()
            if (json.success) {
                await fetchOrder()
                setShowReactivate(false)
            } else if (json.error === "INSUFFICIENT_BALANCE" && json.details) {
                setInsufficientFunds(json.details)
            } else {
                setReactivateError(json.error || "Failed to reactivate order")
            }
        } catch {
            setReactivateError("Network error — please try again")
        } finally {
            setIsReactivating(false)
        }
    }, [id, fetchOrder])

    const handleOverride = useCallback(async () => {
        if (!overrideStatus) { setOverrideError("Please select a status"); return }
        if (!overrideReason.trim()) { setOverrideError("Please enter a reason"); return }
        setIsOverriding(true)
        setOverrideError("")
        try {
            const res = await fetch(`/api/orders/${id}/override-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: overrideStatus, reason: overrideReason.trim() }),
            })
            const json = await res.json()
            if (json.success) {
                await fetchOrder()
                setShowOverride(false)
                setOverrideStatus("")
                setOverrideReason("")
            } else {
                setOverrideError(json.error || "Failed to override status")
            }
        } catch {
            setOverrideError("Network error — please try again")
        } finally {
            setIsOverriding(false)
        }
    }, [overrideStatus, overrideReason, id, fetchOrder])

    // ── Loading ──
    if (isLoading) {
        return (
            <LoadingState size="page" message="Loading order…" />
        )
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-wg-muted dark:text-wg-dark-muted">Order not found</p>
                <Link href="/orders" className="mt-4 inline-block text-sm text-wg-accent dark:text-wg-dark-accent hover:underline">
                    Back to orders
                </Link>
            </div>
        )
    }

    const allowedTransitions = ADMIN_TRANSITIONS[order.status] ?? []
    const canCancel = allowedTransitions.includes("CANCELLED")
    const forwardTransitions = allowedTransitions.filter(s => s !== "CANCELLED")
    const fullName = [order.profile.firstName, order.profile.lastName].filter(Boolean).join(" ") || "Unknown"
    const initials = getInitials(order.profile.firstName, order.profile.lastName)
    const docRef = order.documentSeries && order.documentNumber
        ? `${order.documentSeries}-${order.documentNumber}`
        : null
    const docTypeLabel = billingDocumentTypeLabel(order.documentType, order.locale || "en")
    const effectivePdfLang: OrderPdfLocale =
        pdfDownloadLang ?? (order.locale === "es" ? "es" : "en")

    return (
        <div className="max-w-5xl space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push("/orders")}
                    className="p-2 rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                            Order #{order.orderNumber}
                        </h1>
                        <span className="text-xs font-mono text-wg-muted dark:text-wg-dark-muted bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                            {order.fulfillment}
                        </span>
                    </div>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
                        {formatDate(new Date(order.createdAt))} · {formatTime(new Date(order.createdAt))}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <StatusBadge status={order.status} />
                    {order.hiddenByAdmin && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-wg-muted dark:text-wg-dark-muted bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                            <EyeSlashIcon className="w-3.5 h-3.5" aria-hidden />
                            Hidden from queue
                        </span>
                    )}
                </div>
            </div>

            {actionError && (
                <div className="rounded-brand p-3 text-sm bg-red-500/10 text-red-600 dark:text-red-400">
                    {actionError}
                </div>
            )}

            {/* ── Body ── */}
            <div className="grid lg:grid-cols-3 gap-6 items-start">

                {/* ── LEFT (2/3) ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Customer card */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Customer</h2>
                            <Link
                                href={`/customers/${order.profile.id}`}
                                className="text-xs text-wg-accent dark:text-wg-dark-accent hover:underline"
                            >
                                View profile
                            </Link>
                        </div>
                        <div className="px-5 py-4 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-wg-accent/15 dark:bg-wg-dark-accent/20 flex items-center justify-center">
                                {order.profile.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={order.profile.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-bold text-wg-accent dark:text-wg-dark-accent">{initials}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <p className="font-semibold text-wg-text dark:text-wg-dark-text">{fullName}</p>
                                <div className="flex flex-wrap gap-x-6 gap-y-1">
                                    {order.profile.email && (
                                        <a href={`mailto:${order.profile.email}`} className="text-sm text-wg-accent dark:text-wg-dark-accent hover:underline">
                                            {order.profile.email}
                                        </a>
                                    )}
                                    {(order.customerPhone || (order.profile.phoneCountryCode && order.profile.phoneNumber)) && (
                                        <span className="text-sm text-wg-muted dark:text-wg-dark-muted tabular-nums">
                                            {order.customerPhone
                                                || `+${order.profile.phoneCountryCode} ${order.profile.phoneNumber}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items table */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Items</h2>
                        </div>
                        <div className="divide-y divide-wg-border/20 dark:divide-wg-dark-border">
                            {order.items.map((item) => (
                                <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                            {item.quantity}× {item.nameSnapshot}
                                        </p>
                                        {item.notes && (
                                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5 italic">{item.notes}</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-semibold tabular-nums text-wg-text dark:text-wg-dark-text">
                                            {formatCurrency(item.lineTotal, order.currency)}
                                        </p>
                                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted tabular-nums">
                                            {formatCurrency(item.unitPrice, order.currency)} each
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Totals */}
                        <div className="px-5 py-3 bg-wg-bg/40 dark:bg-wg-dark-bg/40 border-t border-wg-border/30 dark:border-wg-dark-border space-y-1.5">
                            <div className="flex justify-between text-sm text-wg-muted dark:text-wg-dark-muted">
                                <span>Subtotal</span>
                                <span className="tabular-nums">{formatCurrency(order.subtotal, order.currency)}</span>
                            </div>
                            {parseFloat(order.discountTotal) > 0 && (
                                <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                                    <span>Discounts</span>
                                    <span className="tabular-nums">−{formatCurrency(order.discountTotal, order.currency)}</span>
                                </div>
                            )}
                            {parseFloat(order.deliveryFee) > 0 && (
                                <div className="flex justify-between text-sm text-wg-muted dark:text-wg-dark-muted">
                                    <span>Delivery fee</span>
                                    <span className="tabular-nums">{formatCurrency(order.deliveryFee, order.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-bold text-wg-text dark:text-wg-dark-text pt-1.5 border-t border-wg-border/30 dark:border-wg-dark-border">
                                <span>Total</span>
                                <span className="tabular-nums">{formatCurrency(order.total, order.currency)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Delivery address (DELIVERY only) */}
                    {order.fulfillment === "DELIVERY" && order.deliveryAddress && (
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Delivery Address</h2>
                            </div>
                            <div className="px-5 py-4 space-y-1">
                                <p className="text-sm text-wg-text dark:text-wg-dark-text">{order.deliveryAddress}</p>
                                {order.deliveryAddressDetail && (
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{order.deliveryAddressDetail}</p>
                                )}
                                {order.deliveryZoneName && (
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
                                        Zone: <span className="font-medium text-wg-text dark:text-wg-dark-text">{order.deliveryZoneName}</span>
                                    </p>
                                )}
                                {order.deliveryLat && order.deliveryLng && (
                                    <a
                                        href={`https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-wg-accent dark:text-wg-dark-accent hover:underline mt-1"
                                    >
                                        <MapPinIcon className="w-3.5 h-3.5" />
                                        View on Google Maps
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Customer Notes</h2>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-sm text-wg-text dark:text-wg-dark-text whitespace-pre-wrap">{order.notes}</p>
                            </div>
                        </div>
                    )}

                    {/* Billing document */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                Billing Document
                            </h2>
                            {docRef && (
                                <span className="text-xs font-mono font-semibold text-wg-text dark:text-wg-dark-text bg-wg-border/30 dark:bg-wg-dark-border px-2 py-0.5 rounded">
                                    {docTypeLabel} {docRef}
                                </span>
                            )}
                        </div>
                        <div className="px-5 py-4 space-y-2 text-sm">
                            {/* Without series and number the order has no document, and its type is only the column default. */}
                            {!docRef ? (
                                <p className="text-wg-muted dark:text-wg-dark-muted">No billing document was issued for this order.</p>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted w-24">Type</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${order.documentType === "FACTURA" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"}`}>
                                            {docTypeLabel}
                                        </span>
                                    </div>

                                    {order.documentType === "BOLETA" ? (
                                        order.buyerDni && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted w-24">DNI</span>
                                                <span className="tabular-nums text-wg-text dark:text-wg-dark-text">{order.buyerDni}</span>
                                            </div>
                                        )
                                    ) : (
                                        <>
                                            {order.fiscalRuc && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted w-24">RUC</span>
                                                    <span className="tabular-nums text-wg-text dark:text-wg-dark-text">{order.fiscalRuc}</span>
                                                </div>
                                            )}
                                            {order.fiscalLegalName && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted w-24">Razón Social</span>
                                                    <span className="text-wg-text dark:text-wg-dark-text">{order.fiscalLegalName}</span>
                                                </div>
                                            )}
                                            {order.fiscalAddress && (
                                                <div className="flex items-start gap-2">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted w-24 mt-0.5">Dirección Fiscal</span>
                                                    <span className="text-wg-text dark:text-wg-dark-text flex-1">{order.fiscalAddress}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {order.documentSeries && order.documentNumber && (
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                            PDF language
                                        </span>
                                        <div
                                            className="inline-flex rounded-brand border border-wg-border/50 dark:border-wg-dark-border overflow-hidden"
                                            role="group"
                                            aria-label="PDF language"
                                        >
                                            {(["es", "en"] as const).map((lang) => (
                                                <button
                                                    key={lang}
                                                    type="button"
                                                    onClick={() => setPdfDownloadLang(lang)}
                                                    aria-pressed={effectivePdfLang === lang}
                                                    className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                        effectivePdfLang === lang
                                                            ? "bg-wg-accent text-white"
                                                            : "bg-transparent text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border"
                                                    }`}
                                                >
                                                    {lang === "es" ? "Español" : "English"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <a
                                        href={adminOrderDocumentPdfUrl(order.id, effectivePdfLang)}
                                        download
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${PDF_DOWNLOAD_LINK_CLASSNAME}`}
                                    >
                                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                        Download PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Event timeline */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Timeline</h2>
                            <button
                                onClick={() => setShowNoteForm(!showNoteForm)}
                                className="text-xs text-wg-accent dark:text-wg-dark-accent hover:underline"
                            >
                                {showNoteForm ? "Cancel" : "+ Add note"}
                            </button>
                        </div>

                        {/* Note form */}
                        {showNoteForm && (
                            <div className="px-5 py-3 border-b border-wg-border/20 dark:border-wg-dark-border bg-wg-bg/30 dark:bg-wg-dark-bg/30">
                                <Textarea
                                    maxHeight={160}
                                    value={noteText}
                                    onChange={setNoteText}
                                    placeholder="Add an internal note…"
                                    minRows={2}
                                    maxLength={280}
                                    className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/30"
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted">{noteText.length}/280</span>
                                    <button
                                        onClick={handleAddNote}
                                        disabled={isAddingNote || !noteText.trim()}
                                        className="px-3 py-1.5 text-xs font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors disabled:opacity-50"
                                    >
                                        {isAddingNote ? "Adding…" : "Add Note"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="px-5 py-4">
                            <ol className="relative border-l border-wg-border/40 dark:border-wg-dark-border space-y-5 ml-2">
                                {order.events.map((event) => {
                                    const icon = EVENT_ICONS[event.type]
                                    const color = EVENT_COLORS[event.type] ?? EVENT_COLORS.NOTE_ADDED
                                    return (
                                        <li key={event.id} className="ml-5 relative">
                                            <div className={`absolute -left-[26px] w-5 h-5 rounded-full flex items-center justify-center ${color}`}>
                                                {icon ?? null}
                                            </div>
                                            <div>
                                                <p className="text-sm text-wg-text dark:text-wg-dark-text">
                                                    {event.message || event.type.replace(/_/g, " ")}
                                                </p>
                                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted tabular-nums mt-0.5">
                                                    {formatDate(new Date(event.createdAt))} · {formatTime(new Date(event.createdAt))}
                                                </p>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        </div>
                    </div>

                </div>

                {/* ── RIGHT (1/3) ── */}
                <div className="space-y-5">

                    {/* Order details */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Details</h2>
                        </div>
                        <div className="px-5 py-1">
                            <DetailRow label="Order #" value={<span className="font-mono">#{order.orderNumber}</span>} />
                            <DetailRow label="Status" value={<StatusBadge status={order.status} />} />
                            <DetailRow label="Fulfillment" value={order.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"} />
                            <DetailRow label="Payment" value={order.paymentMethod} />
                            <DetailRow label="Currency" value={order.currency} />
                            <DetailRow label="Total" value={<span className="font-bold">{formatCurrency(order.total, order.currency)}</span>} />
                            {order.paidAt && (
                                <DetailRow label="Paid at" value={`${formatDate(new Date(order.paidAt))} · ${formatTime(new Date(order.paidAt))}`} />
                            )}
                            {order.scheduledFor && (
                                <DetailRow label="Scheduled" value={`${formatDate(new Date(order.scheduledFor))} · ${formatTime(new Date(order.scheduledFor))}`} />
                            )}
                            {order.estimatedReadyAt && (
                                <DetailRow label="Est. Ready" value={`${formatDate(new Date(order.estimatedReadyAt))} · ${formatTime(new Date(order.estimatedReadyAt))}`} />
                            )}
                            {order.cancelReason && (
                                <DetailRow label="Cancel reason" value={<span className="text-red-500 dark:text-red-400 normal-case font-normal">{order.cancelReason}</span>} />
                            )}
                            <DetailRow label="Created" value={`${formatDate(new Date(order.createdAt))} · ${formatTime(new Date(order.createdAt))}`} />
                        </div>
                    </div>

                    {/* Applied discounts */}
                    {order.appliedDiscounts.length > 0 && (
                        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                            <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Discounts Applied</h2>
                            </div>
                            <div className="px-5 py-3 space-y-2">
                                {order.appliedDiscounts.map((d, i) => (
                                    <div key={i} className="flex items-start justify-between gap-2 text-sm">
                                        <div>
                                            <p className="font-medium text-wg-text dark:text-wg-dark-text">{d.discount.name}</p>
                                            {d.codeUsed && (
                                                <p className="text-xs font-mono text-wg-muted dark:text-wg-dark-muted">{d.codeUsed}</p>
                                            )}
                                        </div>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums shrink-0">
                                            −{formatCurrency(d.amount, order.currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">Actions</h2>
                        </div>
                        <div className="px-5 py-4 space-y-2.5">
                            {/* Forward transitions */}
                            {forwardTransitions.map((nextStatus) => {
                                const btn =
                                    ORDER_STATUS_VISUAL[nextStatus]?.primaryButton ??
                                    "bg-wg-accent hover:bg-wg-accent-hover text-white"
                                return (
                                    <button
                                        key={nextStatus}
                                        onClick={() => setActionTarget(nextStatus)}
                                        className={`w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand transition-colors ${btn}`}
                                    >
                                        <CheckIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                        {STATUS_LABELS[nextStatus] ?? nextStatus}
                                    </button>
                                )
                            })}

                            {/* Cancel */}
                            {canCancel && (
                                <>
                                    {forwardTransitions.length > 0 && (
                                        <div className="pt-1 border-t border-wg-border/20 dark:border-wg-dark-border" />
                                    )}
                                    <button
                                        onClick={() => setShowCancel(true)}
                                        className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <CloseIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                        Cancel &amp; Refund
                                    </button>
                                </>
                            )}

                            {/* Terminal state info */}
                            {forwardTransitions.length === 0 && !canCancel && (
                                <p className="text-xs text-center text-wg-muted/60 dark:text-wg-dark-muted/60 italic py-2">
                                    No actions available for {order.status.toLowerCase()} orders
                                </p>
                            )}

                            {/* Reactivate (REFUNDED only) */}
                            {order.status === "REFUNDED" && (
                                <>
                                    {(forwardTransitions.length > 0 || canCancel) && (
                                        <div className="border-t border-wg-border/20 dark:border-wg-dark-border" />
                                    )}
                                    <button
                                        onClick={() => { setShowReactivate(true); setReactivateError(""); setInsufficientFunds(null) }}
                                        className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-brand border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                    >
                                        <ArrowPathIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                                        Reactivate Order
                                    </button>
                                </>
                            )}

                            {/* Override + Hide + Delete */}
                            <div className="pt-2 border-t border-wg-border/20 dark:border-wg-dark-border space-y-1">
                                <button
                                    onClick={handleToggleHidden}
                                    disabled={isHiding}
                                    className="w-full inline-flex items-center justify-center gap-2 text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors py-1 disabled:opacity-50"
                                >
                                    {order.hiddenByAdmin ? (
                                        <>
                                            <EyeIcon className="w-3.5 h-3.5" aria-hidden />
                                            {isHiding ? "Showing…" : "Show in queue"}
                                        </>
                                    ) : (
                                        <>
                                            <EyeSlashIcon className="w-3.5 h-3.5" aria-hidden />
                                            {isHiding ? "Hiding…" : "Hide from queue"}
                                        </>
                                    )}
                                </button>
                                {order.status !== "REFUNDED" && (
                                    <button
                                        onClick={() => { setShowOverride(true); setOverrideStatus(""); setOverrideReason(""); setOverrideError("") }}
                                        className="w-full text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors py-1"
                                    >
                                        Change status manually
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Status transition confirm dialog ── */}
            <ConfirmDialog
                isOpen={!!actionTarget}
                onClose={() => !isActioning && setActionTarget(null)}
                onConfirm={handleTransition}
                title={`Update Order Status`}
                message={`Move order #${order.orderNumber} to "${actionTarget?.replace(/_/g, " ").toLowerCase()}"?`}
                confirmLabel="Confirm"
                variant="warning"
                isLoading={isActioning}
            />

            {/* ── Cancel modal (with reason input) ── */}
            {showCancel && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget && !isCancelling) { setShowCancel(false); setCancelReason(""); setCancelError("") } }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-red-100 dark:bg-red-900/30">
                            <CloseIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">
                            Cancel Order #{order.orderNumber}
                        </h3>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
                            This will cancel the order and automatically refund the customer&apos;s wallet (if paid).
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-2">
                                Reason for cancellation <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                maxHeight={180}
                                value={cancelReason}
                                onChange={setCancelReason}
                                placeholder="e.g. Out of stock, kitchen issue…"
                                minRows={3}
                                maxLength={280}
                                className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/30"
                            />
                            <div className="flex justify-between mt-1">
                                {cancelError && <p className="text-xs text-red-500 dark:text-red-400">{cancelError}</p>}
                                <span className="text-xs text-wg-muted dark:text-wg-dark-muted ml-auto">{cancelReason.length}/280</span>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setShowCancel(false); setCancelReason(""); setCancelError("") }}
                                disabled={isCancelling}
                                className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                            >
                                Keep Order
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isCancelling || !cancelReason.trim()}
                                className="px-4 py-2 text-sm font-medium rounded-brand bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                            >
                                {isCancelling ? (
                                    <span className="flex items-center gap-2">
                                        <SpinnerThinIcon className="w-4 h-4 animate-spin" />
                                        Cancelling…
                                    </span>
                                ) : "Cancel & Refund"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reactivate modal ── */}
            {showReactivate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget && !isReactivating) { setShowReactivate(false) } }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-emerald-100 dark:bg-emerald-900/30">
                            <ArrowPathIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">
                            Reactivate Order #{order.orderNumber}
                        </h3>

                        {/* Insufficient funds state */}
                        {insufficientFunds ? (
                            <>
                                <div className="mb-4 flex items-start gap-2.5 rounded-brand border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3.5 py-3">
                                    <ExclamationTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-red-800 dark:text-red-300 space-y-1">
                                        <p className="font-semibold">Insufficient wallet balance</p>
                                        <p>Available: <span className="font-mono font-semibold">{insufficientFunds.currency} {insufficientFunds.available}</span></p>
                                        <p>Required: <span className="font-mono font-semibold">{insufficientFunds.currency} {insufficientFunds.required}</span></p>
                                    </div>
                                </div>
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
                                    The customer does not have enough balance. Top up their wallet first, then try again.
                                </p>
                                <div className="flex gap-3">
                                    <a
                                        href={`/wallets/${order.profile.id}`}
                                        className="flex-1 text-center px-4 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors"
                                    >
                                        Top up wallet
                                    </a>
                                    <button
                                        onClick={handleReactivate}
                                        disabled={isReactivating}
                                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                                    >
                                        {isReactivating ? "Retrying…" : "Retry"}
                                    </button>
                                    <button
                                        onClick={() => setShowReactivate(false)}
                                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
                                    This will re-charge <span className="font-semibold text-wg-text dark:text-wg-dark-text">{formatCurrency(order.total, order.currency)}</span> from the customer&apos;s wallet and set the order back to <span className="font-semibold text-wg-text dark:text-wg-dark-text">Pending</span>.
                                </p>
                                {reactivateError && (
                                    <div className="mb-4 rounded-brand px-3.5 py-3 text-sm bg-red-500/10 text-red-600 dark:text-red-400">
                                        {reactivateError}
                                    </div>
                                )}
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setShowReactivate(false)}
                                        disabled={isReactivating}
                                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReactivate}
                                        disabled={isReactivating}
                                        className="px-4 py-2 text-sm font-medium rounded-brand bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                                    >
                                        {isReactivating ? (
                                            <span className="flex items-center gap-2">
                                                <SpinnerThinIcon className="w-4 h-4 animate-spin" />
                                                Reactivating…
                                            </span>
                                        ) : "Confirm reactivation"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Override status modal ── */}
            {showOverride && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget && !isOverriding) { setShowOverride(false) } }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-amber-100 dark:bg-amber-900/30">
                            <ArrowPathIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">
                            Change status — Order #{order.orderNumber}
                        </h3>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
                            Override bypasses the normal flow. Current status: <span className="font-medium text-wg-text dark:text-wg-dark-text">{order.status}</span>
                        </p>

                        {/* Status select */}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-2">
                                New status <span className="text-red-500">*</span>
                            </label>
                            <AdminSelect
                                value={overrideStatus}
                                onChange={setOverrideStatus}
                                placeholder="Select a status…"
                                required
                                options={ALL_OVERRIDABLE_STATUSES.filter(s => s !== order.status).map(s => ({
                                    value: s,
                                    label: ORDER_STATUS_VISUAL[s]?.label ?? s,
                                    icon: (
                                        <span className={`w-2.5 h-2.5 rounded-full inline-block ${ORDER_STATUS_VISUAL[s]?.dot ?? "bg-wg-muted"}`} />
                                    ),
                                }))}
                            />
                        </div>

                        {/* Refund warning */}
                        {overrideStatus === "CANCELLED" && order.paidAt && (
                            <div className="mb-4 flex items-start gap-2.5 rounded-brand border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-3">
                                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 dark:text-amber-300">
                                    This order was paid. Setting it to <strong>Cancelled</strong> will automatically trigger a full wallet refund.
                                </p>
                            </div>
                        )}

                        {/* Reason */}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-2">
                                Reason <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                maxHeight={180}
                                value={overrideReason}
                                onChange={setOverrideReason}
                                placeholder="e.g. Wrong status selected, customer request…"
                                minRows={3}
                                maxLength={280}
                                className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/30"
                            />
                            <div className="flex justify-between mt-1">
                                {overrideError && <p className="text-xs text-red-500 dark:text-red-400">{overrideError}</p>}
                                <span className="text-xs text-wg-muted dark:text-wg-dark-muted ml-auto">{overrideReason.length}/280</span>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setShowOverride(false); setOverrideStatus(""); setOverrideReason(""); setOverrideError("") }}
                                disabled={isOverriding}
                                className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                            >
                                Keep current
                            </button>
                            <button
                                onClick={handleOverride}
                                disabled={isOverriding || !overrideStatus || !overrideReason.trim()}
                                className="px-4 py-2 text-sm font-medium rounded-brand bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
                            >
                                {isOverriding ? (
                                    <span className="flex items-center gap-2">
                                        <SpinnerThinIcon className="w-4 h-4 animate-spin" />
                                        Overriding…
                                    </span>
                                ) : "Confirm override"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
