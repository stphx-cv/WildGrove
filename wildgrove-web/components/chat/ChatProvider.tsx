"use client"

// ══════════════════════════════════════════════════════════════════
// ChatProvider — Global context for Sage chat widget
// Multi-conversation, streaming AI, and session management
// ══════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { usePathname } from "@/i18n/routing"
import { createClient } from "@wildgrove/core/clients/client"
import { isSimilarMessage } from "@wildgrove/core/chat/similar-message"
import type { DeferredRealtimeChannel } from "@wildgrove/core/insforge/realtime"
import type { ChatMode } from "@wildgrove/core/chat/chat-settings"

// ── Types ────────────────────────────────────────────────────────
export interface ChatAction {
  id: string
  label: string
  variant?: "primary" | "secondary"
}

export interface ChatMessageData {
  id: string
  role: "USER" | "ASSISTANT" | "AGENT" | "SYSTEM"
  content: string
  tier: "FAQ" | "AI" | "HUMAN"
  createdAt: string
  actions?: ChatAction[]
  /** Dishes of this message's menu not shown yet; the cards end in a "See N more" button. */
  menuMore?: { remaining: number }
}

export interface SessionData {
  id: string
  status: "ACTIVE" | "WAITING" | "AGENT_JOINED" | "RESOLVED" | "CANCELLED"
  tier: "FAQ" | "AI" | "HUMAN"
  locale: string
}

export interface ConversationSummary {
  id: string
  sessionKey: string
  status: string
  tier: string
  messageCount: number
  summary: string | null
  lastMessage: { content: string; role: string } | null
  createdAt: string
  updatedAt: string
}

// Reservation form flow state — active while the in-chat form is open
export interface ReservationFlowData {
  date: string    // YYYY-MM-DD
  time: string    // HH:MM
  guests: number
  notes: string
}

type ViewMode = "chat" | "list"

/** intro = first visit per tab session; unread = new reply while bubble visible; none = idle */
export type BubbleAttentionMode = "intro" | "unread" | "none"

// Tool activity message shown while Sage fetches data
export type ToolActivityLabel =
  | "menu"
  | "availability"
  | "discounts"
  | "info"
  | "booking"
  | "reservations"
  | null

interface ChatContextValue {
  // Widget
  /** Who answers: the team only, Sage only, or both. "off" never mounts the widget. */
  chatMode: ChatMode
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  bubbleAttentionMode: BubbleAttentionMode
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // Active conversation
  messages: ChatMessageData[]
  session: SessionData | null
  isLoading: boolean
  isSending: boolean
  streamingContent: string
  isStreaming: boolean
  /** The last message is the customer's and Sage's reply is still being written on the server. */
  awaitingReply: boolean
  toolActivity: ToolActivityLabel
  sendMessage: (message: string) => Promise<void>
  requestHuman: () => Promise<void>
  /** "See N more" under a message's dish cards: the next page, as a new message below. */
  loadMoreMenu: (messageId: string) => Promise<void>
  /** The message whose next page is on its way. */
  menuMorePendingId: string | null

  // Multi-conversation
  conversations: ConversationSummary[]
  isLoadingList: boolean
  startNewConversation: () => void
  switchConversation: (sessionKey: string) => Promise<void>
  deleteConversation: (sessionKey: string) => void
  activeSessionKey: string | null

  // In-chat reservation form flow
  reservationFlowActive: boolean
  isSubmittingReservation: boolean
  startReservationFlow: () => void
  cancelReservationFlow: () => void
  submitReservationFlow: (data: ReservationFlowData) => Promise<void>

  // Anti-spam / rate-limit UX
  chatCooldownUntil: number | null
  dispatchAction: (messageId: string, actionId: string) => void
  isSessionBlocked: boolean
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider")
  return ctx
}

// ── localStorage helpers ──────────────────────────────────────────
const BLOCKED_SESSIONS_STORAGE = "wg:blocked-sessions"

function getBlockedSessions(): string[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(BLOCKED_SESSIONS_STORAGE) || "[]") } catch { return [] }
}
function addBlockedSessionKey(key: string) {
  const blocked = getBlockedSessions()
  if (!blocked.includes(key)) {
    blocked.push(key)
    try { localStorage.setItem(BLOCKED_SESSIONS_STORAGE, JSON.stringify(blocked)) } catch {}
  }
}
function isKeyBlocked(key: string): boolean {
  return getBlockedSessions().includes(key)
}

const KEYS_STORAGE = "wg:chat-session-keys"
const ACTIVE_KEY_STORAGE = "wg:chat-active-key"
const HIDDEN_STORAGE = "wg:hidden-chats"
/** Set when the user has opened Sage once this tab session — intro bubble animation stays off until the tab closes. */
const INTRO_DISMISSED_STORAGE = "wg:sage-bubble-intro-dismissed"

function getIntroDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(INTRO_DISMISSED_STORAGE) === "1"
  } catch {
    return false
  }
}

function setIntroDismissed(): void {
  try {
    sessionStorage.setItem(INTRO_DISMISSED_STORAGE, "1")
  } catch {
    /* ignore */
  }
}

function getSessionKeys(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORAGE) || "[]")
  } catch {
    return []
  }
}

function saveSessionKeys(keys: string[]) {
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys))
}

function getActiveKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_KEY_STORAGE)
}

function saveActiveKey(key: string) {
  localStorage.setItem(ACTIVE_KEY_STORAGE, key)
}

function getHiddenChats(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_STORAGE) || "[]")
  } catch {
    return []
  }
}

function addHiddenChat(sessionKey: string) {
  const hidden = getHiddenChats()
  if (!hidden.includes(sessionKey)) {
    hidden.push(sessionKey)
    localStorage.setItem(HIDDEN_STORAGE, JSON.stringify(hidden))
  }
}

// ── Whose conversations these keys are ────────────────────────────
// Set while an account is signed in. When that account signs out, or another
// one signs in on this device, its keys are dropped from this browser.
const OWNER_STORAGE = "wg:chat-owner"

/** How long an unanswered message of the customer's still waits for Sage's reply. */
const PENDING_REPLY_WINDOW_MS = 120_000

function getChatOwner(): string | null {
  if (typeof window === "undefined") return null
  try { return localStorage.getItem(OWNER_STORAGE) } catch { return null }
}

function setChatOwner(profileId: string) {
  try { localStorage.setItem(OWNER_STORAGE, profileId) } catch {}
}

function clearStoredConversations() {
  try {
    localStorage.removeItem(KEYS_STORAGE)
    localStorage.removeItem(ACTIVE_KEY_STORAGE)
    localStorage.removeItem(HIDDEN_STORAGE)
    localStorage.removeItem(OWNER_STORAGE)
    sessionStorage.removeItem("wg_flow_active")
    sessionStorage.removeItem("wg_reservation_draft")
    sessionStorage.removeItem("wg_flow_session_key")
  } catch {}
}

function addSessionKey(key: string) {
  const keys = getSessionKeys()
  if (!keys.includes(key)) {
    keys.unshift(key) // newest first
    saveSessionKeys(keys)
  }
}

// ── Migrate from old single-key system ────────────────────────────
function migrateOldSessionKey() {
  const OLD_KEY = "wg:chat-session-key"
  const oldKey = localStorage.getItem(OLD_KEY)
  if (oldKey) {
    addSessionKey(oldKey)
    if (!getActiveKey()) saveActiveKey(oldKey)
    localStorage.removeItem(OLD_KEY)
  }
}

// ── Provider ─────────────────────────────────────────────────────
export function ChatProvider({
  children,
  locale = "en",
  chatMode,
}: {
  children: ReactNode
  locale?: string
  chatMode: ChatMode
}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [bubbleAttentionMode, setBubbleAttentionMode] = useState<BubbleAttentionMode>(() =>
    getIntroDismissed() ? "none" : "intro",
  )
  const [viewMode, setViewMode] = useState<ViewMode>("chat")
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [awaitingReply, setAwaitingReply] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null)
  const [toolActivity, setToolActivity] = useState<ToolActivityLabel>(null)
  const [menuMorePendingId, setMenuMorePendingId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  // Anti-spam / rate-limit UX state
  const [chatCooldownUntil, setChatCooldownUntil] = useState<number | null>(null)
  const [isSessionBlocked, setIsSessionBlocked] = useState(false)
  const tier1HitCountRef = useRef(0)
  const rateLimitRetryAfterRef = useRef(30)
  const requestHumanRef = useRef<(() => Promise<void>) | null>(null)
  // In-chat reservation form flow
  const [reservationFlowActive, setReservationFlowActive] = useState(false)
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false)
  const channelRef = useRef<DeferredRealtimeChannel | null>(null)
  const userChannelRef = useRef<DeferredRealtimeChannel | null>(null)
  const initializedRef = useRef(false)
  const migratedRef = useRef(false)

  // Refs to access current state inside stable callbacks (avoid stale closures)
  const isOpenRef = useRef(false)
  const sessionRef = useRef<SessionData | null>(null)
  const isSendingRef = useRef(false)
  const messagesRef = useRef<ChatMessageData[]>([])
  const loadSessionRef = useRef<(key: string) => Promise<void>>(() => Promise.resolve())
  const hasOpenedChatThisSessionRef = useRef(getIntroDismissed())

  const triggerBubbleUnreadIfClosed = useCallback((msg?: ChatMessageData) => {
    if (isOpenRef.current) return
    if (msg && msg.role !== "ASSISTANT" && msg.role !== "AGENT") return
    setBubbleAttentionMode("unread")
  }, [])

  // ── Migrate old system on mount ────────────────────────────────
  useEffect(() => {
    if (migratedRef.current) return
    migratedRef.current = true
    migrateOldSessionKey()
    setActiveSessionKey(getActiveKey())
    try {
      localStorage.removeItem("wg:chat-bubble-hidden")
    } catch {
      /* ignore */
    }
  }, [])

  // ── Bubble attention: intro once per tab session; unread when a reply arrives closed ──
  useEffect(() => {
    if (isOpen) {
      hasOpenedChatThisSessionRef.current = true
      setIntroDismissed()
      setBubbleAttentionMode("none")
    } else if (hasOpenedChatThisSessionRef.current) {
      setBubbleAttentionMode("none")
    }
  }, [isOpen])

  // ── Keep refs in sync with state ────────────────────────────────
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { isSendingRef.current = isSending }, [isSending])
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── Load a session by key ──────────────────────────────────────
  const loadSession = useCallback(
    async (sessionKey: string) => {
      // Check blocked state from localStorage first
      const blocked = isKeyBlocked(sessionKey)
      setIsSessionBlocked(blocked)
      if (blocked) {
        setActiveSessionKey(sessionKey)
        saveActiveKey(sessionKey)
        addSessionKey(sessionKey)
        return
      }

      setIsLoading(true)
      setMessages([])
      setSession(null)
      tier1HitCountRef.current = 0
      setChatCooldownUntil(null)

      try {
        const res = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, locale }),
        })
        const json = await res.json()

        if (json.success) {
          const sessionData = json.data.session
          if (sessionData.blockedAt) {
            addBlockedSessionKey(sessionKey)
            setIsSessionBlocked(true)
          }
          setSession(sessionData)
          setMessages(json.data.messages)
          setActiveSessionKey(sessionKey)
          saveActiveKey(sessionKey)
          addSessionKey(sessionKey)
        } else if (res.status === 404) {
          // The conversation belongs to another account: forget the key.
          saveSessionKeys(getSessionKeys().filter((k) => k !== sessionKey))
          if (getActiveKey() === sessionKey) localStorage.removeItem(ACTIVE_KEY_STORAGE)
          setActiveSessionKey(null)
        }
      } catch (error) {
        console.error("[ChatProvider] Load session error:", error)
      } finally {
        setIsLoading(false)
      }
    },
    [locale]
  )

  // Keep loadSession ref in sync
  useEffect(() => { loadSessionRef.current = loadSession }, [loadSession])

  // ── Sync sessions from server for authenticated users ──────────
  // Called on mount (if already logged in) and after SIGNED_IN.
  // Merges server sessions into localStorage so all devices share history.
  const syncSessionsFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions/profile")
      if (!res.ok) return
      const json = await res.json()
      if (!json.success) return

      const serverSessions: ConversationSummary[] = json.data.sessions
      if (serverSessions.length === 0) return

      const serverKeys = serverSessions.map((s) => s.sessionKey)
      const hidden = getHiddenChats()

      // Merge: visible server sessions first (ordered by updatedAt desc), then local-only keys
      const visibleServerKeys = serverKeys.filter((k) => !hidden.includes(k))
      const existingLocalKeys = getSessionKeys()
      const localOnlyKeys = existingLocalKeys.filter(
        (k) => !serverKeys.includes(k) && !hidden.includes(k)
      )
      saveSessionKeys([...visibleServerKeys, ...localOnlyKeys])

      // If no active session key exists, set to most recent visible server session
      if (!getActiveKey() && visibleServerKeys.length > 0) {
        saveActiveKey(visibleServerKeys[0])
        setActiveSessionKey(visibleServerKeys[0])

        // If the chat is already open with no session loaded, load it immediately
        if (isOpenRef.current && !sessionRef.current) {
          loadSessionRef.current(visibleServerKeys[0])
        }
      }
    } catch {
      // silent — sync is best-effort
    }
  }, [])

  // ── Initialize on first open ───────────────────────────────────
  useEffect(() => {
    if (!isOpen || initializedRef.current) return
    initializedRef.current = true

    const key = getActiveKey()
    if (key && !getHiddenChats().includes(key)) {
      loadSession(key)
    } else if (key) {
      // Active key points to a deleted/hidden conversation — clear it
      localStorage.removeItem(ACTIVE_KEY_STORAGE)
      setActiveSessionKey(null)
    }
    // No active key = show welcome screen, user starts fresh
  }, [isOpen, loadSession])

  // ── Listen for sage:open events ────────────────────────────────
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener("sage:open", handleOpen)
    return () => window.removeEventListener("sage:open", handleOpen)
  }, [])

  // Load persisted flow flag after hydration to avoid SSR/client mismatch.
  useEffect(() => {
    try {
      setReservationFlowActive(sessionStorage.getItem("wg_flow_active") === "1")
    } catch {
      // ignore storage access errors
    }
  }, [])

  // ── Re-open widget if a reservation form was in progress ────────
  // After a page refresh, sessionStorage still has wg_flow_active="1",
  // so we reopen the widget so the user can continue where they left off.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("wg_flow_active") === "1") {
        setIsOpen(true)
      }
    } catch {}
  }, [])

  // ── On first open: sync sessions if already logged in ──────────
  // Handles the case where the user opens a new device while already authenticated.
  // The SIGNED_IN event won't fire on a page refresh — this covers it.
  // Deferred until the widget opens so getSession() (and the realtime channels
  // it enables) stays off the critical path of every page load.
  useEffect(() => {
    if (!isOpen) return
    const insforge = createClient()
    insforge.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession) {
        setUserId(authSession.user.id)
        syncSessionsFromServer()
      }
    })
  }, [isOpen, syncSessionsFromServer])

  // ── Forget the signed-out account's conversations ───────────────
  const forgetConversations = useCallback(() => {
    clearStoredConversations()
    setMessages([])
    setSession(null)
    setActiveSessionKey(null)
    setConversations([])
    setUserId(null)
    setReservationFlowActive(false)
    // The next open starts from the welcome screen.
    initializedRef.current = false
  }, [])

  // ── Migrate guest sessions when user logs in ────────────────────
  // Called once per auth state — links orphaned sessions to user profile
  // and syncs sessions from other devices.
  useEffect(() => {
    const insforge = createClient()
    const { data: { subscription } } = insforge.auth.onAuthStateChange(
      async (event, authSession) => {
        // Sign-out from the user menu reloads the page, so it arrives here as
        // an initial state without a session, not as SIGNED_OUT.
        const owner = getChatOwner()
        if (authSession) {
          if (owner && owner !== authSession.user.id) forgetConversations()
          setChatOwner(authSession.user.id)
        } else if (owner) {
          forgetConversations()
        }

        if (event === "SIGNED_IN") {
          if (authSession) setUserId(authSession.user.id)
          // Migrate any local guest sessions to the user's account
          const keys = getSessionKeys()
          for (const key of keys) {
            try {
              await fetch("/api/chat/migrate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionKey: key }),
              })
            } catch {
              // silent — migration is best-effort
            }
          }
          // Sync sessions from server (loads history from other devices)
          await syncSessionsFromServer()
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [syncSessionsFromServer, forgetConversations])

  // ── InsForge Realtime subscription (admin msgs + cross-device sync) ──
  const sessionId = session?.id
  useEffect(() => {
    if (!sessionId) return

    const insforge = createClient()
    const channel = insforge
      .channel(`chat:session:${sessionId}`)
      .on("broadcast", { event: "new-message" }, ({ payload }) => {
        const msg = payload.message as ChatMessageData

        // Manage typing/streaming indicator for cross-device sync:
        // - USER message from another device → show AI typing indicator
        // - ASSISTANT/AGENT message → clear typing indicator
        if (msg.role === "ASSISTANT" || msg.role === "AGENT") {
          setIsStreaming(false)
          setStreamingContent("")
          setToolActivity(null)
        } else if (msg.role === "USER" && !isSendingRef.current) {
          // Another device sent this message — AI response is on its way
          setIsStreaming(true)
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        triggerBubbleUnreadIfClosed(msg)
      })
      .on("broadcast", { event: "status-change" }, ({ payload }) => {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: payload.status,
                ...(payload.tier && { tier: payload.tier }),
              }
            : null
        )
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      insforge.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId, triggerBubbleUnreadIfClosed])

  // ── Read the conversation again, adding only the messages not shown yet ──
  const readConversationAgain = useCallback(
    async (sessionKey: string) => {
      try {
        const res = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, locale }),
        })
        if (!res.ok) return
        const json = await res.json()
        if (!json.success) return
        // The user may have switched conversations while this was in flight.
        if (sessionRef.current?.id !== json.data.session.id) return

        const fresh = json.data.messages as ChatMessageData[]
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id))
          const added = fresh.filter((m) => !known.has(m.id))
          return added.length > 0 ? [...prev, ...added] : prev
        })
        setSession((prev) =>
          prev
            ? { ...prev, status: json.data.session.status, tier: json.data.session.tier }
            : prev
        )
      } catch {
        // The next tick tries again.
      }
    },
    [locale]
  )

  // ── Staff replies: ask again while a person has the conversation ──
  // The realtime channel above is a stub, so nothing pushes an agent's reply.
  // While the window is open and a person holds or is about to take the
  // conversation, re-read it every 10 seconds through the route that opens
  // it, like the panel's chat list. Back with the assistant, it stops.
  const sessionStatus = session?.status
  const sessionTier = session?.tier
  useEffect(() => {
    const withPerson =
      sessionTier === "HUMAN" &&
      (sessionStatus === "WAITING" || sessionStatus === "AGENT_JOINED")
    if (!isOpen || !withPerson || !activeSessionKey) return

    const sessionKey = activeSessionKey
    const timer = setInterval(() => {
      if (isSendingRef.current) return
      void readConversationAgain(sessionKey)
    }, 10_000)

    return () => clearInterval(timer)
  }, [isOpen, sessionStatus, sessionTier, activeSessionKey, readConversationAgain])

  // ── Sage's reply to a message sent from a page the customer left ──
  // The server finishes and saves the reply even when the page that asked
  // is gone, and nothing pushes it here. A conversation whose last message
  // is the customer's, recent and unanswered, shows Sage typing and is read
  // again every 3 seconds until the reply arrives or the window runs out.
  const lastMessage = messages.at(-1)
  const replyPendingSince =
    !isSending && sessionTier !== "HUMAN" && lastMessage?.role === "USER" ? lastMessage.createdAt : null
  useEffect(() => {
    if (!replyPendingSince || !activeSessionKey) return
    // The server's clock stamps the message; never wait longer than the window from now.
    const deadline = Math.min(Date.parse(replyPendingSince), Date.now()) + PENDING_REPLY_WINDOW_MS
    if (Number.isNaN(deadline) || Date.now() >= deadline) return

    const sessionKey = activeSessionKey
    setAwaitingReply(true)
    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(timer)
        setAwaitingReply(false)
        return
      }
      if (isSendingRef.current) return
      void readConversationAgain(sessionKey)
    }, 3_000)

    return () => {
      clearInterval(timer)
      setAwaitingReply(false)
    }
  }, [replyPendingSince, activeSessionKey, readConversationAgain])

  // ── User-level Realtime channel (cross-device deletion sync) ───
  // Listens for session-deleted events from any device of the same user
  // so that deletions are reflected immediately on all open sessions.
  useEffect(() => {
    if (!userId) return

    const insforge = createClient()
    const channel = insforge
      .channel(`user:chat:${userId}`)
      .on("broadcast", { event: "session-deleted" }, ({ payload }) => {
        const deletedKey = payload.sessionKey as string
        if (!deletedKey) return

        // Remove from conversations list
        setConversations((prev) => prev.filter((c) => c.sessionKey !== deletedKey))

        // Remove from localStorage keys
        const keys = getSessionKeys().filter((k) => k !== deletedKey)
        saveSessionKeys(keys)
        addHiddenChat(deletedKey)

        // If this was the active session, clear it
        if (deletedKey === activeSessionKey) {
          setMessages([])
          setSession(null)
          setActiveSessionKey(null)
          localStorage.removeItem(ACTIVE_KEY_STORAGE)
        }
      })
      .subscribe()

    userChannelRef.current = channel

    return () => {
      insforge.removeChannel(channel)
      userChannelRef.current = null
    }
  }, [userId, activeSessionKey])

  // ── Load conversation list ─────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const allKeys = getSessionKeys()
    const hidden = getHiddenChats()
    const visibleKeys = allKeys.filter((k) => !hidden.includes(k))

    if (visibleKeys.length === 0) {
      setConversations([])
      return
    }

    setIsLoadingList(true)
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKeys: visibleKeys }),
      })
      const json = await res.json()
      if (json.success) {
        setConversations(json.data.sessions)
      }
    } catch (error) {
      console.error("[ChatProvider] Load conversations error:", error)
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  // Load list when switching to list view
  useEffect(() => {
    if (viewMode === "list" && isOpen) {
      loadConversations()
    }
  }, [viewMode, isOpen, loadConversations])

  // ── Tier 3: Hard block a session ──────────────────────────────
  const triggerBlock = useCallback(
    async (sessionKey: string, reason: string) => {
      try {
        await fetch("/api/chat/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, reason }),
        })
      } catch {
        // best-effort
      }
      addBlockedSessionKey(sessionKey)
      setIsSessionBlocked(true)
      const farewellMsg: ChatMessageData = {
        id: `sage-farewell-${Date.now()}`,
        role: "ASSISTANT",
        content: locale === "es"
          ? "Lo siento, necesito cerrar nuestra conversación por ahora. Si tienes preguntas, por favor contáctanos a través de nuestro formulario de contacto."
          : "I'm sorry, I'm going to need to close our conversation for now. If you have questions, please contact us through our contact form.",
        tier: "AI",
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, farewellMsg])
      setTimeout(() => setIsOpen(false), 3000)
    },
    [locale]
  )

  // ── Dispatch action from a Sage message ────────────────────────
  const dispatchAction = useCallback(
    (messageId: string, actionId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, actions: undefined } : m))
      )
      if (actionId === "rateLimitConnectYes") {
        requestHumanRef.current?.()
      } else if (actionId === "rateLimitConnectNo") {
        const waitMsg: ChatMessageData = {
          id: `sage-wait-${Date.now()}`,
          role: "ASSISTANT",
          content: locale === "es"
            ? "¡Claro! Estaré disponible para ti en un momento."
            : "Of course! I'll be available for you again shortly.",
          tier: "AI",
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, waitMsg])
        const cooldownMs = (rateLimitRetryAfterRef.current || 30) * 1000
        setChatCooldownUntil(Date.now() + cooldownMs)
      }
    },
    [locale]
  )

  // ── Send a message (with streaming support) ────────────────────
  const sendMessage = useCallback(
    async (message: string) => {
      // isSendingRef is set immediately (synchronous) to prevent race condition
      // where two rapid taps could both pass the isSending state check before
      // React re-renders and the state update propagates.
      if (!message.trim() || isSendingRef.current) return
      isSendingRef.current = true  // lock synchronously before any async work

      let currentKey = activeSessionKey
      if (!currentKey) {
        currentKey = crypto.randomUUID()
        setActiveSessionKey(currentKey)
      }
      // Always persist the key now — handles the case where startNewConversation
      // set state without persisting (to avoid creating empty sessions in the DB).
      addSessionKey(currentKey)
      saveActiveKey(currentKey)

      const trimmed = message.trim()

      // ── Tier 2: 3+ similar user messages (exact or near-duplicate variants) ──
      const userMsgs = messagesRef.current.filter((m) => m.role === "USER")
      const last2 = userMsgs.slice(-2)
      if (
        last2.length >= 2 &&
        isSimilarMessage(last2[last2.length - 1].content, trimmed) &&
        isSimilarMessage(last2[last2.length - 2].content, trimmed) &&
        isSimilarMessage(last2[last2.length - 1].content, last2[last2.length - 2].content)
      ) {
        const spamMsg: ChatMessageData = {
          id: `sage-spam-${Date.now()}`,
          role: "ASSISTANT",
          content: locale === "es"
            ? "Parece que estás enviando mensajes muy parecidos varias veces. ¿Puedo ayudarte con algo más o te gustaría reformular tu pregunta?"
            : "It seems you're sending very similar messages repeatedly. Can I help you with something else, or would you like to rephrase your question?",
          tier: "AI",
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, spamMsg])
        setChatCooldownUntil(Date.now() + 15_000)
        isSendingRef.current = false
        return
      }

      // ── Optimistic user message (appears instantly) ────────────
      const tempId = `temp-${Date.now()}`
      const optimisticMsg: ChatMessageData = {
        id: tempId,
        role: "USER",
        content: trimmed,
        tier: "AI",
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticMsg])
      setIsSending(true)

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey: currentKey,
            message: trimmed,
            locale,
            pathname,
          }),
        })

        // ── Tier 1: Rate limit hit ─────────────────────────────
        if (res.status === 429) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId))
          const retryAfterHeader = res.headers.get("Retry-After")
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30
          rateLimitRetryAfterRef.current = retryAfterSeconds
          tier1HitCountRef.current += 1

          if (tier1HitCountRef.current >= 3 && currentKey) {
            await triggerBlock(currentKey, "tier3_tier1_repeated")
          } else if (chatMode !== "mixed") {
            // Only in the mixed mode is there a person Sage can hand over to.
            const waitMsg: ChatMessageData = {
              id: `sage-ratelimit-${Date.now()}`,
              role: "ASSISTANT",
              content: locale === "es"
                ? "¡Veo que hemos estado charlando bastante! Espera un momento antes de escribir otra vez."
                : "It looks like we've been chatting a lot! Please wait a moment before writing again.",
              tier: "AI",
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, waitMsg])
            setChatCooldownUntil(Date.now() + retryAfterSeconds * 1000)
          } else {
            const rateLimitMsg: ChatMessageData = {
              id: `sage-ratelimit-${Date.now()}`,
              role: "ASSISTANT",
              content: locale === "es"
                ? "¡Veo que hemos estado charlando bastante! ¿Te gustaría que te conecte con uno de nuestros miembros del equipo?"
                : "It looks like we've been chatting a lot! Would you like me to connect you with one of our team members?",
              tier: "AI",
              createdAt: new Date().toISOString(),
              actions: [
                { id: "rateLimitConnectYes", label: locale === "es" ? "Sí, conéctame" : "Yes, connect me", variant: "primary" },
                { id: "rateLimitConnectNo", label: locale === "es" ? "No, esperaré" : "No, I'll wait", variant: "secondary" },
              ],
            }
            setMessages((prev) => [...prev, rateLimitMsg])
          }
          return
        }

        // ── The owner switched the chat off after this page loaded ──
        if (res.status === 403) {
          const refusal = await res.clone().json().catch(() => null) as { error?: string } | null
          if (refusal?.error === "chat_off") {
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== tempId),
              {
                id: `chat-off-${Date.now()}`,
                role: "SYSTEM",
                content: locale === "es"
                  ? "El chat no está disponible en este momento. Puedes escribirnos desde la página de contacto."
                  : "The chat is not available right now. You can write to us from the contact page.",
                tier: "AI",
                createdAt: new Date().toISOString(),
              },
            ])
            return
          }
        }

        // ── Tier 3: Session blocked by server ─────────────────
        if (res.status === 403) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId))
          if (currentKey) {
            addBlockedSessionKey(currentKey)
            setIsSessionBlocked(true)
          }
          const blockedMsg: ChatMessageData = {
            id: `sage-blocked-${Date.now()}`,
            role: "ASSISTANT",
            content: locale === "es"
              ? "Lo siento, necesito cerrar nuestra conversación por ahora. Si tienes preguntas, por favor contáctanos a través de nuestro formulario de contacto."
              : "I'm sorry, I'm going to need to close our conversation for now. If you have questions, please contact us through our contact form.",
            tier: "AI",
            createdAt: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, blockedMsg])
          setTimeout(() => setIsOpen(false), 3000)
          return
        }

        const contentType = res.headers.get("Content-Type") || ""

        // ── Streaming response (AI) ────────────────────────────
        if (contentType.includes("ndjson")) {
          const reader = res.body?.getReader()
          if (!reader) throw new Error("No reader available")

          const decoder = new TextDecoder()
          let buffer = ""

          // Go straight to streaming mode — no typing dots for AI
          setIsStreaming(true)
          setStreamingContent("")

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || "" // keep incomplete line

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const event = JSON.parse(line)

                switch (event.type) {
                  case "user_saved":
                    // Replace optimistic message with the real saved one
                    setMessages((prev) =>
                      prev.map((m) => m.id === tempId ? event.message : m)
                    )
                    break

                  case "session":
                    setSession((prev) =>
                      prev ? { ...prev, ...event.session } : event.session
                    )
                    break

                  case "stream_start":
                    setStreamingContent("")
                    setToolActivity(null)
                    break

                  case "chunk":
                    setStreamingContent((prev) =>
                      (prev + event.text)
                        .replace("[CONNECT_HUMAN]", "")
                        .replace("[START_RESERVATION_FORM]", "")
                    )
                    break

                  case "stream_end":
                    setIsStreaming(false)
                    setStreamingContent("")
                    setToolActivity(null)
                    if (event.message) {
                      setMessages((prev) => {
                        // "Is that all?" continued an earlier list: its button goes.
                        const updated = event.menuContinued
                          ? prev.map((m) => (m.id === event.menuContinued ? { ...m, menuMore: undefined } : m))
                          : prev
                        if (updated.some((m) => m.id === event.message.id)) return updated
                        return [...updated, event.message]
                      })
                      triggerBubbleUnreadIfClosed(event.message)
                    }
                    // Dispatch custom event for reservation history refresh
                    if (event.reservationCreated) {
                      window.dispatchEvent(new CustomEvent("reservation:created"))
                    }
                    // Trigger in-chat reservation form if Sage requested it
                    if (event.reservationFormTriggered) {
                      setReservationFlowActive(true)
                      try {
                        sessionStorage.setItem("wg_flow_active", "1")
                        if (currentKey) sessionStorage.setItem("wg_flow_session_key", currentKey)
                      } catch {}
                    }
                    break

                  case "tool_activity": {
                    // The server emits which tool Sage is calling
                    const toolMap: Record<string, ToolActivityLabel> = {
                      get_menu: "menu",
                      check_availability: "availability",
                      get_active_discounts: "discounts",
                      get_restaurant_info: "info",
                      create_reservation: "booking",
                      get_user_reservations: "reservations",
                    }
                    setToolActivity(toolMap[event.tool] ?? null)
                    break
                  }

                  case "escalation":
                    if (event.session) {
                      setSession((prev) =>
                        prev ? { ...prev, ...event.session } : event.session
                      )
                    }
                    if (event.systemMessage) {
                      setMessages((prev) => {
                        if (prev.some((m) => m.id === event.systemMessage.id))
                          return prev
                        return [...prev, event.systemMessage]
                      })
                    }
                    break

                  case "error":
                    console.error("[ChatProvider] Stream error:", event.error)
                    setIsStreaming(false)
                    setStreamingContent("")
                    setToolActivity(null)
                    break
                }
              } catch {
                // skip malformed JSON
              }
            }
          }

          setIsStreaming(false)
          setToolActivity(null)
        } else {
          // ── Non-streaming response (FAQ, escalation, etc.) ────
          const json = await res.json()

          if (json.success) {
            const { userMessage, assistantMessage, systemMessage, session: updatedSession } = json.data

            setMessages((prev) => {
              // Replace optimistic message with the real one, add assistant
              let updated = userMessage
                ? prev.map((m) => m.id === tempId ? userMessage : m)
                : prev
              if (assistantMessage && !updated.some((m) => m.id === assistantMessage.id)) {
                updated = [...updated, assistantMessage]
              }
              // Team-only mode: the notice that the conversation went to a person
              if (systemMessage && !updated.some((m) => m.id === systemMessage.id)) {
                updated = [...updated, systemMessage]
              }
              return updated
            })

            if (assistantMessage) {
              triggerBubbleUnreadIfClosed(assistantMessage)
            }

            if (updatedSession) {
              setSession((prev) =>
                prev ? { ...prev, ...updatedSession } : updatedSession
              )
            }
          }
        }
      } catch (error) {
        console.error("[ChatProvider] Send error:", error)
        setIsStreaming(false)
        setStreamingContent("")
        setToolActivity(null)
      } finally {
        isSendingRef.current = false  // release synchronous lock
        setIsSending(false)
      }
    },
    [locale, activeSessionKey, pathname, triggerBubbleUnreadIfClosed, triggerBlock, chatMode]
  )

  // ── In-chat reservation form flow ─────────────────────────────
  const startReservationFlow = useCallback(() => {
    setReservationFlowActive(true)
    try {
      sessionStorage.setItem("wg_flow_active", "1")
      if (activeSessionKey) sessionStorage.setItem("wg_flow_session_key", activeSessionKey)
    } catch {}
  }, [activeSessionKey])

  const cancelReservationFlow = useCallback(() => {
    let key = activeSessionKey
    try {
      key = key || sessionStorage.getItem("wg_flow_session_key")
    } catch {}
    setReservationFlowActive(false)
    try {
      sessionStorage.removeItem("wg_flow_active")
      sessionStorage.removeItem("wg_reservation_draft")
      sessionStorage.removeItem("wg_flow_session_key")
    } catch {}
    if (!key) return
    // Sage does not reply. The next message reads that the customer closed the form.
    fetch("/api/chat/reservation/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: key }),
    }).catch(() => {})
  }, [activeSessionKey])

  const submitReservationFlow = useCallback(
    async (data: ReservationFlowData) => {
      setIsSubmittingReservation(true)

      let currentKey = activeSessionKey
      // Make sure there's a session key (flow might start before any message)
      if (!currentKey) {
        currentKey = crypto.randomUUID()
        setActiveSessionKey(currentKey)
        addSessionKey(currentKey)
        saveActiveKey(currentKey)
      }

      // ── Synthetic user message showing selected options ────────
      // Fills the empty space after the bot's prompt and makes the
      // conversation log readable without needing the form re-open.
      const fmtDate = (d: string) => {
        const [y, m, day] = d.split("-").map(Number)
        return new Date(y, m - 1, day).toLocaleDateString(
          locale === "es" ? "es-PE" : "en-US",
          { weekday: "short", month: "short", day: "numeric" }
        )
      }
      const fmtTime = (t: string) => {
        const [h, min] = t.split(":").map(Number)
        const ampm = h >= 12 ? "PM" : "AM"
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        return `${h12}:${String(min).padStart(2, "0")} ${ampm}`
      }
      const guestLabel = locale === "es"
        ? `${data.guests} ${data.guests === 1 ? "persona" : "personas"}`
        : `${data.guests} ${data.guests === 1 ? "guest" : "guests"}`
      const summaryParts = [fmtDate(data.date), fmtTime(data.time), guestLabel]
      if (data.notes) summaryParts.push(`${locale === "es" ? "Nota" : "Note"}: ${data.notes}`)

      const summaryMsg: ChatMessageData = {
        id: `form-summary-${Date.now()}`,
        role: "USER",
        content: summaryParts.join("  ·  "),
        tier: "AI",
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, summaryMsg])

      try {
        const res = await fetch("/api/chat/reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey: currentKey,
            date: data.date,
            time: data.time,
            guests: data.guests,
            notes: data.notes,
            locale,
          }),
        })

        const json = await res.json()

        if (json.success) {
          setReservationFlowActive(false)
          try {
            sessionStorage.removeItem("wg_flow_active")
            sessionStorage.removeItem("wg_reservation_draft")
            sessionStorage.removeItem("wg_flow_session_key")
          } catch {}

          // Add the saved chat message (contains the reservation card block)
          if (json.data.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === json.data.message.id)) return prev
              return [...prev, json.data.message]
            })
          } else {
            // Fallback: add a local-only message with the reservation card
            const reservationJson = JSON.stringify(json.data.reservation)
            const fallbackMsg: ChatMessageData = {
              id: `local-res-${Date.now()}`,
              role: "ASSISTANT",
              content:
                locale === "es"
                  ? `¡Tu reserva ha sido creada! Te enviamos un correo de confirmación.\n\`\`\`reservation\n${reservationJson}\n\`\`\``
                  : `Your reservation has been created! A confirmation email is on its way.\n\`\`\`reservation\n${reservationJson}\n\`\`\``,
              tier: "AI",
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, fallbackMsg])
          }

          // Refresh reservation history widget if open
          window.dispatchEvent(new CustomEvent("reservation:created"))
        } else {
          // Show error as a Sage message and close the form. The rate
          // limiter answers in English, so its 429 gets its own text.
          setReservationFlowActive(false)
          const rateLimitedText = locale === "es"
            ? "Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo."
            : "Too many attempts in a row. Please wait a moment and try again."
          const errorMsg: ChatMessageData = {
            id: `error-${Date.now()}`,
            role: "ASSISTANT",
            content:
              res.status === 429 ? rateLimitedText :
              json.error ||
              (locale === "es"
                ? "No se pudo crear la reserva. Inténtalo de nuevo."
                : "Couldn't create the reservation. Please try again."),
            tier: "AI",
            createdAt: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errorMsg])
        }
      } catch {
        setReservationFlowActive(false)
        const errorMsg: ChatMessageData = {
          id: `error-${Date.now()}`,
          role: "ASSISTANT",
          content:
            locale === "es"
              ? "Error de conexión. Por favor inténtalo de nuevo."
              : "Connection error. Please try again.",
          tier: "AI",
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setIsSubmittingReservation(false)
      }
    },
    [activeSessionKey, locale]
  )

  // ── Request human agent ────────────────────────────────────────
  const requestHuman = useCallback(async () => {
    if (!session || !activeSessionKey) return
    setIsSending(true)

    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, sessionKey: activeSessionKey }),
      })

      const json = await res.json()

      if (json.success) {
        setSession((prev) =>
          prev
            ? { ...prev, status: json.data.session.status, tier: json.data.session.tier }
            : null
        )
        if (json.data.systemMessage) {
          setMessages((prev) => [...prev, json.data.systemMessage])
        }
      }
    } catch (error) {
      console.error("[ChatProvider] Escalation error:", error)
    } finally {
      setIsSending(false)
    }
  }, [session, activeSessionKey])

  // keep ref up-to-date so dispatchAction can call it without a forward reference
  requestHumanRef.current = requestHuman

  // ── "See N more" under dish cards ──────────────────────────────
  const loadMoreMenu = useCallback(
    async (messageId: string) => {
      if (!activeSessionKey || menuMorePendingId) return
      setMenuMorePendingId(messageId)
      try {
        const res = await fetch("/api/chat/menu-more", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: activeSessionKey, messageId, locale }),
        })
        const json = await res.json().catch(() => null)
        // Answered or already continued elsewhere: either way the button goes.
        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === messageId ? { ...m, menuMore: undefined } : m))
          const added = json?.success ? (json.data.message as ChatMessageData) : null
          return added && !updated.some((m) => m.id === added.id) ? [...updated, added] : updated
        })
      } catch (error) {
        console.error("[ChatProvider] Menu page error:", error)
      } finally {
        setMenuMorePendingId(null)
      }
    },
    [activeSessionKey, locale, menuMorePendingId]
  )

  // ── Start new conversation ─────────────────────────────────────
  const startNewConversation = useCallback(() => {
    const newKey = crypto.randomUUID()
    // Don't persist to localStorage yet — only persist when the first message is sent.
    // Persisting eagerly causes empty sessions to appear in the conversation list.
    setActiveSessionKey(newKey)
    setMessages([])
    setSession(null)
    setStreamingContent("")
    setIsStreaming(false)
    setViewMode("chat")
    // Reset anti-spam state for the new session
    tier1HitCountRef.current = 0
    setChatCooldownUntil(null)
    setIsSessionBlocked(false)
    // Clear any in-progress reservation form so it doesn't bleed into the new chat
    setReservationFlowActive(false)
    try {
      sessionStorage.removeItem("wg_flow_active")
      sessionStorage.removeItem("wg_reservation_draft")
      sessionStorage.removeItem("wg_flow_session_key")
    } catch {}
  }, [])

  // ── Switch to an existing conversation ─────────────────────────
  const switchConversation = useCallback(
    async (sessionKey: string) => {
      setViewMode("chat")
      await loadSession(sessionKey)
    },
    [loadSession]
  )

  // ── Delete conversation ────────────────────────────────────────
  // Authenticated users: delete from DB (propagates to all devices via Realtime).
  // Guest users: hide locally via localStorage only.
  const deleteConversation = useCallback(
    (sessionKey: string) => {
      // Find the conversation to check if it has a pending human request
      setConversations((prev) => {
        const conv = prev.find((c) => c.sessionKey === sessionKey)

        // If it's waiting for a human agent, cancel it silently in the background
        if (
          conv &&
          conv.tier === "HUMAN" &&
          conv.status !== "RESOLVED"
        ) {
          fetch("/api/chat/escalate", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: conv.id,
              sessionKey,
              locale,
            }),
          }).catch((err) =>
            console.error("[ChatProvider] Cancel escalation error:", err)
          )
        }

        return prev.filter((c) => c.sessionKey !== sessionKey)
      })

      // Remove from local keys list and mark hidden (fallback for guest / offline)
      const updatedKeys = getSessionKeys().filter((k) => k !== sessionKey)
      saveSessionKeys(updatedKeys)
      addHiddenChat(sessionKey)

      // If deleting the active conversation, clear it
      if (sessionKey === activeSessionKey) {
        setMessages([])
        setSession(null)
        setActiveSessionKey(null)
        localStorage.removeItem(ACTIVE_KEY_STORAGE)
      }

      // Authenticated: mark hidden in DB so it disappears on all linked devices
      // (session stays in DB — admin can still see it in the CMS)
      if (userId) {
        fetch("/api/chat/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey }),
        }).catch((err) =>
          console.error("[ChatProvider] Hide session error:", err)
        )
      }
    },
    [activeSessionKey, locale, userId]
  )

  return (
    <ChatContext.Provider
      value={{
        chatMode,
        isOpen,
        setIsOpen,
        bubbleAttentionMode,
        viewMode,
        setViewMode,
        messages,
        session,
        isLoading,
        isSending,
        streamingContent,
        isStreaming,
        awaitingReply,
        toolActivity,
        sendMessage,
        requestHuman,
        loadMoreMenu,
        menuMorePendingId,
        conversations,
        isLoadingList,
        startNewConversation,
        switchConversation,
        deleteConversation,
        activeSessionKey,
        reservationFlowActive,
        isSubmittingReservation,
        startReservationFlow,
        cancelReservationFlow,
        submitReservationFlow,
        chatCooldownUntil,
        dispatchAction,
        isSessionBlocked,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
