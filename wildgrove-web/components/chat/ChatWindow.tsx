"use client"

// ══════════════════════════════════════════════════════════════════
// ChatWindow — Main chat conversation UI
// Supports streaming, conversation list, drag handle, and resize
// ══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useChatContext } from "./ChatProvider"
import type { ToolActivityLabel } from "./ChatProvider"
import { ChatMessage, StreamingMessage, ReservationCardMessage, ReservationListMessage, MenuItemsMessage, parseStructuredBlocks } from "./ChatMessage"
import type { ChatMessageData } from "./ChatProvider"
import { ChatInput } from "./ChatInput"
import { ChatConversationList } from "./ChatConversationList"
import { ChatReservationFlow } from "./ChatReservationFlow"
import {
    ChevronDownCompactIcon,
    ChevronLeftIcon,
    ConversationsIcon,
    MaximizeIcon,
    MinimizeIcon,
    PlusCompactIcon,
    SageMark,
    SpinnerArrowsIcon,
} from "@wildgrove/ui/icons"

/**
 * Removes consecutive duplicate user messages (same content within 10s).
 * Keeps the later one (it has the real DB id) and discards the earlier.
 */
function dedupMessages(messages: ChatMessageData[]): ChatMessageData[] {
  return messages.filter((msg, idx) => {
    if (msg.role !== "USER") return true
    const next = messages[idx + 1]
    if (
      next &&
      next.role === "USER" &&
      next.content === msg.content &&
      Math.abs(new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 10_000
    ) {
      return false // drop earlier duplicate, keep the next one
    }
    return true
  })
}

interface ChatWindowProps {
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void
  isDragging?: boolean
  sizeMode?: "compact" | "expanded"
  onToggleSize?: () => void
}

export function ChatWindow({
  onDragStart,
  isDragging,
  sizeMode = "compact",
  onToggleSize,
}: ChatWindowProps) {
  const t = useTranslations("chat")
  const locale = useLocale()
  const {
    chatMode,
    messages,
    session,
    isLoading,
    isSending,
    isStreaming,
    awaitingReply,
    streamingContent,
    toolActivity,
    sendMessage,
    loadMoreMenu,
    menuMorePendingId,
    setIsOpen,
    viewMode,
    setViewMode,
    startNewConversation,
    activeSessionKey,
    reservationFlowActive,
    isSubmittingReservation,
    cancelReservationFlow,
    submitReservationFlow,
    chatCooldownUntil,
  } = useChatContext()

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: isStreaming ? "instant" : "smooth",
      })
    }
  }, [messages.length, streamingContent, isStreaming])

  return (
    <div className="flex flex-col h-full">
      {/* ── Header (draggable area) ───────────────────────────────── */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-wg-muted/20 dark:border-wg-dark-muted/20 bg-wg-primary text-white rounded-t-2xl select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        <div className="flex items-center gap-2.5">
          {/* Back / Conversations button */}
          {viewMode === "list" ? (
            <button
              onClick={() => setViewMode("chat")}
              className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors -ml-1"
              aria-label={t("backToChat")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ChevronLeftIcon className="w-[18px] h-[18px]" />
            </button>
          ) : (
            <button
              onClick={() => setViewMode("list")}
              className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors -ml-1"
              aria-label={t("conversations")}
              title={t("conversations")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ConversationsIcon className="w-5 h-5" />
            </button>
          )}

          {/* Sage info */}
          <div className="w-[34px] h-[34px] rounded-[10px] bg-wg-surface dark:bg-wg-secondary text-wg-primary dark:text-wg-primary flex items-center justify-center shrink-0">
            <SageMark variant="compact" className="w-[22px] h-[22px]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">
              {viewMode === "list" ? t("conversations") : chatMode === "staff" ? t("headerStaff") : "Sage"}
            </h3>
            {viewMode === "chat" && (
              <p className="text-[10px] opacity-80">
                {session?.status === "WAITING"
                  ? t("waitingStatus")
                  : session?.status === "AGENT_JOINED"
                    ? t("agentJoinedStatus")
                    : t("onlineStatus")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* New chat button */}
          {viewMode === "chat" && (
            <button
              onClick={startNewConversation}
              className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label={t("newConversation")}
              title={t("newConversation")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <PlusCompactIcon className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Resize toggle */}
          {onToggleSize && (
            <button
              onClick={onToggleSize}
              className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label={sizeMode === "compact" ? t("expand") : t("compact")}
              title={sizeMode === "compact" ? t("expand") : t("compact")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {sizeMode === "compact" ? (
                <MaximizeIcon className="w-[18px] h-[18px]" />
              ) : (
                <MinimizeIcon className="w-[18px] h-[18px]" />
              )}
            </button>
          )}

          {/* Minimize button */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label={t("minimize")}
            title={t("minimize")}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ChevronDownCompactIcon className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* ── Body: List view or Chat view ───────────────────────── */}
      {viewMode === "list" ? (
        <ChatConversationList />
      ) : (
        <>
          {/* ── Messages ──────────────────────────────────────── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto py-3 space-y-1 scroll-smooth chat-scroll"
          >
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-wg-primary/30 border-t-wg-primary rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 && !isStreaming ? (
              <div className="px-4 py-6 text-center">
                <SageMark className="w-12 h-12 mx-auto mb-2 text-wg-primary dark:text-wg-secondary" />
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                  {chatMode === "staff" ? t("greetingStaff") : t("greeting")}
                </p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
                  {chatMode === "staff" ? t("greetingHintStaff") : t("greetingHint")}
                </p>
              </div>
            ) : (
              <>
                {dedupMessages(messages).flatMap((msg) => {
                  if (msg.role !== "ASSISTANT") {
                    return [<ChatMessage key={msg.id} message={msg} />]
                  }
                  // Every structured block the message carries, in its order,
                  // after the text. A reservation card always keeps its bubble.
                  const { text, blocks } = parseStructuredBlocks(msg.content)
                  if (blocks.length === 0) {
                    return [<ChatMessage key={msg.id} message={msg} />]
                  }
                  const keepBubble = text || blocks.some((block) => block.type === "reservation")
                  return [
                    ...(keepBubble ? [<ChatMessage key={msg.id} message={{ ...msg, content: text }} />] : []),
                    ...blocks.map((block, index) => {
                      const key = `${msg.id}-${block.type}-${index}`
                      if (block.type === "reservation") {
                        return <ReservationCardMessage key={key} reservation={block.reservation} />
                      }
                      if (block.type === "reservation-list") {
                        return <ReservationListMessage key={key} reservations={block.reservations} />
                      }
                      return (
                        <MenuItemsMessage
                          key={key}
                          items={block.items}
                          more={msg.menuMore && {
                            remaining: msg.menuMore.remaining,
                            pending: menuMorePendingId === msg.id,
                            disabled: menuMorePendingId !== null || isSending || isStreaming,
                            onMore: () => loadMoreMenu(msg.id),
                          }}
                        />
                      )
                    }),
                  ]
                })}

                {/* Streaming AI message */}
                {isStreaming && streamingContent && (
                  <StreamingMessage content={streamingContent} />
                )}
              </>
            )}

            {/* Tool activity indicator — shows what Sage is looking up */}
            {toolActivity && (
              <ToolActivityIndicator activity={toolActivity} locale={t} />
            )}

            {/* Typing indicator — only when Sage is active (not paused/human tier) */}
            {(isSending || awaitingReply) && !isStreaming && !toolActivity && session?.tier !== "HUMAN" && (
              <div className="flex justify-start px-3 py-1">
                <div className="bg-wg-surface dark:bg-wg-dark-surface rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-wg-muted dark:bg-wg-dark-muted animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-wg-muted dark:bg-wg-dark-muted animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-wg-muted dark:bg-wg-dark-muted animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Input / Reservation Form / Resolved / Cancelled ─── */}
          {session?.status === "RESOLVED" || session?.status === "CANCELLED" ? (
            <div className="px-3 py-3 border-t border-wg-muted/20 dark:border-wg-dark-muted/20 text-center">
              <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">
                {session.status === "CANCELLED" ? t("cancelled") : t("resolved")}
              </p>
              <button
                onClick={startNewConversation}
                className="text-xs text-wg-primary dark:text-wg-dark-primary hover:underline font-medium"
              >
                {t("newConversation")}
              </button>
            </div>
          ) : reservationFlowActive || isSubmittingReservation ? (
            <ChatReservationFlow
              onSubmit={submitReservationFlow}
              onCancel={cancelReservationFlow}
              isSubmitting={isSubmittingReservation}
              locale={locale}
              sessionKey={activeSessionKey}
            />
          ) : (
            <ChatInput
              onSend={sendMessage}
              disabled={isSending || isStreaming}
              draftKey={activeSessionKey ?? "new"}
              cooldownUntil={chatCooldownUntil}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Tool activity indicator ───────────────────────────────────────
// Shows a subtle animated pill while Sage calls a tool
function ToolActivityIndicator({
  activity,
  locale,
}: {
  activity: ToolActivityLabel
  locale: ReturnType<typeof useTranslations>
}) {
  const labels: Record<NonNullable<ToolActivityLabel>, { en: string; es: string }> = {
    menu:          { en: "Checking the menu…",       es: "Consultando la carta…"      },
    availability:  { en: "Checking availability…",   es: "Verificando disponibilidad…" },
    discounts:     { en: "Looking up promotions…",   es: "Buscando promociones…"       },
    info:          { en: "Getting restaurant info…", es: "Obteniendo información…"     },
    booking:       { en: "Creating your reservation…", es: "Creando tu reserva…"       },
    reservations:  { en: "Loading your bookings…",   es: "Cargando tus reservas…"      },
  }

  if (!activity) return null

  // Detect locale from the t function (falls back to 'en')
  let label = labels[activity].en
  try {
    // Try to detect locale by testing a known key
    const testKey = locale("onlineStatus")
    if (typeof testKey === "string" && testKey.includes("en")) label = labels[activity].en
    else label = labels[activity].es
  } catch {
    // use English fallback
  }

  return (
    <div className="flex justify-start px-3 py-1">
      <div className="flex items-center gap-2 bg-wg-surface dark:bg-wg-dark-surface rounded-full px-3 py-1.5 text-xs text-wg-muted dark:text-wg-dark-muted border border-wg-border dark:border-wg-dark-border">
        {/* Spinner */}
        <SpinnerArrowsIcon className="w-3 h-3 animate-spin text-wg-primary dark:text-wg-secondary" />
        <span>{label}</span>
      </div>
    </div>
  )
}
