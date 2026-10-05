"use client"

// ══════════════════════════════════════════════════════════════════
// SageChatCTA — Card that opens the Sage chat widget
// Uses a custom event to communicate with ChatProvider
// (avoids context dependency issues during static prerendering)
// ══════════════════════════════════════════════════════════════════

import { SageMark } from "@wildgrove/ui/icons"

export function SageChatCTA({
  title,
  description,
  startLabel,
}: {
  title: string
  description: string
  startLabel: string
}) {
  const openChat = () => {
    window.dispatchEvent(new CustomEvent("sage:open"))
  }

  return (
    <button
      onClick={openChat}
      className="relative w-full text-left p-6 pr-14 rounded-card bg-gradient-to-br from-wg-primary/5 to-wg-accent/5 dark:from-wg-dark-primary/10 dark:to-wg-dark-accent/10 border border-wg-primary/10 dark:border-wg-dark-primary/20 hover:border-wg-accent/35 dark:hover:border-wg-dark-accent/45 hover:shadow-card transition-all group cursor-pointer"
    >
      <span
        className="absolute top-4 right-4 w-10 h-10 rounded-[11px] bg-wg-secondary dark:bg-wg-secondary flex items-center justify-center text-wg-primary dark:text-wg-primary ring-0 group-hover:ring-2 ring-wg-accent/40 dark:ring-wg-dark-accent/45 transition-shadow pointer-events-none"
        aria-hidden
      >
        <SageMark variant="compact" className="w-[22px] h-[22px]" />
      </span>
      <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2 pr-2 group-hover:text-wg-accent dark:group-hover:text-wg-dark-accent transition-colors">
        {title}
      </h3>
      <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed">
        {description}
      </p>
      <p className="text-xs text-wg-accent dark:text-wg-dark-accent font-medium mt-3 group-hover:translate-x-0.5 transition-transform">
        {startLabel}
      </p>
    </button>
  )
}
