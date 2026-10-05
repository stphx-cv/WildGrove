"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Live Chat — /chat
// Two-panel layout: session list (left) + conversation view (right)
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { createClient } from "@wildgrove/core/clients/client"
import { Badge } from "@wildgrove/ui/Badge"
import { resolveMenuCategoryDisplay } from "@wildgrove/core/menu-category-display"
import { LoadingState } from "@/components/LoadingState"
import { Textarea } from "@wildgrove/ui/Textarea"
import { APP_DATETIME_TIMEZONE } from "@wildgrove/core/app-datetime-format"
import { SageDecisionDetails } from "@/components/SageDecisionDetails"
import { stripShownDishAside } from "@wildgrove/core/chat/message-blocks"
import { classifyChatHref, promoteChatLinks, publicChatHref } from "@wildgrove/core/chat/message-links"
import {
    ArrowRightIcon,
    CheckIcon,
    ChevronLeftIcon,
    CloseIcon,
    EnvelopeIcon,
    LockOpenIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

// ── Types ────────────────────────────────────────────────────────
interface SessionSummary {
  id: string
  sessionKey: string
  status: "ACTIVE" | "WAITING" | "AGENT_JOINED" | "RESOLVED" | "CANCELLED"
  tier: "FAQ" | "AI" | "HUMAN"
  customerName: string
  customerEmail: string | null
  customerAvatar: string | null
  lastMessage: string | null
  lastMessageAt: string
  messageCount: number
  createdAt: string
  isContactForm?: boolean
  blockedAt?: string | null
  blockedReason?: string | null
}

interface MessageData {
  id: string
  role: "USER" | "ASSISTANT" | "AGENT" | "SYSTEM"
  content: string
  tier: "FAQ" | "AI" | "HUMAN"
  metadata?: Record<string, unknown> | null
  createdAt: string
}

interface SessionDetail {
  id: string
  status: string
  tier: string
  locale: string
  createdAt: string
  customer: {
    name: string | null
    email: string | null
    phone: string | null
    avatar: string | null
  } | null
}

// ── Simple markdown renderer (bold, italic, line breaks) ─────────
function renderMarkdown(text: string, locale: "en" | "es" = "en") {
  const source = promoteChatLinks(text, locale)
  return source.split("\n").map((line, lineIdx, arr) => {
    const parts: React.ReactNode[] = []
    const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index))
      if (match[2] && match[3]) {
        const classified = classifyChatHref(match[3].trim())
        const href = classified.kind === "internal"
          ? publicChatHref(classified.href, locale)
          : classified.href
        parts.push(
          <a
            key={match.index}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {match[2]}
          </a>
        )
      } else if (match[4]) {
        parts.push(<strong key={match.index}>{match[4]}</strong>)
      } else if (match[5]) {
        parts.push(<em key={match.index}>{match[5]}</em>)
      }
      lastIndex = regex.lastIndex
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex))

    return (
      <span key={lineIdx}>
        {parts.length > 0 ? parts : line}
        {lineIdx < arr.length - 1 && <br />}
      </span>
    )
  })
}

// ── Reservation card parser ───────────────────────────────────────
interface ReservationCardData {
  id: string
  date: string
  partySize: number
  notes: string | null
  status: string
}

interface MenuItemCardData {
  id: string
  slug?: string
  name: string
  nameEs?: string | null
  description: string
  descriptionEs?: string | null
  price: string
  priceAmount?: number
  priceCurrency?: string
  category: string
  categorySlug?: string
  categoryEs?: string | null
  tags: string[]
  tagsEs?: string[]
  tagColors?: Record<string, string> | null
  imageUrl: string | null
}

function resolveMenuTagCustomColor(
  tagColors: Record<string, string> | null | undefined,
  displayTag: string,
): string | undefined {
  if (!tagColors || typeof tagColors !== "object") return undefined
  const direct = tagColors[displayTag]
  if (typeof direct === "string" && direct.trim()) return direct
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-")
  const target = norm(displayTag)
  for (const [key, value] of Object.entries(tagColors)) {
    if (typeof value !== "string" || !value.trim()) continue
    if (norm(key) === target) return value
  }
  return undefined
}

function parseReservationCard(content: string): { text: string; reservation: ReservationCardData | null } {
  const match = content.match(/```reservation\r?\n([\s\S]*?)\r?\n```/)
  if (!match) return { text: content, reservation: null }
  try {
    const reservation = JSON.parse(match[1]) as ReservationCardData
    const text = content.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim()
    return { text, reservation }
  } catch {
    return { text: content, reservation: null }
  }
}

function parseReservationList(content: string): { text: string; reservations: ReservationCardData[] | null } {
  const match = content.match(/```reservation-list\r?\n([\s\S]*?)\r?\n```/)
  if (!match) return { text: content, reservations: null }
  try {
    const reservations = JSON.parse(match[1]) as ReservationCardData[]
    const text = content.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim()
    return { text, reservations }
  } catch {
    return { text: content, reservations: null }
  }
}

function parseMenuItems(content: string): { text: string; menuItems: MenuItemCardData[] | null } {
  const match = content.match(/```menu-items\r?\n([\s\S]*?)\r?\n```/)
  if (!match) return { text: content, menuItems: null }
  try {
    const menuItems = JSON.parse(match[1]) as MenuItemCardData[]
    const text = content.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim()
    return { text, menuItems }
  } catch {
    return { text: content, menuItems: null }
  }
}

// ── Admin reservation card ────────────────────────────────────────
function AdminReservationCard({ reservation }: { reservation: ReservationCardData }) {
  const dateObj = new Date(reservation.date)
  const dateStr = dateObj.toLocaleDateString("es-PE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: APP_DATETIME_TIMEZONE,
  })
  const timeStr = dateObj.toLocaleTimeString("es-PE", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: APP_DATETIME_TIMEZONE,
  })

  const statusColors: Record<string, string> = {
    PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    CONFIRMED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    COMPLETED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  }
  const statusLabel: Record<string, string> = {
    PENDING:   "Pendiente",
    CONFIRMED: "Confirmada",
    CANCELLED: "Cancelada",
    COMPLETED: "Completada",
  }

  return (
    <div className="mt-2 rounded-xl border border-wg-border dark:border-wg-dark-border bg-white dark:bg-wg-dark-bg overflow-hidden shadow-sm text-left">
      {/* Header */}
      <div className="bg-wg-primary px-3 py-1.5 flex items-center gap-2">
        <span className="text-sm">🌿</span>
        <span className="text-white text-xs font-semibold">Reserva creada</span>
        <a
          href={`/reservations/${reservation.id}`}
          className="ml-auto text-white/70 hover:text-white text-[10px] underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          Ver en admin
        </a>
      </div>

      {/* Details */}
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-wg-muted dark:text-wg-dark-muted text-xs">📅</span>
          <p className="text-xs font-medium text-wg-text dark:text-wg-dark-text capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-wg-muted dark:text-wg-dark-muted text-xs">🕐</span>
          <p className="text-xs text-wg-text dark:text-wg-dark-text">{timeStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-wg-muted dark:text-wg-dark-muted text-xs">👥</span>
          <p className="text-xs text-wg-text dark:text-wg-dark-text">
            {reservation.partySize} {reservation.partySize === 1 ? "persona" : "personas"}
          </p>
        </div>
        {reservation.notes && (
          <div className="flex items-start gap-2">
            <span className="text-wg-muted dark:text-wg-dark-muted text-xs">📝</span>
            <p className="text-xs text-wg-text dark:text-wg-dark-text">{reservation.notes}</p>
          </div>
        )}
        <div className="pt-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[reservation.status] ?? ""}`}>
            {statusLabel[reservation.status] ?? reservation.status}
          </span>
        </div>
      </div>
    </div>
  )
}

function AdminMenuItemCard({ item, locale }: { item: MenuItemCardData; locale: "en" | "es" }) {
  const displayName =
    locale === "es" && item.nameEs
      ? item.nameEs
      : item.name
  const displayDescription =
    locale === "es" && item.descriptionEs
      ? item.descriptionEs
      : item.description
  const displayTags =
    locale === "es" && item.tagsEs && item.tagsEs.length > 0
      ? item.tagsEs
      : item.tags
  const productCta = locale === "es" ? "Ver producto" : "View product"
  const allMenusCta = locale === "es" ? "Ver todos los menús" : "View all menus"

  const displayPrice =
    typeof item.priceAmount === "number" && item.priceCurrency
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: item.priceCurrency,
          minimumFractionDigits: 2,
        }).format(item.priceAmount)
      : item.price

  const displayCategory = resolveMenuCategoryDisplay({
    locale,
    category: item.category,
    categoryEs: item.categoryEs,
    categorySlug: item.categorySlug,
  })

  return (
    <div className="mt-2 rounded-xl border border-wg-border dark:border-wg-dark-border bg-white dark:bg-wg-dark-bg overflow-hidden shadow-sm text-left">
      <div className="relative h-28 bg-wg-bg dark:bg-wg-dark-raised">
        {item.imageUrl ? (
          <FadeInImage
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="320px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">🌿</div>
        )}
        <span className="absolute top-2 left-2 inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-wg-primary/90 text-white">
          {displayCategory}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text leading-snug">
            {displayName}
          </h4>
          <span className="text-xs font-bold text-wg-accent dark:text-wg-dark-accent whitespace-nowrap">
            {displayPrice}
          </span>
        </div>
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1 line-clamp-2">{displayDescription}</p>

        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {displayTags.map((tag) => (
              <Badge
                key={`${item.id}-${tag}`}
                tag={tag}
                customColor={resolveMenuTagCustomColor(item.tagColors ?? undefined, tag)}
              />
            ))}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={item.slug ? `/${locale}/menu/${item.slug}` : "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-wg-border dark:border-wg-dark-border text-xs font-semibold text-wg-primary dark:text-wg-secondary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"
          >
            {productCta}
            <ArrowRightIcon className="w-3 h-3" strokeWidth={2.5} />
          </a>
          <a
            href={`/${locale}/menu`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-wg-border dark:border-wg-dark-border text-xs font-semibold text-wg-primary dark:text-wg-secondary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"
          >
            {allMenusCta}
          </a>
        </div>
      </div>
    </div>
  )
}

function AdminMenuItemsList({ items, locale }: { items: MenuItemCardData[]; locale: "en" | "es" }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <AdminMenuItemCard key={item.id} item={item} locale={locale} />
      ))}
    </div>
  )
}

// ── The dishes a Sage message did not show ───────────────────────
// A message with dish cards keeps its whole list in metadata.menu; the rest
// reach the guest through "See N more".
function describeMenuList(metadata: Record<string, unknown> | null | undefined): string | null {
  const menu = metadata?.menu as { ids?: unknown; shown?: unknown; continued?: unknown } | undefined
  if (!menu || !Array.isArray(menu.ids) || typeof menu.shown !== "number") return null
  const remaining = menu.ids.length - menu.shown
  if (remaining <= 0) return `All ${menu.ids.length} dishes of the list shown.`
  const dishes = remaining === 1 ? "1 more dish" : `${remaining} more dishes`
  return menu.continued ? `${dishes} not shown here; the guest asked for them.` : `${dishes} not shown; the guest can press See ${remaining} more.`
}

// ── Status badge colors ──────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  AGENT_JOINED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  RESOLVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export default function AdminChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [replyText, setReplyText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [callerRole, setCallerRole] = useState<"ADMIN" | "OWNER" | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmUnblockId, setConfirmUnblockId] = useState<string | null>(null)
  const [isUnblocking, setIsUnblocking] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingAction, setPendingAction] = useState<"pause" | "resume" | "cancel" | "resolve" | null>(null)
  const [isActioning, setIsActioning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "blocked">("active")
  const [mobileView, setMobileView] = useState<"list" | "chat">("list")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // A general setting, not a per-account one: the panel has no preferences per person.
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setShowTechnicalDetails(Boolean(json.data.sageShowTechnicalDetails))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // ── Fetch sessions ─────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat")
      const json = await res.json()
      if (json.success) {
        setSessions(json.data)
        if (json.callerRole) setCallerRole(json.callerRole)
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    // Poll every 10s for new sessions
    const interval = setInterval(fetchSessions, 10_000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  // ── Fetch session messages ─────────────────────────────────────
  // A response for a conversation that is no longer the selected one is
  // dropped, so switching while a request is in flight never shows the
  // previous conversation's messages.
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const fetchMessages = useCallback(async (sessionId: string, options?: { merge?: boolean }) => {
    try {
      const res = await fetch(`/api/chat/${sessionId}`)
      const json = await res.json()
      if (!json.success || selectedIdRef.current !== sessionId) return
      setSessionDetail(json.data.session)
      const fetched = json.data.messages as MessageData[]
      if (!options?.merge) {
        setMessages(fetched)
        return
      }
      // Merge by id, like the storefront widget: a message already on screen
      // (from realtime or a reply just sent) is not duplicated.
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const added = fetched.filter((m) => !known.has(m.id))
        if (added.length === 0) return prev
        return [...prev, ...added].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    }
  }, [])

  // The open conversation is fetched on select and then every 10 seconds,
  // so customer messages arrive even when the realtime channel delivers nothing.
  useEffect(() => {
    if (!selectedId) return
    fetchMessages(selectedId)
    const interval = setInterval(() => fetchMessages(selectedId, { merge: true }), 10_000)
    return () => clearInterval(interval)
  }, [selectedId, fetchMessages])

  // ── InsForge Realtime for active session ───────────────────────
  useEffect(() => {
    if (!selectedId) return

    const insforge = createClient()
    const channel = insforge
      .channel(`admin:chat:${selectedId}`)
      .on("broadcast", { event: "new-message" }, ({ payload }) => {
        const msg = payload.message as MessageData
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .on("broadcast", { event: "status-change" }, ({ payload }) => {
        setSessionDetail((prev) =>
          prev ? { ...prev, status: payload.status } : null
        )
      })
      .subscribe()

    return () => {
      insforge.removeChannel(channel)
    }
  }, [selectedId])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // ── Send reply ─────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selectedId || isSending) return
    setIsSending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedId,
          content: replyText.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setMessages((prev) => [...prev, json.data.message])
        setReplyText("")

        // If admin just intervened, update local state + reload messages
        // to include the system "agent joined" message
        if (json.data.intervened) {
          setSessionDetail((prev) =>
            prev ? { ...prev, status: "AGENT_JOINED", tier: "HUMAN" } : null
          )
          fetchMessages(selectedId)
        }
        fetchSessions()
      }
    } catch (error) {
      console.error("Failed to send reply:", error)
    } finally {
      setIsSending(false)
    }
  }

  // ── Execute confirmed action ───────────────────────────────────
  const executeAction = async (action: "pause" | "resume" | "cancel" | "resolve") => {
    if (!selectedId) return
    setIsActioning(true)
    try {
      const res = await fetch(`/api/chat/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) {
        if (action === "pause") {
          setSessionDetail((prev) =>
            prev ? { ...prev, status: "AGENT_JOINED", tier: "HUMAN" } : null
          )
          if (json.data?.sysMessage) {
            setMessages((prev) => {
              if (prev.some((m: MessageData) => m.id === json.data.sysMessage.id)) return prev
              return [...prev, json.data.sysMessage]
            })
          }
        } else if (action === "resume") {
          setSessionDetail((prev) =>
            prev ? { ...prev, status: "ACTIVE", tier: "AI" } : null
          )
          if (json.data?.sysMessage) {
            setMessages((prev) => {
              if (prev.some((m: MessageData) => m.id === json.data.sysMessage.id)) return prev
              return [...prev, json.data.sysMessage]
            })
          }
        } else if (action === "cancel") {
          setSessionDetail((prev) =>
            prev ? { ...prev, status: "CANCELLED" } : null
          )
        } else if (action === "resolve") {
          setSessionDetail((prev) =>
            prev ? { ...prev, status: "RESOLVED" } : null
          )
        }
        fetchSessions()
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error)
    } finally {
      setIsActioning(false)
      setPendingAction(null)
    }
  }

  // ── Permanently delete session (OWNER only) ────────────────────
  const deleteSession = async (sessionId: string) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/chat/${sessionId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (selectedId === sessionId) {
          setSelectedId(null)
          setSessionDetail(null)
          setMessages([])
          setMobileView("list")
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error)
    } finally {
      setIsDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  const unblockSession = async (sessionId: string) => {
    setIsUnblocking(true)
    try {
      const res = await fetch(`/api/chat/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock" }),
      })
      const json = await res.json()
      if (json.success) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, blockedAt: null, blockedReason: null } : s
          )
        )
      }
    } catch (error) {
      console.error("Failed to unblock session:", error)
    } finally {
      setIsUnblocking(false)
      setConfirmUnblockId(null)
    }
  }

  const selected = sessions.find((s) => s.id === selectedId)
  const waitingCount = sessions.filter((s) => s.status === "WAITING").length
  const blockedCount = sessions.filter((s) => s.blockedAt).length
  const visibleSessions = sessions.filter((s) => {
    if (statusFilter === "active") return !s.blockedAt && ["ACTIVE", "WAITING", "AGENT_JOINED"].includes(s.status)
    if (statusFilter === "blocked") return !!s.blockedAt
    return true
  })

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
          Live Chat
        </h1>
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
          Monitor and manage real-time customer conversations
        </p>
      </div>

      <div className="rounded-card border border-wg-border/60 dark:border-wg-dark-border/60 bg-wg-surface/30 dark:bg-wg-dark-surface/20 shadow-card overflow-hidden">
        <div className="flex h-[calc(100vh-14rem)] sm:h-[calc(100vh-16rem)] min-h-[500px]">
          {/* ── Left panel: Session list ────────────────────────────── */}
          <div className={`${mobileView === "chat" ? "hidden" : "flex"} sm:flex w-full sm:w-80 border-r border-wg-border/60 dark:border-wg-dark-border/60 flex-col`}>
            <div className="p-4 border-b border-wg-border/50 dark:border-wg-dark-border/50">
              <h2 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                Conversations
              </h2>
              <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                {waitingCount} waiting
                {" · "}
                {sessions.length} total
              </p>
              {/* Filter tabs */}
              <div className="flex gap-1 mt-3 rounded-brand bg-wg-border/25 dark:bg-wg-dark-border/40 p-1">
                {(["active", "all", "blocked"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`flex-1 text-xs py-1.5 rounded-brand font-medium transition-colors relative ${
                      statusFilter === f
                        ? f === "blocked"
                          ? "bg-red-600 text-white"
                          : "bg-wg-primary text-white"
                        : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text"
                    }`}
                  >
                    {f === "active" ? "Active" : f === "all" ? "All" : (
                      <span className="flex items-center justify-center gap-1">
                        Blocked
                        {blockedCount > 0 && (
                          <span className={`text-[9px] leading-none px-1 py-0.5 rounded-full font-bold ${statusFilter === "blocked" ? "bg-white/20 text-white" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"}`}>
                            {blockedCount}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <LoadingState size="section" message="Loading chats…" />
              ) : visibleSessions.length === 0 ? (
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted text-center py-8">
                  No chats found
                </p>
              ) : (
                visibleSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`relative group border-b border-wg-border/40 dark:border-wg-dark-border/50 ${
                      selectedId === s.id
                        ? "bg-wg-border/20 dark:bg-wg-dark-border/30"
                        : "hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/20"
                    } transition-colors`}
                  >
                    <button
                      onClick={() => { setSelectedId(s.id); setMobileView("chat") }}
                      className="w-full text-left p-3 pr-8"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate flex items-center gap-1.5">
                          {s.isContactForm && (
                            <EnvelopeIcon className="w-3.5 h-3.5 text-wg-primary dark:text-wg-dark-primary flex-shrink-0" aria-label="Contact Form" />
                          )}
                          {s.customerName}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {s.blockedAt && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                              🚫 Blocked
                            </span>
                          )}
                          {!s.blockedAt && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status] || ""}`}
                            >
                              {s.status === "WAITING" && "⏳ "}
                              {s.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">
                        {s.lastMessage || "No messages yet"}
                      </p>
                      <p className="text-[10px] text-wg-muted/60 dark:text-wg-dark-muted/60 mt-1">
                        {new Date(s.lastMessageAt).toLocaleString()}
                      </p>
                    </button>

                    {/* Unblock button — shown when session is blocked */}
                    {s.blockedAt && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmUnblockId(s.id)
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center opacity-100 transition-colors hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Unblock session"
                      >
                        <LockOpenIcon className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    )}
                    {/* Delete button — OWNER only */}
                    {callerRole === "OWNER" && !s.blockedAt && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(s.id)
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center opacity-100 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400"
                        title="Delete permanently"
                      >
                        <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                )) // end .map
              )}
            </div>
          </div>

          {/* ── Right panel: Conversation ───────────────────────────── */}
          <div className={`${mobileView === "list" ? "hidden" : "flex"} sm:flex flex-1 flex-col`}>
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                  Select a conversation to view
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-wg-border/50 dark:border-wg-dark-border/50 bg-wg-surface/40 dark:bg-wg-dark-surface/30 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Back button — mobile only */}
                    <button
                      onClick={() => setMobileView("list")}
                      className="sm:hidden flex-shrink-0 p-1 -ml-1 rounded-brand text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text transition-colors"
                      aria-label="Back to list"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text truncate">
                        {selected?.customerName || "Chat"}
                      </h3>
                      {sessionDetail?.customer?.email && (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">
                          {sessionDetail.customer.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {sessionDetail && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium hidden sm:inline ${STATUS_STYLES[sessionDetail.status] || ""}`}
                      >
                        {sessionDetail.status}
                      </span>
                    )}

                    {/* Pause Sage — only when Sage is still active */}
                    {(sessionDetail?.status === "ACTIVE" || sessionDetail?.status === "WAITING") && (
                      <button
                        onClick={() => setPendingAction("pause")}
                        className="text-xs px-2 sm:px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors flex items-center gap-1"
                        title="Pause Sage"
                      >
                        <PauseIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                        <span className="hidden sm:inline">Pause Sage</span>
                      </button>
                    )}

                    {/* Resume Sage — only when admin has taken over */}
                    {sessionDetail?.status === "AGENT_JOINED" && (
                      <button
                        onClick={() => setPendingAction("resume")}
                        className="text-xs px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors flex items-center gap-1"
                        title="Resume Sage"
                      >
                        <PlayIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                        <span className="hidden sm:inline">Resume Sage</span>
                      </button>
                    )}

                    {sessionDetail?.status !== "RESOLVED" && sessionDetail?.status !== "CANCELLED" && (
                      <>
                        <button
                          onClick={() => setPendingAction("cancel")}
                          className="text-xs px-2 sm:px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors"
                          title="Cancel"
                        >
                          <span className="hidden sm:inline">Cancel</span>
                          <CloseIcon className="w-3.5 h-3.5 sm:hidden" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => setPendingAction("resolve")}
                          className="text-xs px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors"
                          title="Resolve"
                        >
                          <span className="hidden sm:inline">Resolve</span>
                          <CheckIcon className="w-3.5 h-3.5 sm:hidden" strokeWidth={2} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {messages.map((msg) => {
                    const isUser = msg.role === "USER"
                    const isSystem = msg.role === "SYSTEM"
                    const isAgent = msg.role === "AGENT"
                    const isContactForm = msg.metadata?.source === "contact_form"

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center py-1">
                          <span className="text-[10px] text-wg-muted dark:text-wg-dark-muted italic">
                            {msg.content}
                          </span>
                        </div>
                      )
                    }

                    const { text: textAfterReservation, reservation } = parseReservationCard(stripShownDishAside(msg.content))
                    const { text: textAfterReservationList, reservations } = parseReservationList(textAfterReservation)
                    const { text: cleanContent, menuItems } = parseMenuItems(textAfterReservationList)
                    const menuNote = describeMenuList(msg.metadata)

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                            isUser
                              ? "bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text"
                              : isAgent
                                ? "bg-wg-primary text-white"
                                : "bg-blue-50 dark:bg-blue-950/30 text-wg-text dark:text-wg-dark-text border border-blue-200 dark:border-blue-800/50"
                          }`}
                        >
                          {isContactForm && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary">
                                <EnvelopeIcon className="w-3 h-3" />
                                Contact Form
                              </span>
                            </div>
                          )}
                          {!isUser && !isAgent && (
                            <p className="text-[10px] font-medium mb-0.5 opacity-60">
                              Sage ({msg.tier})
                            </p>
                          )}
                          {cleanContent && (
                            <p className="whitespace-pre-wrap break-words">{renderMarkdown(cleanContent, sessionDetail?.locale === "es" ? "es" : "en")}</p>
                          )}
                          {reservation && <AdminReservationCard reservation={reservation} />}
                          {reservations && reservations.map((res) => (
                            <AdminReservationCard key={res.id} reservation={res} />
                          ))}
                          {menuItems && menuItems.length > 0 && (
                            <AdminMenuItemsList
                              items={menuItems}
                              locale={sessionDetail?.locale === "es" ? "es" : "en"}
                            />
                          )}
                          {menuNote && (
                            <p className="text-[11px] mt-1.5 opacity-70">{menuNote}</p>
                          )}
                          {showTechnicalDetails && msg.role === "ASSISTANT" && (
                            <SageDecisionDetails metadata={msg.metadata} cardCount={menuItems?.length ?? 0} />
                          )}
                          <p className="text-[10px] mt-1 opacity-50">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                {sessionDetail?.status !== "RESOLVED" && sessionDetail?.status !== "CANCELLED" && (
                  <div className="flex items-end gap-2 p-3 border-t border-wg-border/50 dark:border-wg-dark-border/50 bg-wg-surface/40 dark:bg-wg-dark-surface/30">
                    <Textarea
                      value={replyText}
                      onChange={setReplyText}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendReply()
                        }
                      }}
                      placeholder="Type your reply…"
                      minRows={1}
                      maxHeight={96}
                      resizable={false}
                      wrapperClassName="flex-1"
                      className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl border border-wg-muted/30 dark:border-wg-dark-muted/30 bg-wg-surface/50 dark:bg-wg-dark-surface/50 px-3 py-2 text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted focus:outline-none focus:ring-2 focus:ring-wg-primary/30"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim() || isSending}
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-wg-primary text-white text-sm font-medium hover:bg-wg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSending ? "Sending…" : "Send"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── Confirm Action Modal ────────────────────────────────────── */}
    {pendingAction && (() => {
      const configs = {
        pause: {
          title: "Pause Sage?",
          description: "Sage will stop responding automatically. You can resume it at any time.",
          confirmLabel: "Pause Sage",
          confirmClass: "bg-amber-500 hover:bg-amber-600",
        },
        resume: {
          title: "Resume Sage?",
          description: "Sage will take over and respond to the customer automatically.",
          confirmLabel: "Resume Sage",
          confirmClass: "bg-emerald-600 hover:bg-emerald-700",
        },
        cancel: {
          title: "Cancel this conversation?",
          description: "The chat will close silently without sending any message to the customer.",
          confirmLabel: "Cancel conversation",
          confirmClass: "bg-red-600 hover:bg-red-700",
        },
        resolve: {
          title: "Resolve this conversation?",
          description: "The customer will receive a confirmation that their conversation has been resolved.",
          confirmLabel: "Resolve",
          confirmClass: "bg-emerald-800 hover:bg-emerald-900",
        },
      }
      const cfg = configs[pendingAction]
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="modal-zoom bg-white dark:bg-wg-dark-bg rounded-2xl shadow-elevated border border-wg-muted/15 dark:border-wg-dark-muted/15 p-7 w-[420px] max-w-[calc(100vw-2rem)]">
            <h3 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text mb-1">{cfg.title}</h3>
            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{cfg.description}</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPendingAction(null)}
                disabled={isActioning}
                className="flex-1 px-4 py-2 rounded-xl border border-wg-muted/30 dark:border-wg-dark-muted/30 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={() => executeAction(pendingAction)}
                disabled={isActioning}
                className={`flex-1 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${cfg.confirmClass}`}
              >
                {isActioning
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : cfg.confirmLabel
                }
              </button>
            </div>
          </div>
        </div>
      )
    })()}

    {/* ── Confirm Delete Modal (OWNER only) ───────────────────────── */}
    {confirmUnblockId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <style>{`
          @keyframes modal-zoom-in {
            from { opacity: 0; transform: scale(0.93); }
            to   { opacity: 1; transform: scale(1);    }
          }
          .modal-zoom { animation: modal-zoom-in 0.15s ease-out both; will-change: transform, opacity; }
        `}</style>
        <div className="modal-zoom bg-white dark:bg-wg-dark-bg rounded-2xl shadow-elevated border border-wg-muted/15 dark:border-wg-dark-muted/15 p-7 w-[440px] max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <LockOpenIcon className="w-5 h-5 text-green-600 dark:text-green-400" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                Unblock this session?
              </h3>
              <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                The user will be able to use the chat again. All linked sessions for the same account will also be unblocked.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setConfirmUnblockId(null)}
              disabled={isUnblocking}
              className="flex-1 px-4 py-2 rounded-xl border border-wg-muted/30 dark:border-wg-dark-muted/30 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => unblockSession(confirmUnblockId)}
              disabled={isUnblocking}
              className="flex-1 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isUnblocking ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Unblock session"
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmDeleteId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <style>{`
          @keyframes modal-zoom-in {
            from { opacity: 0; transform: scale(0.93); }
            to   { opacity: 1; transform: scale(1);    }
          }
          .modal-zoom { animation: modal-zoom-in 0.15s ease-out both; will-change: transform, opacity; }
        `}</style>
        <div className="modal-zoom bg-white dark:bg-wg-dark-bg rounded-2xl shadow-elevated border border-wg-muted/15 dark:border-wg-dark-muted/15 p-7 w-[440px] max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <TrashIcon className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                Delete conversation permanently?
              </h3>
              <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                This will delete all messages. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setConfirmDeleteId(null)}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 rounded-xl border border-wg-muted/30 dark:border-wg-dark-muted/30 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-surface dark:hover:bg-wg-dark-surface transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteSession(confirmDeleteId)}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Delete permanently"
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
