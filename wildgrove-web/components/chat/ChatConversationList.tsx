"use client"

// ══════════════════════════════════════════════════════════════════
// ChatConversationList — Shows past conversations with delete
// ══════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useChatContext, type ConversationSummary } from "./ChatProvider"
import { ConversationsIcon, PlusIcon, TrashIcon } from "@wildgrove/ui/icons"

export function ChatConversationList() {
  const t = useTranslations("chat")
  const {
    conversations,
    isLoadingList,
    startNewConversation,
    switchConversation,
    deleteConversation,
    activeSessionKey,
  } = useChatContext()

  if (isLoadingList) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-wg-primary/30 border-t-wg-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* New conversation button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={startNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-wg-primary text-white text-sm font-medium hover:bg-wg-primary/90 transition-colors"
        >
          <PlusIcon className="w-4 h-4" strokeWidth={2} />
          {t("newConversation")}
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {conversations.length === 0 ? (
          <div className="text-center py-8">
            <ConversationsIcon className="w-7 h-7 mx-auto mb-2 text-wg-muted dark:text-wg-dark-muted" />
            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
              {t("noConversations")}
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.sessionKey}
              conversation={conv}
              isActive={conv.sessionKey === activeSessionKey}
              onSelect={() => switchConversation(conv.sessionKey)}
              onDelete={() => deleteConversation(conv.sessionKey)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Single conversation item ──────────────────────────────────────
function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: ConversationSummary
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const t = useTranslations("chat")
  const [showConfirm, setShowConfirm] = useState(false)

  const title = conversation.summary ?? (() => {
    const raw = conversation.lastMessage?.content || t("emptyChat")
    return raw
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\*\*([^*]*)\*\*/g, "$1")
      .replace(/\*([^*]*)\*/g, "$1")
      .replace(/_{2}([^_]*)_{2}/g, "$1")
      .replace(/_([^_]*)_/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim()
  })()
  const date = new Date(conversation.updatedAt)
  const isToday = new Date().toDateString() === date.toDateString()
  const timeStr = isToday
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" })

  const statusColor =
    conversation.status === "RESOLVED"
      ? "bg-gray-400"
      : conversation.status === "WAITING"
        ? "bg-amber-400 animate-pulse"
        : conversation.status === "AGENT_JOINED"
          ? "bg-emerald-400"
          : "bg-wg-primary"

  return (
    <div
      className={`flex items-center rounded-xl border transition-all ${
        isActive
          ? "border-wg-primary/30 dark:border-wg-dark-primary/30 bg-wg-primary/5 dark:bg-wg-dark-primary/10"
          : "border-transparent hover:border-wg-muted/20 dark:hover:border-wg-dark-muted/20 hover:bg-wg-surface/50 dark:hover:bg-wg-dark-surface/50"
      }`}
    >
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 text-left px-3 py-2.5 rounded-xl"
      >
        <div className="flex items-start gap-2.5">
          {/* Status dot */}
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusColor}`} />

          <div className="flex-1 min-w-0">
            {/* Title: AI summary if available, fallback to last message */}
            <p className="text-sm text-wg-text dark:text-wg-dark-text truncate leading-snug">
              {title}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-wg-muted dark:text-wg-dark-muted">
                {timeStr}
              </span>
              <span className="text-[10px] text-wg-muted/60 dark:text-wg-dark-muted/60">
                {conversation.messageCount} msg
              </span>
              {conversation.tier === "AI" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary">
                  AI
                </span>
              )}
              {conversation.tier === "HUMAN" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Agent
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Delete button */}
      <div className="flex-shrink-0 pr-2">
        {!showConfirm ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowConfirm(true)
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-wg-muted hover:text-red-500 dark:text-wg-dark-muted dark:hover:text-red-400 transition-all"
            aria-label={t("deleteChat")}
          >
            <TrashIcon className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-white dark:bg-wg-dark-bg rounded-lg shadow-card border border-wg-muted/20 dark:border-wg-dark-muted/20 p-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
                setShowConfirm(false)
              }}
              className="px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              {t("confirmDelete")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowConfirm(false)
              }}
              className="px-2 py-1 text-[10px] font-medium text-wg-muted dark:text-wg-dark-muted hover:bg-wg-surface dark:hover:bg-wg-dark-surface rounded transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
