"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@wildgrove/core/clients/client"
import { cmsPanelPath } from "@wildgrove/core/urls"
import { LoadingState } from "@/components/LoadingState"
import { BellFlaredIcon } from "@wildgrove/ui/icons"

interface NotificationItem {
  id: string
  type:
    | "CUSTOMER_CREATED"
    | "RESERVATION_CREATED"
    | "RESERVATION_CANCELLED"
    | "RESERVATION_RESCHEDULED"
    | "PROFILE_UPDATED"
    | "CHAT_SESSION_CREATED"
    | "CHAT_MESSAGE_RECEIVED"
    | "CHAT_ESCALATED"
    | "TICKET_CREATED"
    | "TICKET_REPLY_RECEIVED"
  entityType: "PROFILE" | "RESERVATION" | "CHAT_SESSION" | "CHAT_MESSAGE" | "TICKET" | "TICKET_MESSAGE"
  entityId: string
  title: string
  message: string
  href: string | null
  isRead: boolean
  createdAt: string
}

interface NotificationsResponse {
  success: boolean
  data?: {
    items: NotificationItem[]
    unreadCount: number
    nextCursor: string | null
    currentUserId: string
  }
}

export function AdminNotificationsBell() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchNotifications = useCallback(async (nextCursor?: string | null) => {
    try {
      if (!nextCursor) setIsLoading(true)
      const params = new URLSearchParams({ limit: "20" })
      if (nextCursor) params.set("cursor", nextCursor)

      const res = await fetch(`/api/notifications?${params.toString()}`)
      const json = (await res.json()) as NotificationsResponse
      if (!json.success || !json.data) return

      setCurrentUserId(json.data.currentUserId)
      setUnreadCount(json.data.unreadCount)
      setCursor(json.data.nextCursor)
      setItems((prev) => (nextCursor ? [...prev, ...json.data!.items] : json.data!.items))
    } catch (error) {
      console.error("[admin-notifications] fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshNotifications = useCallback(() => {
    fetchNotifications(null).catch(() => {})
  }, [fetchNotifications])

  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }

    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEscape)
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) return

    const insforge = createClient()
    const channel = insforge
      .channel(`admin:notifications:${currentUserId}`)
      .on("broadcast", { event: "new_notification" }, () => {
        refreshNotifications()
      })
      .subscribe()

    return () => {
      insforge.removeChannel(channel)
    }
  }, [currentUserId, refreshNotifications])

  useEffect(() => {
    const handler = () => refreshNotifications()
    window.addEventListener("admin:notification-changed", handler)
    return () => window.removeEventListener("admin:notification-changed", handler)
  }, [refreshNotifications])

  const markOneAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      const json = (await res.json()) as { success: boolean }
      if (!json.success) return

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("[admin-notifications] markOne error:", error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      setIsMarkingAll(true)
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" })
      const json = (await res.json()) as { success: boolean }
      if (!json.success) return

      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error("[admin-notifications] markAll error:", error)
    } finally {
      setIsMarkingAll(false)
    }
  }, [])

  const unreadLabel = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-brand border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
        aria-label="Open notifications"
      >
        <BellFlaredIcon className="w-5 h-5" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
            {unreadLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-card border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface shadow-elevated z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-wg-border/50 dark:border-wg-dark-border">
            <div>
              <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">Notifications</p>
              <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={isMarkingAll || unreadCount === 0}
              className="text-xs font-medium text-wg-primary dark:text-wg-dark-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <LoadingState size="section" message="Loading notifications…" />
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-wg-muted dark:text-wg-dark-muted">
                No notifications yet.
              </p>
            ) : (
              items.map((item) => {
                const content = (
                  <div className="w-full text-left">
                    <div className="flex items-start gap-2">
                      <span className={`mt-2 w-2 h-2 rounded-full ${item.isRead ? "bg-transparent" : "bg-wg-accent dark:bg-wg-dark-accent"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">{item.title}</p>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted line-clamp-2">{item.message}</p>
                        <p className="text-[10px] text-wg-muted/70 dark:text-wg-dark-muted/70 mt-1">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )

                const rowClass =
                  "block px-4 py-3 border-b border-wg-border/40 dark:border-wg-dark-border/50 hover:bg-wg-border/20 dark:hover:bg-wg-dark-border/30 transition-colors"

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={cmsPanelPath(item.href)}
                      className={rowClass}
                      onClick={() => {
                        if (!item.isRead) markOneAsRead(item.id).catch(() => {})
                        setIsOpen(false)
                      }}
                    >
                      {content}
                    </Link>
                  )
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={rowClass}
                    onClick={() => {
                      if (!item.isRead) markOneAsRead(item.id).catch(() => {})
                    }}
                  >
                    {content}
                  </button>
                )
              })
            )}
          </div>

          {cursor && (
            <div className="p-3">
              <button
                type="button"
                onClick={() => fetchNotifications(cursor)}
                className="w-full text-xs py-2 rounded-brand border border-wg-border/60 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
