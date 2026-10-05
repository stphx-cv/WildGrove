"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Tickets — /tickets
// Two-panel layout: ticket list (left) + email-thread detail (right)
// All state-changing actions require confirmation before executing.
// ══════════════════════════════════════════════════════════════════

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { createClient } from "@wildgrove/core/clients/client"
import { AdminSelect, type SelectOption } from "@/components/AdminSelect"
import { LoadingState } from "@/components/LoadingState"
import { Textarea } from "@wildgrove/ui/Textarea"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import {
    ArrowPathIcon,
    ArrowUturnLeftIcon,
    CheckCircleIcon,
    ChevronLeftIcon,
    CloseIcon,
    DocumentArrowDownIcon,
    ExclamationTriangleIcon,
    ForwardIcon,
    InformationCircleIcon,
    LockClosedIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    Spinner,
    TicketIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

// ── Types ────────────────────────────────────────────────────────

interface TicketSummary {
    id: string
    ticketNumber: number
    formattedNumber: string
    category: string
    subject: string
    status: string
    priority: string
    assignedAdminId: string | null
    customerName: string
    customerEmail: string | null
    customerAvatar: string | null
    messageCount: number
    lastMessage: string | null
    lastMessageRole: string | null
    lastMessageAt: string
    createdAt: string
    updatedAt: string
}

interface Attachment {
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
}

interface Message {
    id: string
    senderId: string
    senderRole: "USER" | "AGENT" | "SYSTEM"
    content: string
    isInternal: boolean
    createdAt: string
    attachments: Attachment[]
}

interface TicketDetail {
    ticket: {
        id: string
        ticketNumber: number
        formattedNumber: string
        category: string
        subject: string
        status: string
        priority: string
        priorityLockedByAdmin: boolean
        assignedAdminId: string | null
        locale: string
        createdAt: string
        updatedAt: string
    }
    customer: {
        name: string | null
        email: string | null
        phone: string | null
        avatar: string | null
    } | null
    messages: Message[]
}

// A pending action that requires confirmation before executing
interface ConfirmAction {
    title: string
    description: string
    confirmLabel: string
    confirmVariant: "primary" | "danger" | "warning"
    execute: () => Promise<void>
}

// ── Option constants ──────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
    OPEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
    IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
    AWAITING_REPLY: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
    RESOLVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-500 border-gray-200 dark:border-gray-700/60",
}

const STATUS_LABELS: Record<string, string> = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    AWAITING_REPLY: "Awaiting Reply",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
}

const PRIORITY_LABELS: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
}

const PRIORITY_DOTS: Record<string, string> = {
    LOW: "bg-slate-400",
    MEDIUM: "bg-blue-400",
    HIGH: "bg-orange-400",
    URGENT: "bg-red-500",
}

const CATEGORY_LABELS: Record<string, string> = {
    GENERAL_INQUIRY: "General",
    RESERVATIONS: "Reservations",
    COMPLAINTS_SUGGESTIONS: "Complaints",
    BILLING: "Billing",
    OTHER: "Other",
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

// ── Select options ────────────────────────────────────────────────

const CATEGORY_OPTIONS: SelectOption[] = [
    { value: "GENERAL_INQUIRY", label: "General" },
    { value: "RESERVATIONS", label: "Reservations" },
    { value: "COMPLAINTS_SUGGESTIONS", label: "Complaints" },
    { value: "BILLING", label: "Billing" },
    { value: "OTHER", label: "Other" },
]

const PRIORITY_OPTIONS: SelectOption[] = [
    {
        value: "LOW",
        label: "Low",
        icon: <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />,
    },
    {
        value: "MEDIUM",
        label: "Medium",
        icon: <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />,
    },
    {
        value: "HIGH",
        label: "High",
        icon: <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />,
    },
    {
        value: "URGENT",
        label: "Urgent",
        icon: <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />,
    },
]

const STATUS_FILTER_OPTIONS: SelectOption[] = [
    { value: "open", label: "Open & Active" },
    { value: "all", label: "All Tickets" },
    { value: "OPEN", label: "Open" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "AWAITING_REPLY", label: "Awaiting Reply" },
    { value: "RESOLVED", label: "Resolved" },
    { value: "CLOSED", label: "Closed" },
]

// ── Page ─────────────────────────────────────────────────────────

/** `GET /api/tickets` answers `{ success, data, callerRole }` — `callerRole` sits beside `data`. */
type TicketsPayload = { data?: TicketSummary[]; callerRole?: "ADMIN" | "OWNER" | null }

export default function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ ticket?: string | string[] }> }) {
    // `?ticket=<id>` opens that ticket: notifications link here, and the old
    // `/tickets/<id>` links redirect here.
    const { ticket: ticketParam } = use(searchParams)
    const linkedTicketId = typeof ticketParam === "string" && ticketParam ? ticketParam : null
    const [selectedId, setSelectedId] = useState<string | null>(linkedTicketId)
    // A notification clicked while this page is open changes only the query.
    const [lastLinkedTicketId, setLastLinkedTicketId] = useState(linkedTicketId)
    if (linkedTicketId !== lastLinkedTicketId) {
        setLastLinkedTicketId(linkedTicketId)
        if (linkedTicketId) setSelectedId(linkedTicketId)
    }
    const [detail, setDetail] = useState<TicketDetail | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)

    // Reply state
    const [replyText, setReplyText] = useState("")
    const [isInternal, setIsInternal] = useState(false)
    const [isSending, setIsSending] = useState(false)
    // When set, the reply box is pre-filled quoting a specific message
    const [quotedMessage, setQuotedMessage] = useState<Message | null>(null)
    const replyRef = useRef<HTMLTextAreaElement>(null)

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("open")
    const [categoryFilter, setCategoryFilter] = useState<string>("")
    const [priorityFilter, setPriorityFilter] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState<string>("")

    // Confirmation modal
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
    const [isConfirming, setIsConfirming] = useState(false)
    const [hasHydrated, setHasHydrated] = useState(false)

    useEffect(() => {
        setHasHydrated(true)
    }, [])

    // ── Tickets ──────────────────────────────────────────────────
    // `/api/tickets` puts `callerRole` beside `data`, so the whole body is the
    // cached value here rather than just the rows.

    const listKey = useMemo(() => {
        const params = new URLSearchParams()
        if (statusFilter === "open") params.set("status", "OPEN,IN_PROGRESS,AWAITING_REPLY")
        else if (statusFilter !== "all") params.set("status", statusFilter)
        if (categoryFilter) params.set("category", categoryFilter)
        if (priorityFilter) params.set("priority", priorityFilter)
        if (searchQuery) params.set("search", searchQuery)
        params.set("limit", "50")
        return `/api/tickets?${params}`
    }, [statusFilter, categoryFilter, priorityFilter, searchQuery])

    const { data: listBody, isLoading } = useCmsQuery<TicketsPayload>(listKey)

    const tickets = listBody?.data ?? []
    const callerRole = listBody?.callerRole ?? null

    const refreshTickets = useCallback(() => { void invalidateCms("/api/tickets") }, [])

    // ── Fetch ticket detail ──────────────────────────────────────

    const fetchDetail = useCallback(async (ticketId: string) => {
        setIsDetailLoading(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}`)
            const json = await res.json()
            if (json.success) {
                setDetail(json.data)
            }
        } catch {
            // silent
        } finally {
            setIsDetailLoading(false)
        }
    }, [])

    useEffect(() => {
        if (selectedId) {
            fetchDetail(selectedId)
            setReplyText("")
            setIsInternal(false)
            setQuotedMessage(null)
        } else {
            setDetail(null)
        }
    }, [selectedId, fetchDetail])

    // ── Realtime ─────────────────────────────────────────────────

    useEffect(() => {
        const insforge = createClient()
        const globalChannel = insforge.channel("admin:tickets")
        globalChannel.on("broadcast", { event: "new-ticket" }, () => {
            refreshTickets()
        }).subscribe()
        return () => { insforge.removeChannel(globalChannel) }
    }, [refreshTickets])

    useEffect(() => {
        if (!selectedId) return
        const insforge = createClient()
        const channel = insforge.channel(`admin:ticket:${selectedId}`)
        channel
            .on("broadcast", { event: "new-message" }, (payload) => {
                const msg = payload.payload?.message as Message | undefined
                if (msg) {
                    setDetail((prev) => {
                        if (!prev) return prev
                        if (prev.messages.some((m) => m.id === msg.id)) return prev
                        return { ...prev, messages: [...prev.messages, msg] }
                    })
                }
            })
            .subscribe()
        return () => { insforge.removeChannel(channel) }
    }, [selectedId])

    // ── Confirm helper ───────────────────────────────────────────

    async function runConfirmAction() {
        if (!confirmAction) return
        setIsConfirming(true)
        try {
            await confirmAction.execute()
        } finally {
            setIsConfirming(false)
            setConfirmAction(null)
        }
    }

    // ── Actions ──────────────────────────────────────────────────

    async function handleReply() {
        const text = replyText.trim()
        if (!text || !selectedId || isSending) return
        setIsSending(true)
        try {
            const res = await fetch(`/api/tickets/${selectedId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, isInternal }),
            })
            const json = await res.json()
            if (json.success) {
                const newMsg = json.data.message as Message
                setDetail((prev) => {
                    if (!prev) return prev
                    const status =
                        !newMsg.isInternal &&
                        (prev.ticket.status === "OPEN" || prev.ticket.status === "IN_PROGRESS")
                            ? "AWAITING_REPLY"
                            : prev.ticket.status
                    return {
                        ...prev,
                        ticket: { ...prev.ticket, status },
                        messages: [...prev.messages, newMsg],
                    }
                })
                setReplyText("")
                setIsInternal(false)
                setQuotedMessage(null)
                refreshTickets()
            }
        } catch {
            // silent
        } finally {
            setIsSending(false)
        }
    }

    function requestStatusChange(newStatus: string) {
        if (!selectedId || !detail) return
        const labels: Record<string, { title: string; desc: string; label: string; variant: ConfirmAction["confirmVariant"] }> = {
            IN_PROGRESS: {
                title: "Mark as In Progress?",
                desc: "The ticket will be moved to In Progress and the customer will be notified.",
                label: "Mark In Progress",
                variant: "primary",
            },
            RESOLVED: {
                title: "Resolve this ticket?",
                desc: "The ticket will be marked as Resolved. The customer will receive a resolution notification.",
                label: "Resolve Ticket",
                variant: "primary",
            },
            CLOSED: {
                title: "Close this ticket?",
                desc: "The ticket will be permanently closed. The customer will be notified.",
                label: "Close Ticket",
                variant: "warning",
            },
            OPEN: {
                title: "Reopen this ticket?",
                desc: "The ticket will be moved back to Open and the customer will be notified.",
                label: "Reopen Ticket",
                variant: "primary",
            },
        }
        const cfg = labels[newStatus]
        if (!cfg) return
        setConfirmAction({
            title: cfg.title,
            description: cfg.desc,
            confirmLabel: cfg.label,
            confirmVariant: cfg.variant,
            execute: async () => {
                const res = await fetch(`/api/tickets/${selectedId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus }),
                })
                const json = await res.json()
                if (json.success) {
                    setDetail((prev) => prev ? { ...prev, ticket: { ...prev.ticket, status: newStatus } } : prev)
                    refreshTickets()
                    fetchDetail(selectedId)
                }
            },
        })
    }

    function requestPriorityChange(newPriority: string) {
        if (!selectedId || !detail) return
        setConfirmAction({
            title: `Set priority to ${PRIORITY_LABELS[newPriority]}?`,
            description: "This will update the ticket priority and lock it so the customer can no longer change it.",
            confirmLabel: "Update Priority",
            confirmVariant: "primary",
            execute: async () => {
                await fetch(`/api/tickets/${selectedId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ priority: newPriority }),
                })
                setDetail((prev) =>
                    prev ? { ...prev, ticket: { ...prev.ticket, priority: newPriority, priorityLockedByAdmin: true } } : prev
                )
                refreshTickets()
            },
        })
    }

    function requestDelete() {
        if (!selectedId) return
        setConfirmAction({
            title: "Delete this ticket?",
            description: "This will permanently delete the ticket, all messages, and attachments. This action cannot be undone.",
            confirmLabel: "Delete Permanently",
            confirmVariant: "danger",
            execute: async () => {
                const res = await fetch(`/api/tickets/${selectedId}`, { method: "DELETE" })
                const json = await res.json()
                if (json.success) {
                    setSelectedId(null)
                    setDetail(null)
                    refreshTickets()
                }
            },
        })
    }

    function handleReplyToMessage(msg: Message) {
        const sender = msg.senderRole === "USER"
            ? (detail?.customer?.name || "Customer")
            : "Support Team"
        const preview = msg.content.length > 120 ? msg.content.slice(0, 120) + "…" : msg.content
        const quoted = `> ${sender} wrote:\n> "${preview}"\n\n`
        setReplyText(quoted)
        setQuotedMessage(msg)
        setIsInternal(false)
        setTimeout(() => {
            replyRef.current?.focus()
            replyRef.current?.setSelectionRange(quoted.length, quoted.length)
        }, 50)
    }

    // ── Helpers ──────────────────────────────────────────────────

    function formatRelativeTime(dateStr: string) {
        if (!hasHydrated) return "—"
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60_000)
        if (mins < 1) return "now"
        if (mins < 60) return `${mins}m`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h`
        return `${Math.floor(hrs / 24)}d`
    }

    function formatDateTime(dateStr: string) {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Lima",
        })
    }

    function formatFileSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // ── Quote-aware content renderer ─────────────────────────────

    function renderContent(content: string) {
        type Block = { type: "quote" | "text"; lines: string[] }
        const blocks: Block[] = []
        for (const line of content.split("\n")) {
            const isQuote = line.startsWith("> ")
            const last = blocks[blocks.length - 1]
            if (isQuote) {
                if (last?.type === "quote") last.lines.push(line.slice(2))
                else blocks.push({ type: "quote", lines: [line.slice(2)] })
            } else {
                if (last?.type === "text") last.lines.push(line)
                else blocks.push({ type: "text", lines: [line] })
            }
        }
        return (
            <div className="space-y-2">
                {blocks.map((block, i) => {
                    if (block.type === "quote") {
                        const text = block.lines.join("\n").trim()
                        if (!text) return null
                        return (
                            <div key={i} className="border-l-2 border-wg-border/60 dark:border-wg-dark-border/70 pl-3 py-0.5">
                                <p className="text-xs text-wg-muted/70 dark:text-wg-dark-muted/70 italic whitespace-pre-wrap break-words leading-relaxed">{text}</p>
                            </div>
                        )
                    }
                    const text = block.lines.join("\n").trim()
                    if (!text) return null
                    return (
                        <p key={i} className="text-sm leading-relaxed text-wg-text dark:text-wg-dark-text whitespace-pre-wrap break-words">{text}</p>
                    )
                })}
            </div>
        )
    }

    const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length

    // ── Confirm button variant classes ───────────────────────────

    const confirmBtnClass: Record<ConfirmAction["confirmVariant"], string> = {
        primary: "bg-wg-primary dark:bg-wg-dark-primary hover:bg-wg-primary/90 dark:hover:bg-wg-dark-primary/90 text-white",
        danger: "bg-red-600 hover:bg-red-700 text-white",
        warning: "bg-amber-500 hover:bg-amber-600 text-white",
    }

    // ── Render ───────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Tickets</h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Track and respond to customer support requests
                </p>
            </div>

            <div className="rounded-card border border-wg-border/60 dark:border-wg-dark-border/60 bg-wg-surface/30 dark:bg-wg-dark-surface/20 shadow-card overflow-hidden">
                <div className="flex h-[calc(100vh-16rem)] min-h-[600px] overflow-hidden">

                    {/* ═══════ LEFT PANEL — Ticket list ═══════ */}
                    {/* On narrow screens one panel shows at a time: the list, or the selected ticket. */}
                    <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-[360px] lg:w-[400px] flex-shrink-0 border-r border-wg-border/60 dark:border-wg-dark-border/60 flex-col`}>

                        {/* Header */}
                        <div className="px-4 py-4 border-b border-wg-border/50 dark:border-wg-dark-border/50 space-y-3 bg-wg-surface/40 dark:bg-wg-dark-surface/30">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">All Tickets</h2>
                                {openCount > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                        {openCount}
                                    </span>
                                )}
                            </div>

                            {/* Status filter */}
                            <div className="w-full">
                                <AdminSelect
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={STATUS_FILTER_OPTIONS}
                                    placeholder="Filter by status…"
                                    required
                                    className="text-xs"
                                />
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wg-muted/50 dark:text-wg-dark-muted/50 pointer-events-none" strokeWidth={2} />
                                <input
                                    type="text"
                                    placeholder="Search tickets…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 text-xs bg-wg-bg dark:bg-wg-dark-bg border border-wg-border/50 dark:border-wg-dark-border rounded-brand text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 focus:outline-none focus:ring-1 focus:ring-wg-primary/30 transition-all"
                                />
                            </div>

                            {/* Category + Priority filters in a row */}
                            <div className="grid grid-cols-2 gap-2">
                                <AdminSelect
                                    value={categoryFilter}
                                    onChange={setCategoryFilter}
                                    options={CATEGORY_OPTIONS}
                                    placeholder="Category"
                                    className="text-xs"
                                />
                                <AdminSelect
                                    value={priorityFilter}
                                    onChange={setPriorityFilter}
                                    options={PRIORITY_OPTIONS}
                                    placeholder="Priority"
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        {/* Ticket list */}
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <LoadingState size="section" message="Loading tickets…" />
                            ) : tickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                    <TicketIcon className="w-12 h-12 text-wg-muted/20 dark:text-wg-dark-muted/20 mb-4" strokeWidth={1} />
                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted">No tickets found</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-wg-border/30 dark:divide-wg-dark-border/50">
                                    {tickets.map((ticket) => (
                                        <button
                                            key={ticket.id}
                                            onClick={() => setSelectedId(ticket.id)}
                                            className={`w-full text-left px-4 py-4 transition-colors hover:bg-wg-border/8 dark:hover:bg-wg-dark-border/15 ${
                                                selectedId === ticket.id
                                                    ? "bg-wg-primary/5 dark:bg-wg-dark-primary/10 border-l-2 border-l-wg-primary dark:border-l-wg-dark-primary"
                                                    : "border-l-2 border-l-transparent"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    {/* Number + status */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[11px] font-mono font-semibold text-wg-primary dark:text-wg-dark-primary">
                                                            {ticket.formattedNumber}
                                                        </span>
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[ticket.status] || ""}`}>
                                                            {STATUS_LABELS[ticket.status] || ticket.status}
                                                        </span>
                                                    </div>

                                                    {/* Subject */}
                                                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">
                                                        {ticket.subject}
                                                    </p>

                                                    {/* Customer + priority */}
                                                    <div className="flex items-center gap-2 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                                        {ticket.customerAvatar ? (
                                                            <FadeInImage src={ticket.customerAvatar} alt="" width={16} height={16} className="w-4 h-4 rounded-full object-cover shrink-0 border border-wg-border/20 dark:border-wg-dark-border/30" />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full bg-wg-border/40 dark:bg-wg-dark-border flex items-center justify-center text-[8px] font-bold text-wg-muted dark:text-wg-dark-muted shrink-0">
                                                                {ticket.customerName.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="truncate">{ticket.customerName}</span>
                                                        <span className="shrink-0">·</span>
                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOTS[ticket.priority] || ""}`} />
                                                        <span>{PRIORITY_LABELS[ticket.priority] || ticket.priority}</span>
                                                    </div>

                                                    {/* Last message preview */}
                                                    {ticket.lastMessage && (
                                                        <p className="text-xs text-wg-muted/60 dark:text-wg-dark-muted/60 truncate">
                                                            {ticket.lastMessage}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-wg-muted/50 dark:text-wg-dark-muted/50 shrink-0 mt-0.5">
                                                    {formatRelativeTime(ticket.lastMessageAt)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══════ RIGHT PANEL — Detail ═══════ */}
                    <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-wg-bg/30 dark:bg-wg-dark-bg/30 overflow-hidden`}>
                        {!selectedId ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center space-y-3">
                                    <TicketIcon className="w-16 h-16 mx-auto text-wg-muted/15 dark:text-wg-dark-muted/15" strokeWidth={0.5} />
                                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted">Select a ticket to view details</p>
                                </div>
                            </div>
                        ) : isDetailLoading ? (
                            <LoadingState size="section" message="Loading ticket…" className="flex-1 justify-center" />
                        ) : detail ? (
                            <>
                                {/* ── Ticket header ─────────────────────────── */}
                                <div className="px-6 py-4 border-b border-wg-border/50 dark:border-wg-dark-border/50 bg-wg-surface/50 dark:bg-wg-dark-surface/40 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(null)}
                                        className="md:hidden mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                                    >
                                        <ChevronLeftIcon className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                                        All tickets
                                    </button>
                                    <div className="flex items-start justify-between gap-4 flex-wrap">

                                        {/* Title block. Its minimum width sends the actions to their own row when both do not fit. */}
                                        <div className="space-y-1.5 min-w-48 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-mono font-semibold text-wg-primary dark:text-wg-dark-primary">
                                                    {detail.ticket.formattedNumber}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[detail.ticket.status] || ""}`}>
                                                    {STATUS_LABELS[detail.ticket.status] || detail.ticket.status}
                                                </span>
                                                <span className="text-xs text-wg-muted dark:text-wg-dark-muted">
                                                    {CATEGORY_LABELS[detail.ticket.category] || detail.ticket.category}
                                                </span>
                                            </div>

                                            <h2 className="text-base font-semibold text-wg-text dark:text-wg-dark-text leading-snug">
                                                {detail.ticket.subject}
                                            </h2>

                                            {/* Customer info */}
                                            {detail.customer && (
                                                <div className="flex items-center gap-2 text-xs text-wg-muted dark:text-wg-dark-muted">
                                                    {detail.customer.avatar ? (
                                                        <FadeInImage src={detail.customer.avatar} alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover shrink-0 border border-wg-border/20 dark:border-wg-dark-border/30" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-wg-border/40 dark:bg-wg-dark-border flex items-center justify-center text-[9px] font-bold shrink-0">
                                                            {(detail.customer.name || "?").charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="font-medium text-wg-text dark:text-wg-dark-text">{detail.customer.name || "Unknown"}</span>
                                                    {detail.customer.email && <><span>·</span><span>{detail.customer.email}</span></>}
                                                    {detail.customer.phone && <><span>·</span><span>{detail.customer.phone}</span></>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions block */}
                                        <div className="flex items-center gap-2 min-w-0 max-w-full flex-wrap">
                                            {/* Priority selector */}
                                            <AdminSelect
                                                value={detail.ticket.priority}
                                                onChange={requestPriorityChange}
                                                options={PRIORITY_OPTIONS}
                                                placeholder="Priority"
                                                required
                                                className="w-[150px]"
                                            />

                                            {/* Status action buttons */}
                                            {detail.ticket.status === "OPEN" && (
                                                <button
                                                    onClick={() => requestStatusChange("IN_PROGRESS")}
                                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-brand font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/40 transition-colors"
                                                >
                                                    <ForwardIcon className="w-3 h-3" strokeWidth={2} />
                                                    In Progress
                                                </button>
                                            )}
                                            {["OPEN", "IN_PROGRESS", "AWAITING_REPLY"].includes(detail.ticket.status) && (
                                                <button
                                                    onClick={() => requestStatusChange("RESOLVED")}
                                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-brand font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/40 transition-colors"
                                                >
                                                    <CheckCircleIcon className="w-3 h-3" strokeWidth={2} />
                                                    Resolve
                                                </button>
                                            )}
                                            {!["CLOSED", "RESOLVED"].includes(detail.ticket.status) && (
                                                <button
                                                    onClick={() => requestStatusChange("CLOSED")}
                                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-brand font-medium bg-wg-surface dark:bg-wg-dark-surface text-wg-muted dark:text-wg-dark-muted hover:bg-wg-border/30 dark:hover:bg-wg-dark-border/40 border border-wg-border/50 dark:border-wg-dark-border transition-colors"
                                                >
                                                    <LockClosedIcon className="w-3 h-3" strokeWidth={2} />
                                                    Close
                                                </button>
                                            )}
                                            {["RESOLVED", "CLOSED"].includes(detail.ticket.status) && (
                                                <button
                                                    onClick={() => requestStatusChange("OPEN")}
                                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-brand font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/40 transition-colors"
                                                >
                                                    <ArrowPathIcon className="w-3 h-3" strokeWidth={2} />
                                                    Reopen
                                                </button>
                                            )}

                                            {/* Delete — OWNER only */}
                                            {callerRole === "OWNER" && (
                                                <button
                                                    onClick={requestDelete}
                                                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-brand font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200/50 dark:border-red-900/30 transition-colors"
                                                    title="Delete ticket"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Message thread ────────────────────────── */}
                                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
                                    {detail.messages.map((msg) => {

                                        // System message — horizontal separator pill
                                        if (msg.senderRole === "SYSTEM") {
                                            return (
                                                <div key={msg.id} className="flex items-center gap-3 py-3">
                                                    <div className="flex-1 h-px bg-wg-border/30 dark:bg-wg-dark-border/40" />
                                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/30 dark:border-wg-dark-border/50">
                                                        <InformationCircleIcon className="w-3 h-3 text-wg-muted/60 dark:text-wg-dark-muted/60" />
                                                        <span className="text-[11px] text-wg-muted dark:text-wg-dark-muted">{msg.content}</span>
                                                        <span className="text-[10px] text-wg-muted/40">· {formatDateTime(msg.createdAt)}</span>
                                                    </div>
                                                    <div className="flex-1 h-px bg-wg-border/30 dark:bg-wg-dark-border/40" />
                                                </div>
                                            )
                                        }

                                        const isAgent = msg.senderRole === "AGENT"
                                        const senderName = isAgent ? "Support Team" : (detail.customer?.name || "Customer")

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`group rounded-card border overflow-hidden mb-3 ${
                                                    msg.isInternal
                                                        ? "border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-900/8"
                                                        : isAgent
                                                            ? "border-wg-accent/20 dark:border-wg-dark-accent/25 bg-wg-accent/3 dark:bg-wg-dark-accent/5"
                                                            : "border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg"
                                                }`}
                                            >
                                                {/* Message header */}
                                                <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${
                                                    msg.isInternal
                                                        ? "border-amber-200/40 dark:border-amber-800/20 bg-amber-50/60 dark:bg-amber-900/10"
                                                        : isAgent
                                                            ? "border-wg-accent/15 dark:border-wg-dark-accent/20 bg-wg-accent/5 dark:bg-wg-dark-accent/8"
                                                            : "border-wg-border/30 dark:border-wg-dark-border/40 bg-wg-surface/50 dark:bg-wg-dark-surface/30"
                                                }`}>
                                                    <div className="flex items-center gap-2">
                                                        {/* Avatar */}
                                                        {!isAgent && detail.customer?.avatar ? (
                                                            <FadeInImage src={detail.customer.avatar} alt={senderName} width={24} height={24} className="w-6 h-6 rounded-full object-cover shrink-0 border border-wg-border/20 dark:border-wg-dark-border/30" />
                                                        ) : (
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                                                isAgent
                                                                    ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent"
                                                                    : "bg-wg-primary/12 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary"
                                                            }`}>
                                                                {senderName.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="text-xs font-semibold text-wg-text dark:text-wg-dark-text">
                                                            {senderName}
                                                        </span>
                                                        {msg.isInternal && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-medium">
                                                                Internal Note
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <time className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                                            {formatDateTime(msg.createdAt)}
                                                        </time>
                                                        {/* Reply-to-this button */}
                                                        {!msg.isInternal && (
                                                            <button
                                                                onClick={() => handleReplyToMessage(msg)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-brand text-[11px] font-medium text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary hover:bg-wg-primary/8 dark:hover:bg-wg-dark-primary/10 border border-wg-border/30 dark:border-wg-dark-border/40 hover:border-wg-primary/20 dark:hover:border-wg-dark-primary/20 transition-colors"
                                                                title="Reply to this message"
                                                            >
                                                                <ArrowUturnLeftIcon className="w-3 h-3" strokeWidth={2} />
                                                                Reply
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Message body */}
                                                <div className="px-4 py-4">
                                                    {renderContent(msg.content)}

                                                    {/* Attachments */}
                                                    {msg.attachments.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-wg-border/20 dark:border-wg-dark-border/30 flex flex-wrap gap-2">
                                                            {msg.attachments.map((att) => {
                                                                const isImage = IMAGE_MIMES.includes(att.mimeType)
                                                                if (isImage) {
                                                                    return (
                                                                        <a
                                                                            key={att.id}
                                                                            href={att.fileUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="block rounded-lg overflow-hidden border border-wg-border/30 dark:border-wg-dark-border/50 hover:opacity-90 transition-opacity"
                                                                        >
                                                                            {/* unoptimized: the file is private, so the image optimizer must never fetch or cache it */}
                                                                            <FadeInImage src={att.fileUrl} alt={att.fileName} width={180} height={140} unoptimized className="max-w-[180px] max-h-[140px] w-auto h-auto object-cover" />
                                                                        </a>
                                                                    )
                                                                }
                                                                return (
                                                                    <a
                                                                        key={att.id}
                                                                        href={att.fileUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-wg-surface dark:bg-wg-dark-raised border border-wg-border/40 dark:border-wg-dark-border hover:border-wg-primary/30 transition-colors"
                                                                    >
                                                                        <DocumentArrowDownIcon className="w-3.5 h-3.5 text-wg-muted shrink-0" />
                                                                        <span className="text-[11px] font-medium text-wg-text dark:text-wg-dark-text truncate max-w-[120px]">{att.fileName}</span>
                                                                        <span className="text-[10px] text-wg-muted">{formatFileSize(att.fileSize)}</span>
                                                                    </a>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* ── Reply to thread ───────────────────────── */}
                                <div className="px-6 py-4 border-t border-wg-border/50 dark:border-wg-dark-border/50 bg-wg-surface/50 dark:bg-wg-dark-surface/40 shrink-0 space-y-3">

                                    {/* Quoted message indicator */}
                                    {quotedMessage && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-brand bg-wg-primary/6 dark:bg-wg-dark-primary/8 border border-wg-primary/15 dark:border-wg-dark-primary/20">
                                            <ArrowUturnLeftIcon className="w-3.5 h-3.5 text-wg-primary dark:text-wg-dark-primary shrink-0" strokeWidth={2} />
                                            <span className="text-xs text-wg-primary dark:text-wg-dark-primary flex-1 truncate">
                                                Replying to {quotedMessage.senderRole === "USER" ? (detail.customer?.name || "Customer") : "Support Team"}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => { setQuotedMessage(null); setReplyText("") }}
                                                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-wg-primary/15 text-wg-primary dark:text-wg-dark-primary transition-colors"
                                            >
                                                <CloseIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Textarea */}
                                    <Textarea
                                        maxHeight={320}
                                        ref={replyRef}
                                        value={replyText}
                                        onChange={setReplyText}
                                        placeholder={isInternal ? "Write an internal note (only visible to admins)…" : "Type your reply to the customer…"}
                                        minRows={4}
                                        className={`px-4 py-3 text-sm rounded-card border text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/40 focus:outline-none focus:ring-1 transition-all ${
                                            isInternal
                                                ? "bg-amber-50/60 dark:bg-amber-900/8 border-amber-200 dark:border-amber-800/30 focus:ring-amber-300/50 dark:focus:ring-amber-700/30"
                                                : "bg-wg-bg dark:bg-wg-dark-bg border-wg-border/50 dark:border-wg-dark-border focus:ring-wg-primary/25"
                                        }`}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                e.preventDefault()
                                                handleReply()
                                            }
                                        }}
                                    />

                                    {/* Reply toolbar */}
                                    <div className="flex items-center justify-between gap-3">
                                        {/* Internal note toggle */}
                                        <button
                                            type="button"
                                            onClick={() => setIsInternal((v) => !v)}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-brand text-xs font-medium border transition-colors ${
                                                isInternal
                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/40"
                                                    : "bg-wg-surface dark:bg-wg-dark-surface text-wg-muted dark:text-wg-dark-muted border-wg-border/50 dark:border-wg-dark-border hover:border-amber-300 dark:hover:border-amber-700/40 hover:text-amber-600 dark:hover:text-amber-400"
                                            }`}
                                        >
                                            <LockClosedIcon className="w-3.5 h-3.5" />
                                            {isInternal ? "Internal Note" : "Note Only"}
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-wg-muted/50 dark:text-wg-dark-muted/50 hidden sm:block">
                                                Ctrl+Enter to send
                                            </span>
                                            <button
                                                onClick={() => handleReply()}
                                                disabled={!replyText.trim() || isSending}
                                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white hover:bg-wg-primary/90 dark:hover:bg-wg-dark-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                            >
                                                {isSending ? (
                                                    <>
                                                        <Spinner className="w-4 h-4 animate-spin" />
                                                        Sending…
                                                    </>
                                                ) : (
                                                    <>
                                                        <PaperAirplaneIcon className="w-4 h-4" />
                                                        {isInternal ? "Add Note" : "Send Reply"}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── Confirmation modal ──────────────────────────────────────── */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated max-w-md w-full p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                confirmAction.confirmVariant === "danger"
                                    ? "bg-red-100 dark:bg-red-900/30"
                                    : confirmAction.confirmVariant === "warning"
                                        ? "bg-amber-100 dark:bg-amber-900/30"
                                        : "bg-wg-primary/10 dark:bg-wg-dark-primary/15"
                            }`}>
                                {confirmAction.confirmVariant === "danger" ? (
                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                                ) : confirmAction.confirmVariant === "warning" ? (
                                    <LockClosedIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                ) : (
                                    <InformationCircleIcon className="w-5 h-5 text-wg-primary dark:text-wg-dark-primary" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text">
                                    {confirmAction.title}
                                </h3>
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1 leading-relaxed">
                                    {confirmAction.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                disabled={isConfirming}
                                className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border/30 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={runConfirmAction}
                                disabled={isConfirming}
                                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-brand disabled:opacity-50 transition-colors ${confirmBtnClass[confirmAction.confirmVariant]}`}
                            >
                                {isConfirming ? (
                                    <>
                                        <Spinner className="w-4 h-4 animate-spin" />
                                        Working…
                                    </>
                                ) : confirmAction.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
