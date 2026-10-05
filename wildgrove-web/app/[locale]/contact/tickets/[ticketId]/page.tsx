"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { useParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Link } from "@/i18n/routing"
import { createClient as createBrowserClient } from "@wildgrove/core/clients/client"
import { Textarea } from "@wildgrove/ui/Textarea"
import {
    formatAppTimeFromIso,
    formatAppWeekdayAndDateFromIso,
    normalizeDateFormatPreference,
    normalizeTimeFormatPreference,
} from "@wildgrove/core/app-datetime-format"
import {
    ArrowLeftIcon,
    ArrowUturnLeftIcon,
    ChatBubbleLeftRightIcon,
    CheckCircleIcon,
    CloseIcon,
    DocumentArrowDownIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    LockClosedIcon,
    PaperAirplaneIcon,
    PaperClipIcon,
    Spinner,
    UserIcon,
} from "@wildgrove/ui/icons"

// ── Types ────────────────────────────────────────────────────────

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
    createdAt: string
    attachments: Attachment[]
}

interface TicketDetail {
    id: string
    ticketNumber: number
    formattedNumber: string
    category: string
    subject: string
    status: string
    priority: string
    priorityLockedByAdmin: boolean
    locale: string
    createdAt: string
    updatedAt: string
    profile: { name: string | null; avatarUrl: string | null } | null
    messages: Message[]
}

// ── Constants ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { key: string; bg: string; text: string; border: string }> = {
    OPEN: {
        key: "statusOpen",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-800/40",
    },
    IN_PROGRESS: {
        key: "statusInProgress",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-800/40",
    },
    AWAITING_REPLY: {
        key: "statusAwaitingReply",
        bg: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800/40",
    },
    RESOLVED: {
        key: "statusResolved",
        bg: "bg-wg-surface dark:bg-wg-dark-surface",
        text: "text-wg-muted dark:text-wg-dark-muted",
        border: "border-wg-border/50 dark:border-wg-dark-border",
    },
    CLOSED: {
        key: "statusClosed",
        bg: "bg-wg-surface dark:bg-wg-dark-surface",
        text: "text-wg-muted/70 dark:text-wg-dark-muted/70",
        border: "border-wg-border/50 dark:border-wg-dark-border",
    },
}

const CATEGORY_LABELS: Record<string, string> = {
    GENERAL_INQUIRY: "categoryGeneral",
    RESERVATIONS: "categoryReservations",
    COMPLAINTS_SUGGESTIONS: "categoryComplaints",
    BILLING: "categoryBilling",
    OTHER: "categoryOther",
}

const PRIORITY_DOTS: Record<string, string> = {
    LOW: "bg-slate-400",
    MEDIUM: "bg-blue-400",
    HIGH: "bg-orange-400",
    URGENT: "bg-red-500",
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 5

// ── Page ─────────────────────────────────────────────────────────

export default function TicketDetailPage() {
    const params = useParams()
    const ticketId = params.ticketId as string
    const t = useTranslations("ticketDetail")
    const th = useTranslations("ticketHistory")
    const locale = useLocale()

    const [ticket, setTicket] = useState<TicketDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Compose state (hidden until user clicks Reply on a message)
    const [isComposeOpen, setIsComposeOpen] = useState(false)
    const [composeText, setComposeText] = useState("")
    const [composeFiles, setComposeFiles] = useState<File[]>([])
    const [composeQuoteSender, setComposeQuoteSender] = useState("")
    const [composeQuotePreview, setComposeQuotePreview] = useState("")
    const [sending, setSending] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dropRef = useRef<HTMLDivElement>(null)
    const composeRef = useRef<HTMLTextAreaElement>(null)

    // Cancel state
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [wasCancelledByUser, setWasCancelledByUser] = useState(false)
    const [displayDateFormat, setDisplayDateFormat] = useState("DD/MM/YYYY")
    const [displayTimeFormat, setDisplayTimeFormat] = useState("24h")

    useEffect(() => {
        fetch("/api/reservation-config")
            .then((r) => r.json())
            .then((d: { dateFormat?: string; timeFormat?: string }) => {
                if (typeof d.dateFormat === "string") setDisplayDateFormat(normalizeDateFormatPreference(d.dateFormat))
                if (typeof d.timeFormat === "string") setDisplayTimeFormat(normalizeTimeFormatPreference(d.timeFormat))
            })
            .catch(() => {})
    }, [])

    // ── Fetch ticket ─────────────────────────────────────────────

    const fetchTicket = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/tickets/${ticketId}`)
            const json = await res.json()
            if (json.success) {
                setTicket(json.data)
                setError(null)
            } else {
                setError(t("errorLoad"))
            }
        } catch {
            setError(t("errorLoad"))
        } finally {
            setLoading(false)
        }
    }, [ticketId, t])

    useEffect(() => { fetchTicket() }, [fetchTicket])

    // ── Realtime subscription ────────────────────────────────────

    useEffect(() => {
        if (!ticketId) return
        const insforge = createBrowserClient()
        const channel = insforge.channel(`ticket:${ticketId}`)

        channel
            .on("broadcast", { event: "new-message" }, (payload: { payload?: { message?: Message } }) => {
                const msg = payload.payload?.message
                if (msg) {
                    setTicket((prev) => {
                        if (!prev) return prev
                        if (prev.messages.some((m) => m.id === msg.id)) return prev
                        return { ...prev, messages: [...prev.messages, msg] }
                    })
                }
            })
            .on("broadcast", { event: "status-change" }, (payload: { payload?: { status?: string } }) => {
                const newStatus = payload.payload?.status
                if (newStatus) {
                    setTicket((prev) => prev ? { ...prev, status: newStatus } : prev)
                }
            })
            .subscribe()

        return () => { insforge.removeChannel(channel) }
    }, [ticketId])

    // ── Cancel handler ───────────────────────────────────────────

    async function handleCancel() {
        setCancelling(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}`, { method: "PATCH" })
            const json = await res.json()
            if (json.success) {
                setWasCancelledByUser(true)
                setTicket((prev) => {
                    if (!prev) return prev
                    const sysMsg = json.data.systemMessage as Message
                    return {
                        ...prev,
                        status: "CLOSED",
                        messages: prev.messages.some((m) => m.id === sysMsg.id)
                            ? prev.messages
                            : [...prev.messages, sysMsg],
                    }
                })
            }
        } catch {
            // silent
        } finally {
            setCancelling(false)
            setShowCancelModal(false)
        }
    }

    // ── Reply handler ─────────────────────────────────────────────

    async function handleSendReply() {
        if (!composeText.trim() || sending) return
        setSending(true)
        try {
            const formData = new FormData()
            // Prepend quoted block if replying to a specific message
            const messageContent = composeQuoteSender && composeQuotePreview
                ? `> ${composeQuoteSender} wrote:\n> "${composeQuotePreview}"\n\n${composeText.trim()}`
                : composeText.trim()
            formData.append("message", messageContent)
            for (const file of composeFiles) {
                formData.append("files", file)
            }
            const res = await fetch(`/api/tickets/${ticketId}/reply`, {
                method: "POST",
                body: formData,
            })
            const json = await res.json()
            if (json.success) {
                const newMsg = json.data.message as Message
                setTicket((prev) => {
                    if (!prev) return prev
                    const status = prev.status === "AWAITING_REPLY" ? "OPEN" : prev.status
                    return { ...prev, status, messages: [...prev.messages, newMsg] }
                })
                setComposeText("")
                setComposeFiles([])
                setComposeQuoteSender("")
                setComposeQuotePreview("")
                setIsComposeOpen(false)
            }
        } catch {
            // silent
        } finally {
            setSending(false)
        }
    }

    // ── File handlers ────────────────────────────────────────────

    function addFiles(fileList: FileList | File[]) {
        const newFiles = Array.from(fileList).filter((f) => f.size <= MAX_FILE_SIZE)
        setComposeFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES))
    }

    function removeFile(index: number) {
        setComposeFiles((prev) => prev.filter((_, i) => i !== index))
    }

    // ── Format helpers ───────────────────────────────────────────

    function formatDate(dateStr: string) {
        const weekdayLocale = locale === "es" ? "es-PE" : "en-US"
        return formatAppWeekdayAndDateFromIso(dateStr, displayDateFormat, weekdayLocale)
    }

    function formatTime(dateStr: string) {
        return formatAppTimeFromIso(dateStr, displayTimeFormat)
    }

    function formatFileSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // ── Quote-aware content renderer ─────────────────────────────

    function renderContent(content: string, textClassName: string) {
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
                        <p key={i} className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${textClassName}`}>{text}</p>
                    )
                })}
            </div>
        )
    }

    // ── Open reply compose ────────────────────────────────────────

    function handleOpenReply(msg: Message) {
        const senderName = msg.senderRole === "USER" ? t("you") : t("supportTeam")
        // Use only non-quoted lines as preview so we don't nest quotes
        const rawContent = msg.content.replace(/^>.*\n?/gm, "").trim()
        const preview = rawContent.length > 100 ? rawContent.slice(0, 100) + "…" : rawContent
        setComposeQuoteSender(senderName)
        setComposeQuotePreview(preview)
        setComposeText("")
        setIsComposeOpen(true)
        setTimeout(() => composeRef.current?.focus(), 50)
    }

    // ── Loading state ────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg">
                <div className="content-wrapper section-padding">
                    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
                        <div className="h-4 w-32 bg-wg-border/40 dark:bg-wg-dark-border/50 rounded" />
                        <div className="h-8 w-96 bg-wg-border/40 dark:bg-wg-dark-border/50 rounded" />
                        <div className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-40 bg-wg-border/20 dark:bg-wg-dark-border/30 rounded-card" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (error || !ticket) {
        return (
            <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-wg-muted dark:text-wg-dark-muted">{error || t("notFound")}</p>
                    <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 text-sm text-wg-primary dark:text-wg-dark-primary hover:underline"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        {t("backToTickets")}
                    </Link>
                </div>
            </div>
        )
    }

    const statusCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.OPEN
    const catKey = CATEGORY_LABELS[ticket.category] ?? "categoryOther"
    const priDot = PRIORITY_DOTS[ticket.priority] ?? PRIORITY_DOTS.MEDIUM
    const isActive = !["CLOSED", "RESOLVED"].includes(ticket.status)

    const allMessages = [...ticket.messages]

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg">
            <div className="content-wrapper section-padding">
                <div className="max-w-3xl mx-auto">

                    {/* ── Back link ─────────────────────────────────────── */}
                    <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors mb-6"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        {t("backToTickets")}
                    </Link>

                    {/* ── Header card ───────────────────────────────────── */}
                    <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface p-6 mb-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="space-y-3 flex-1 min-w-0">
                                {/* Ticket number + status */}
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="font-mono text-sm font-semibold text-wg-primary dark:text-wg-dark-primary">
                                        {ticket.formattedNumber}
                                    </span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                        {th(statusCfg.key)}
                                    </span>
                                </div>

                                {/* Subject */}
                                <h1 className="font-display text-xl font-bold text-wg-text dark:text-wg-dark-text leading-tight">
                                    {ticket.subject}
                                </h1>

                                {/* Meta row */}
                                <div className="flex items-center gap-3 flex-wrap text-sm text-wg-muted dark:text-wg-dark-muted">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-wg-primary/8 dark:bg-wg-dark-primary/12 text-wg-primary dark:text-wg-dark-primary">
                                        {th(catKey)}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-xs">
                                        <span className={`w-2 h-2 rounded-full ${priDot}`} />
                                        {th(`priority${ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}` as Parameters<typeof th>[0])}
                                    </span>
                                    <span className="text-xs">{t("createdOn")} {formatDate(ticket.createdAt)}</span>
                                </div>
                            </div>

                            {/* Cancel button — only if ticket is still active */}
                            {isActive && (
                                <button
                                    type="button"
                                    onClick={() => setShowCancelModal(true)}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <CloseIcon className="w-3.5 h-3.5" />
                                    {t("cancelTicket")}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Status banners ────────────────────────────────── */}
                    {ticket.status === "RESOLVED" && (
                        <div className="mb-6 p-4 rounded-card bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("resolvedBanner")}</p>
                        </div>
                    )}
                    {ticket.status === "CLOSED" && (
                        <div className="mb-6 p-4 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border flex items-start gap-3">
                            <LockClosedIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted shrink-0 mt-0.5" />
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                                {wasCancelledByUser ? t("cancelledBanner") : t("closedBanner")}
                            </p>
                        </div>
                    )}

                    {/* ── Message thread ────────────────────────────────── */}
                    <div className="space-y-0">
                        {allMessages.map((msg, index) => {

                            // ── System message ───────────────────────────
                            if (msg.senderRole === "SYSTEM") {
                                return (
                                    <div key={msg.id} className="flex items-center gap-3 py-4">
                                        <div className="flex-1 h-px bg-wg-border/30 dark:bg-wg-dark-border/40" />
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/30 dark:border-wg-dark-border/50">
                                            <InformationCircleIcon className="w-3 h-3 text-wg-muted/60 dark:text-wg-dark-muted/60" />
                                            <span className="text-[11px] text-wg-muted dark:text-wg-dark-muted">{msg.content}</span>
                                            <span className="text-[10px] text-wg-muted/40 dark:text-wg-dark-muted/40">· {formatTime(msg.createdAt)}</span>
                                        </div>
                                        <div className="flex-1 h-px bg-wg-border/30 dark:bg-wg-dark-border/40" />
                                    </div>
                                )
                            }

                            const isUser = msg.senderRole === "USER"

                            return (
                                <div
                                    key={msg.id}
                                    className={`rounded-card border overflow-hidden ${
                                        index === 0 || allMessages[index - 1]?.senderRole === "SYSTEM"
                                            ? ""
                                            : "-mt-px"
                                    } ${
                                        isUser
                                            ? "border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg"
                                            : "border-wg-accent/20 dark:border-wg-dark-accent/25 bg-wg-accent/3 dark:bg-wg-dark-accent/5"
                                    }`}
                                >
                                    {/* Message header */}
                                    <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b ${
                                        isUser
                                            ? "border-wg-border/30 dark:border-wg-dark-border/50 bg-wg-surface/60 dark:bg-wg-dark-surface/40"
                                            : "border-wg-accent/15 dark:border-wg-dark-accent/20 bg-wg-accent/5 dark:bg-wg-dark-accent/8"
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            {/* Avatar */}
                                            {isUser && ticket.profile?.avatarUrl ? (
                                                <FadeInImage
                                                    src={ticket.profile.avatarUrl}
                                                    alt={ticket.profile.name || ""}
                                                    width={28}
                                                    height={28}
                                                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-wg-border/20 dark:border-wg-dark-border/30"
                                                />
                                            ) : (
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                                    isUser
                                                        ? "bg-wg-primary/15 dark:bg-wg-dark-primary/20 text-wg-primary dark:text-wg-dark-primary"
                                                        : "bg-wg-accent/15 dark:bg-wg-dark-accent/20 text-wg-accent dark:text-wg-dark-accent"
                                                }`}>
                                                    {isUser ? (
                                                        ticket.profile?.name ? (
                                                            <span>{ticket.profile.name.charAt(0).toUpperCase()}</span>
                                                        ) : (
                                                            <UserIcon className="w-3.5 h-3.5" />
                                                        )
                                                    ) : (
                                                        <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                                                    {isUser ? t("you") : t("supportTeam")}
                                                </span>
                                            </div>
                                        </div>
                                        <time className="text-xs text-wg-muted dark:text-wg-dark-muted shrink-0">
                                            {formatDate(msg.createdAt)} · {formatTime(msg.createdAt)}
                                        </time>
                                    </div>

                                    {/* Message body */}
                                    <div className="px-5 py-5">
                                        {renderContent(msg.content, "text-wg-text dark:text-wg-dark-text")}

                                        {/* Attachments */}
                                        {msg.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-wg-border/20 dark:border-wg-dark-border/30 flex flex-wrap gap-2">
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
                                                                <FadeInImage
                                                                    src={att.fileUrl}
                                                                    alt={att.fileName}
                                                                    width={200}
                                                                    height={160}
                                                                    unoptimized
                                                                    className="max-w-[200px] max-h-[160px] w-auto h-auto object-cover"
                                                                />
                                                            </a>
                                                        )
                                                    }
                                                    return (
                                                        <a
                                                            key={att.id}
                                                            href={att.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-wg-surface dark:bg-wg-dark-raised border border-wg-border/40 dark:border-wg-dark-border hover:border-wg-primary/30 dark:hover:border-wg-dark-primary/30 transition-colors"
                                                        >
                                                            <DocumentArrowDownIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-wg-text dark:text-wg-dark-text truncate max-w-[140px]">{att.fileName}</p>
                                                                <p className="text-[10px] text-wg-muted dark:text-wg-dark-muted">{formatFileSize(att.fileSize)}</p>
                                                            </div>
                                                        </a>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* Reply button — only on active tickets */}
                                        {isActive && (
                                            <div className="mt-4 pt-3 border-t border-wg-border/15 dark:border-wg-dark-border/20 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenReply(msg)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary hover:bg-wg-primary/6 dark:hover:bg-wg-dark-primary/8 border border-wg-border/30 dark:border-wg-dark-border/50 hover:border-wg-primary/20 dark:hover:border-wg-dark-primary/20 transition-colors"
                                                >
                                                    <ArrowUturnLeftIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                                    {t("reply")}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Compose area — opens when user clicks Reply ────────── */}
                    {isActive && isComposeOpen && (
                        <div className="mt-8">
                            {/* Section label */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-1 h-px bg-wg-border/30 dark:bg-wg-dark-border/40" />
                                <span className="text-xs font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                                    {t("addFollowUp")}
                                </span>
                                <div className="flex-1 h-px bg-wg-border/30 dark:bg-wg-dark-border/40" />
                            </div>

                            <div
                                ref={dropRef}
                                className={`rounded-card border-2 transition-colors ${
                                    dragOver
                                        ? "border-wg-primary dark:border-wg-dark-primary bg-wg-primary/5 dark:bg-wg-dark-primary/5"
                                        : "border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface"
                                }`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setDragOver(false)
                                    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
                                }}
                            >
                                {/* Quote indicator */}
                                {composeQuoteSender && composeQuotePreview && (
                                    <div className="px-5 pt-4">
                                        <div className="border-l-2 border-wg-primary/40 dark:border-wg-dark-primary/40 pl-3 py-0.5">
                                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                                <span className="font-medium">{t("replyingTo")} {composeQuoteSender}:</span>{" "}
                                                <span className="italic">{composeQuotePreview}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <Textarea
                                    maxHeight={320}
                                    ref={composeRef}
                                    value={composeText}
                                    onChange={setComposeText}
                                    placeholder={t("followUpPlaceholder")}
                                    minRows={5}
                                    className="bg-transparent text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/40 dark:placeholder:text-wg-dark-muted/40 focus:outline-none p-5 leading-relaxed"
                                />

                                {/* Attached files */}
                                {composeFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 px-5 pb-4">
                                        {composeFiles.map((file, i) => (
                                            <div
                                                key={`${file.name}-${i}`}
                                                className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-wg-border/25 dark:bg-wg-dark-border/40 text-xs text-wg-text dark:text-wg-dark-text"
                                            >
                                                <PaperClipIcon className="w-3 h-3 text-wg-muted dark:text-wg-dark-muted shrink-0" />
                                                <span className="truncate max-w-[140px]">{file.name}</span>
                                                <span className="text-wg-muted dark:text-wg-dark-muted">({formatFileSize(file.size)})</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(i)}
                                                    className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-wg-muted hover:text-red-600 transition-colors"
                                                >
                                                    <CloseIcon className="w-3 h-3" strokeWidth={2} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Toolbar */}
                                <div className="flex items-center justify-between px-5 py-3 border-t border-wg-border/30 dark:border-wg-dark-border/40">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={composeFiles.length >= MAX_FILES}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <PaperClipIcon className="w-3.5 h-3.5" />
                                            {t("attachmentLabel")}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            className="hidden"
                                            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.doc,.docx"
                                            onChange={(e) => {
                                                if (e.target.files) addFiles(e.target.files)
                                                e.target.value = ""
                                            }}
                                        />
                                        <span className="text-[10px] text-wg-muted/50 dark:text-wg-dark-muted/50">{t("attachmentMaxSize")}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsComposeOpen(false)
                                                setComposeText("")
                                                setComposeFiles([])
                                                setComposeQuoteSender("")
                                                setComposeQuotePreview("")
                                            }}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-border/20 dark:hover:bg-wg-dark-border/30 transition-colors"
                                        >
                                            {t("discardReply")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSendReply}
                                            disabled={!composeText.trim() || sending}
                                            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white hover:bg-wg-primary/90 dark:hover:bg-wg-dark-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            {sending ? (
                                                <>
                                                    <Spinner className="w-4 h-4 animate-spin" />
                                                    {t("sending")}
                                                </>
                                            ) : (
                                                <>
                                                    <PaperAirplaneIcon className="w-4 h-4" />
                                                    {t("sendFollowUp")}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Cancel confirmation modal ─────────────────────────────── */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated max-w-md w-full p-6 space-y-4">
                        {/* Icon */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text">{t("cancelConfirmTitle")}</h3>
                            </div>
                        </div>

                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                            {t("cancelConfirmMessage")}
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCancelModal(false)}
                                disabled={cancelling}
                                className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border/30 transition-colors disabled:opacity-50"
                            >
                                {t("cancelKeepBtn")}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-brand bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                            >
                                {cancelling ? (
                                    <>
                                        <Spinner className="w-3.5 h-3.5 animate-spin" />
                                        {t("cancelling")}
                                    </>
                                ) : t("cancelConfirmBtn")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
