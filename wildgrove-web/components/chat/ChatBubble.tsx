"use client"

// ══════════════════════════════════════════════════════════════════
// ChatBubble — Floating green pill with Sage's mark (bottom-right corner)
// Opens the chat widget on click
// ══════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useChatContext } from "./ChatProvider"
import { SageMark } from "@wildgrove/ui/icons"

export function ChatBubble() {
  const t = useTranslations("chat")
  const { setIsOpen, session, bubbleAttentionMode, isSessionBlocked } = useChatContext()
  const [showBlockedMsg, setShowBlockedMsg] = useState(false)

  const hasWaiting = session?.status === "WAITING" || session?.status === "AGENT_JOINED"
  const showIntroAttention = bubbleAttentionMode === "intro" && !hasWaiting
  const showUnreadAttention = bubbleAttentionMode === "unread" && !hasWaiting

  // A click, a tap, Enter and Space all land here: the blocked notice if the
  // session is blocked, otherwise open the chat.
  function handleBubbleClick() {
    if (isSessionBlocked) {
      setShowBlockedMsg(true)
      setTimeout(() => setShowBlockedMsg(false), 4000)
      return
    }
    setIsOpen(true)
  }

  return (
    <div className="relative h-14 shrink-0">
      {showBlockedMsg && (
        <div className="absolute bottom-16 right-0 w-56 bg-wg-text dark:bg-wg-dark-surface text-white dark:text-wg-dark-text text-xs font-medium px-3 py-2.5 rounded-xl shadow-elevated pointer-events-none">
          {t("blockedUnavailable")}
        </div>
      )}
      {showIntroAttention && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-wg-accent/60 dark:border-wg-dark-accent/55 animate-sage-bubble-ping motion-reduce:animate-none"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-wg-accent/35 dark:border-wg-dark-accent/30 animate-sage-bubble-ping motion-reduce:animate-none [animation-delay:1.1s]"
          />
        </>
      )}

      {showUnreadAttention && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-full border-2 border-wg-accent/80 dark:border-wg-dark-accent/75 animate-sage-bubble-ping-strong motion-reduce:animate-none"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-full border border-wg-accent/50 dark:border-wg-dark-accent/45 animate-sage-bubble-ping-strong motion-reduce:animate-none [animation-delay:0.75s]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-wg-accent/20 dark:bg-wg-dark-accent/25 animate-sage-bubble-ping-strong motion-reduce:animate-none [animation-delay:0.35s]"
          />
        </>
      )}

      <button
        onClick={handleBubbleClick}
        className={[
          "relative z-10 h-14 pl-2.5 pr-5 rounded-full bg-wg-primary text-white hover:scale-[1.02] transition-[transform,box-shadow,ring-color] duration-300 ease-out flex items-center gap-2.5",
          showUnreadAttention
            ? "ring-[3px] ring-wg-accent dark:ring-wg-dark-accent animate-sage-bubble-glow-strong motion-reduce:animate-none"
            : showIntroAttention
              ? "ring-[2.5px] ring-wg-accent/70 dark:ring-wg-dark-accent/65 animate-sage-bubble-glow motion-reduce:animate-none hover:ring-wg-accent dark:hover:ring-wg-dark-accent"
              : "ring-2 ring-wg-primary/40 dark:ring-wg-dark-primary/50 shadow-elevated hover:ring-wg-accent/50 dark:hover:ring-wg-dark-accent/50",
        ].join(" ")}
        aria-label={t("bubbleLabel")}
      >
        <span className="w-9 h-9 rounded-[11px] bg-wg-surface dark:bg-wg-secondary text-wg-primary dark:text-wg-primary flex items-center justify-center shrink-0">
          <SageMark variant="compact" className="w-[22px] h-[22px]" />
        </span>
        <span className="text-sm font-semibold whitespace-nowrap" aria-hidden>
          Sage
        </span>

        {showUnreadAttention && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-wg-accent dark:bg-wg-dark-accent rounded-full border-2 border-white dark:border-wg-dark-bg animate-pulse motion-reduce:animate-none" />
        )}

        {hasWaiting && !showUnreadAttention && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white dark:border-wg-dark-bg animate-pulse motion-reduce:animate-none" />
        )}
      </button>
    </div>
  )
}
