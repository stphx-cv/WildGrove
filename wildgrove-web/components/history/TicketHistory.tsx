"use client"

import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { ChevronDownIcon, ChevronRightIcon, TicketIcon, TrashIcon } from "@wildgrove/ui/icons"

interface TicketSummary {
    id: string
    ticketNumber: number
    formattedNumber: string
    category: string
    subject: string
    status: string
    priority: string
    messageCount: number
    lastMessage: string | null
    lastMessageRole: string | null
    lastMessageAt: string | null
    createdAt: string
    updatedAt: string
}

type LoadingState = "loading" | "loaded" | "error"

const STATUS_MAP = {
    OPEN: { key: "statusOpen", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
    IN_PROGRESS: { key: "statusInProgress", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
    AWAITING_REPLY: { key: "statusAwaitingReply", bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
    RESOLVED: { key: "statusResolved", bg: "bg-wg-border/30 dark:bg-wg-dark-border/40", text: "text-wg-muted dark:text-wg-dark-muted" },
    CLOSED: { key: "statusClosed", bg: "bg-wg-border/20 dark:bg-wg-dark-border/30", text: "text-wg-muted/70 dark:text-wg-dark-muted/70" },
} as const

const CATEGORY_MAP = {
    GENERAL_INQUIRY: "categoryGeneral",
    RESERVATIONS: "categoryReservations",
    COMPLAINTS_SUGGESTIONS: "categoryComplaints",
    BILLING: "categoryBilling",
    OTHER: "categoryOther",
} as const

const PRIORITY_MAP = {
    LOW: { key: "priorityLow", dot: "bg-slate-400" },
    MEDIUM: { key: "priorityMedium", dot: "bg-blue-400" },
    HIGH: { key: "priorityHigh", dot: "bg-orange-400" },
    URGENT: { key: "priorityUrgent", dot: "bg-red-500" },
} as const

export function TicketHistory() {
    const t = useTranslations("ticketHistory")
    const locale = useLocale()
    const router = useRouter()

    const [tickets, setTickets] = useState<TicketSummary[]>([])
    const [loadingState, setLoadingState] = useState<LoadingState | "unauthenticated">("loading")
    const [isOpen, setIsOpen] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                setLoadingState("loading")
                const res = await fetch("/api/tickets")
                if (cancelled) return
                if (res.status === 401) {
                    setLoadingState("unauthenticated")
                    return
                }
                const json = await res.json()
                if (json.success) {
                    setTickets(json.data)
                    setLoadingState("loaded")
                } else {
                    setLoadingState("error")
                }
            } catch {
                if (!cancelled) setLoadingState("error")
            }
        }
        void load()
        return () => { cancelled = true }
    }, [])

    function hideTicket(id: string) {
        setTickets(prev => prev.filter(t => t.id !== id))
        setConfirmDelete(null)
        fetch(`/api/tickets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "hide" }),
        }).catch((err) => console.error("[TicketHistory] hide error:", err))
    }

    function formatDate(dateStr: string): string {
        const d = new Date(dateStr)
        return d.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    if (loadingState === "unauthenticated") return null

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-4 group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center">
                        <TicketIcon className="w-4 h-4 text-wg-primary dark:text-wg-dark-primary" />
                    </div>
                    <span className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                        {t("title")}
                    </span>
                    {loadingState === "loaded" && tickets.length > 0 && (
                        <span className="bg-wg-accent/10 dark:bg-wg-dark-accent/15 text-wg-accent dark:text-wg-dark-accent text-xs font-medium rounded-full px-2.5 py-0.5">
                            {tickets.length}
                        </span>
                    )}
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-wg-muted dark:text-wg-dark-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Content */}
            <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
                <div className="overflow-hidden">
                    <div className="pb-4 space-y-3">
                        {/* Loading skeleton */}
                        {loadingState === "loading" && (
                            <>
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-card border border-wg-border/50 dark:border-wg-dark-border p-5 animate-pulse">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-2">
                                                <div className="h-4 w-48 bg-wg-border/50 dark:bg-wg-dark-border rounded" />
                                                <div className="h-3 w-64 bg-wg-border/30 dark:bg-wg-dark-border/50 rounded" />
                                                <div className="h-3 w-32 bg-wg-border/20 dark:bg-wg-dark-border/30 rounded" />
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
                        {loadingState === "loaded" && tickets.length === 0 && (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-wg-primary/5 dark:bg-wg-dark-primary/10 flex items-center justify-center">
                                    <TicketIcon className="w-6 h-6 text-wg-muted/50 dark:text-wg-dark-muted/50" />
                                </div>
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                                    {t("empty")}
                                </p>
                            </div>
                        )}

                        {/* Tickets */}
                        {loadingState === "loaded" && tickets.map((ticket) => {
                            const statusCfg = STATUS_MAP[ticket.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.OPEN
                            const catKey = CATEGORY_MAP[ticket.category as keyof typeof CATEGORY_MAP] ?? "categoryOther"
                            const priCfg = PRIORITY_MAP[ticket.priority as keyof typeof PRIORITY_MAP] ?? PRIORITY_MAP.MEDIUM

                            return (
                                <div key={ticket.id} className="relative group">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/contact/tickets/${ticket.id}`)}
                                        className="w-full text-left rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised p-5 transition-shadow hover:shadow-card dark:hover:shadow-glow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0 space-y-1.5">
                                                {/* Ticket number + subject */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-mono font-medium text-wg-primary dark:text-wg-dark-primary shrink-0">
                                                        {ticket.formattedNumber}
                                                    </span>
                                                    <p className="font-medium text-wg-text dark:text-wg-dark-text truncate">
                                                        {ticket.subject}
                                                    </p>
                                                </div>

                                                {/* Category + Priority */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-wg-primary/8 dark:bg-wg-dark-primary/12 text-wg-primary dark:text-wg-dark-primary">
                                                        {t(catKey)}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${priCfg.dot}`} />
                                                        {t(priCfg.key)}
                                                    </span>
                                                </div>

                                                {/* Last message preview */}
                                                {ticket.lastMessage && (
                                                    <p className="text-sm text-wg-muted/70 dark:text-wg-dark-muted/70 truncate">
                                                        {ticket.lastMessage}
                                                    </p>
                                                )}

                                                {/* Date */}
                                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                                                    {formatDate(ticket.createdAt)}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                                                    {t(statusCfg.key)}
                                                </span>
                                                <ChevronRightIcon className="w-4 h-4 text-wg-muted/40 dark:text-wg-dark-muted/40" />
                                            </div>
                                        </div>
                                    </button>

                                    {/* Delete button (always visible — touch devices have no hover) */}
                                    {confirmDelete !== ticket.id ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(ticket.id) }}
                                            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-wg-muted hover:text-red-500 dark:text-wg-dark-muted dark:hover:text-red-400 transition-colors"
                                            aria-label={t("deleteTicket")}
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                        </button>
                                    ) : (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white dark:bg-wg-dark-bg rounded-lg shadow-card border border-wg-muted/20 dark:border-wg-dark-muted/20 p-1 z-10">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); hideTicket(ticket.id) }}
                                                className="px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            >
                                                {t("confirmDelete")}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }}
                                                className="px-2 py-1 text-[10px] font-medium text-wg-muted dark:text-wg-dark-muted hover:bg-wg-surface dark:hover:bg-wg-dark-surface rounded transition-colors"
                                            >
                                                {t("cancel")}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
