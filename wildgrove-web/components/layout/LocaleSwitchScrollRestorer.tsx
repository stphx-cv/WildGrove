"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  LOCALE_SWITCH_SCROLL_KEY,
  LOCALE_SWITCH_SCROLL_MAX_AGE_MS,
} from "@wildgrove/core/locale-switch-scroll"

// Reapply for ~1.5s after navigation so async content (Suspense boundaries,
// images causing layout shift) doesn't trap us at the clamped max scroll
// before the document grows to its real height.
const RETRY_BUDGET_MS = 1500

export function LocaleSwitchScrollRestorer() {
  // Depend on pathname because [locale]/layout.tsx persists across locale
  // switches in the App Router — a `[]` dep would only fire on first mount.
  const pathname = usePathname()

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(LOCALE_SWITCH_SCROLL_KEY)
    } catch {
      return
    }
    if (!raw) return

    let parsed: { y: number; t: number } | null = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      try { sessionStorage.removeItem(LOCALE_SWITCH_SCROLL_KEY) } catch {}
      return
    }
    if (!parsed || typeof parsed.y !== "number" || typeof parsed.t !== "number") {
      try { sessionStorage.removeItem(LOCALE_SWITCH_SCROLL_KEY) } catch {}
      return
    }
    if (Date.now() - parsed.t > LOCALE_SWITCH_SCROLL_MAX_AGE_MS) {
      try { sessionStorage.removeItem(LOCALE_SWITCH_SCROLL_KEY) } catch {}
      return
    }

    // Consume now so a later reload doesn't re-trigger.
    try { sessionStorage.removeItem(LOCALE_SWITCH_SCROLL_KEY) } catch {}

    const targetY = parsed.y
    const start = performance.now()
    let aborted = false
    let rafId = 0

    function onUserScroll() {
      aborted = true
    }
    // Detect manual user input — don't fight the user.
    window.addEventListener("wheel", onUserScroll, { passive: true })
    window.addEventListener("touchstart", onUserScroll, { passive: true })
    window.addEventListener("keydown", onUserScroll)

    function tick() {
      if (aborted) return cleanup()
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      )
      const clamped = Math.min(targetY, maxScroll)
      if (Math.abs(window.scrollY - clamped) > 1) {
        window.scrollTo({ top: clamped, left: 0, behavior: "instant" as ScrollBehavior })
      }
      // Stop early if the page is now tall enough and we're at the saved Y.
      const reached = maxScroll >= targetY && Math.abs(window.scrollY - targetY) <= 1
      if (reached) return cleanup()
      if (performance.now() - start > RETRY_BUDGET_MS) return cleanup()
      rafId = requestAnimationFrame(tick)
    }

    function cleanup() {
      cancelAnimationFrame(rafId)
      window.removeEventListener("wheel", onUserScroll)
      window.removeEventListener("touchstart", onUserScroll)
      window.removeEventListener("keydown", onUserScroll)
    }

    rafId = requestAnimationFrame(tick)
    return cleanup
  }, [pathname])

  return null
}
