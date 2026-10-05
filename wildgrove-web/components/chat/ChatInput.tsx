"use client"

// ══════════════════════════════════════════════════════════════════
// ChatInput — Text input with send button for chat widget
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Textarea } from "@wildgrove/ui/Textarea"
import { PaperAirplaneIcon } from "@wildgrove/ui/icons"

const MAX_LENGTH = 500

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
  draftKey?: string
  cooldownUntil?: number | null
}

export function ChatInput({ onSend, disabled = false, placeholder, draftKey, cooldownUntil }: ChatInputProps) {
  const t = useTranslations("chat")
  const storageKey = `wg:chat-draft:${draftKey ?? "default"}`

  const [value, setValue] = useState(() => {
    try { return sessionStorage.getItem(`wg:chat-draft:${draftKey ?? "default"}`) ?? "" } catch { return "" }
  })
  // Which cooldown has already run out. The flag itself is derived below
  // rather than stored: a cooldown is "on" until its own deadline is the one
  // marked expired, so a new `cooldownUntil` disables the field immediately,
  // with no effect needed to turn it on.
  const [expiredDeadline, setExpiredDeadline] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mark the deadline expired when it passes. Always through the timer, even
  // when it has already passed (delay 0) — reading the clock belongs in an
  // effect, and setting state straight from an effect body is what React's
  // set-state-in-effect rule is about.
  useEffect(() => {
    if (cooldownUntil == null) return
    const remaining = cooldownUntil - Date.now()
    const timer = setTimeout(() => setExpiredDeadline(cooldownUntil), Math.max(remaining, 0))
    return () => clearTimeout(timer)
  }, [cooldownUntil])

  const coolingDown = cooldownUntil != null && expiredDeadline !== cooldownUntil
  const effectivelyDisabled = disabled || coolingDown

  const handleChange = (text: string) => {
    setValue(text)
    try {
      if (text) sessionStorage.setItem(storageKey, text)
      else sessionStorage.removeItem(storageKey)
    } catch {}
  }

  const handleSend = async () => {
    const trimmed = value.trim()
    if (!trimmed || effectivelyDisabled) return
    await onSend(trimmed)
    setValue("")
    try { sessionStorage.removeItem(storageKey) } catch {}
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-wg-muted/20 dark:border-wg-dark-muted/20 bg-white dark:bg-wg-dark-bg">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(v) => handleChange(v.slice(0, MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder={coolingDown ? t("cooldownPlaceholder") : (placeholder || t("placeholder"))}
        disabled={effectivelyDisabled}
        minRows={1}
        maxHeight={96}
        resizable={false}
        wrapperClassName="flex-1"
        className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl border border-wg-muted/30 dark:border-wg-dark-muted/30 bg-wg-surface/50 dark:bg-wg-dark-surface/50 px-3 py-2 text-sm text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted dark:placeholder:text-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-primary/30 disabled:opacity-50"
      />

      <button
        onClick={handleSend}
        disabled={!value.trim() || effectivelyDisabled}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-wg-primary text-white flex items-center justify-center transition-all hover:bg-wg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={t("send")}
      >
        {/* Send icon */}
        <PaperAirplaneIcon className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}
