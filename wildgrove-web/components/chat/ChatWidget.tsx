"use client"

// ══════════════════════════════════════════════════════════════════
// ChatWidget — Draggable floating chat panel + bubble
// - Bubble: draggable on both mobile and desktop, snaps to edges
// - Window: draggable on desktop only, always fully visible
// - Tap/click/Enter/Space on bubble opens chat (a drag does not)
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from "react"
import { useChatContext } from "./ChatProvider"
import { ChatBubble } from "./ChatBubble"
import { ChatWindow } from "./ChatWindow"

type SizeMode = "compact" | "expanded"

const SIZE_CONFIG = {
  compact:  { w: 360, h: 520 },
  expanded: { w: 480, h: 640 },
}

const BUBBLE_HEIGHT  = 56  // h-14 = 56px; the width follows the pill label
const EDGE_MARGIN    = 16  // px from screen edge when snapped
const DRAG_THRESHOLD = 5   // px of movement before considered a drag
const SIZE_STORAGE   = "wg:chat-size"

function getSavedSize(): SizeMode {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE)
    if (raw === "compact" || raw === "expanded") return raw
  } catch { /* ignore */ }
  return "compact"
}

/**
 * Snap the bubble to the nearest left/right edge and clamp vertically.
 * position.x = distance from the RIGHT edge of the viewport.
 */
function snapBubble(pos: { x: number; y: number }, bubbleWidth: number): { x: number; y: number } {
  const bubbleCenterX = window.innerWidth - pos.x - bubbleWidth / 2
  // Snap to whichever edge the bubble center is closest to
  const snappedX = bubbleCenterX < window.innerWidth / 2
    ? window.innerWidth - bubbleWidth - EDGE_MARGIN  // left side  → large x
    : EDGE_MARGIN                                     // right side → small x
  const snappedY = Math.max(
    EDGE_MARGIN,
    Math.min(window.innerHeight - BUBBLE_HEIGHT - EDGE_MARGIN, pos.y)
  )
  return { x: snappedX, y: snappedY }
}

/**
 * Compute a safe position for the chat window so it is always fully visible.
 * Returns pos unchanged during SSR (window not available).
 */
function clampWindowPosition(
  pos: { x: number; y: number },
  size: { w: number; h: number }
): { x: number; y: number } {
  if (typeof window === "undefined") return pos
  return {
    x: Math.max(8, Math.min(window.innerWidth  - size.w - 8, pos.x)),
    y: Math.max(8, Math.min(window.innerHeight - size.h - 8, pos.y)),
  }
}

export function ChatWidget() {
  const { isOpen, chatMode } = useChatContext()
  const [sizeMode, setSizeMode]   = useState<SizeMode>("compact")
  const [position, setPosition]   = useState<{ x: number; y: number }>({ x: EDGE_MARGIN, y: EDGE_MARGIN })
  const [isMobile, setIsMobile]   = useState(false)

  // Window drag state (desktop only)
  const [isDragging, setIsDragging]             = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Bubble drag state
  const [isDraggingBubble, setIsDraggingBubble] = useState(false)
  const bubbleDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const bubbleMoved   = useRef(false)
  const bubbleRef     = useRef<HTMLDivElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Load preferences + detect mobile (after hydration — avoids SSR/localStorage mismatch)
  /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage + viewport */
  useEffect(() => {
    setSizeMode(getSavedSize())

    // Bubble always resets to default position on page load (no position persistence)

    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Re-snap bubble on window resize to keep it within bounds
  useEffect(() => {
    if (isOpen) return
    const handleResize = () => {
      const bubbleWidth = bubbleRef.current?.offsetWidth ?? BUBBLE_HEIGHT
      setPosition((pos) => snapBubble(pos, bubbleWidth))
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isOpen])

  // ── Window drag (desktop only, triggered from ChatWindow header) ──
  const onDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isMobile) return
      if ("button" in e && e.button !== 0) return

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      dragRef.current = { startX: clientX, startY: clientY, origX: position.x, origY: position.y }
      setIsDragging(true)
      e.preventDefault()
    },
    [position, isMobile]
  )

  useEffect(() => {
    if (!isDragging) return
    const size = SIZE_CONFIG[sizeMode]

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      const dx = dragRef.current.startX - clientX
      const dy = dragRef.current.startY - clientY
      const newX = Math.max(8, Math.min(window.innerWidth  - size.w - 8, dragRef.current.origX + dx))
      const newY = Math.max(8, Math.min(window.innerHeight - size.h - 8, dragRef.current.origY + dy))
      setPosition({ x: newX, y: newY })
    }

    const onEnd = () => {
      setIsDragging(false)
      dragRef.current = null
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onEnd)
    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend",  onEnd)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup",   onEnd)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend",  onEnd)
    }
  }, [isDragging, sizeMode])

  // ── Bubble drag (both mobile and desktop) ────────────────────────
  const onBubbleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if ("button" in e && e.button !== 0) return
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      bubbleDragRef.current = { startX: clientX, startY: clientY, origX: position.x, origY: position.y }
      bubbleMoved.current   = false
      setIsDraggingBubble(true)
      if ("button" in e) e.preventDefault()
    },
    [position]
  )

  useEffect(() => {
    if (!isDraggingBubble) return

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!bubbleDragRef.current) return
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      const dx = bubbleDragRef.current.startX - clientX
      const dy = bubbleDragRef.current.startY - clientY

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        bubbleMoved.current = true
        e.preventDefault()
      }

      // Free movement while dragging (bounds enforced on release via snap)
      const bubbleWidth = bubbleRef.current?.offsetWidth ?? BUBBLE_HEIGHT
      const newX = Math.max(0, Math.min(window.innerWidth  - bubbleWidth,   bubbleDragRef.current.origX + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - BUBBLE_HEIGHT, bubbleDragRef.current.origY + dy))
      setPosition({ x: newX, y: newY })
    }

    const onEnd = () => {
      setIsDraggingBubble(false)
      bubbleDragRef.current = null

      // A tap or click is opened by the bubble's own click handler, the same
      // path as the keyboard. A drag only snaps.
      if (bubbleMoved.current) {
        // Drag ended — snap to nearest edge (no persistence, resets on refresh)
        const bubbleWidth = bubbleRef.current?.offsetWidth ?? BUBBLE_HEIGHT
        setPosition((pos) => snapBubble(pos, bubbleWidth))
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onEnd)
    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend",  onEnd)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup",   onEnd)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend",  onEnd)
    }
  }, [isDraggingBubble])

  // ── Toggle size ───────────────────────────────────────────────────
  const toggleSize = useCallback(() => {
    setSizeMode((prev) => {
      const next = prev === "compact" ? "expanded" : "compact"
      localStorage.setItem(SIZE_STORAGE, next)
      const size = SIZE_CONFIG[next]
      setPosition((pos) => clampWindowPosition(pos, size))
      return next
    })
  }, [])

  const size = SIZE_CONFIG[sizeMode]

  // Chat window position — always clamped to be fully visible
  const chatPos = clampWindowPosition(position, size)

  return (
    <>
      {/* Chat window — smooth scale + fade + slide animation on open */}
      {isOpen && (
        <div
          ref={containerRef}
          className="fixed z-50 flex flex-col bg-white dark:bg-wg-dark-bg rounded-2xl shadow-elevated border border-wg-muted/15 dark:border-wg-dark-muted/15 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out"
          style={{
            right:     chatPos.x,
            bottom:    chatPos.y,
            width:     size.w,
            height:    size.h,
            maxWidth:  "calc(100vw - 1rem)",
            maxHeight: "calc(100vh - 1rem)",
            cursor:    isDragging ? "grabbing" : undefined,
            transition: isDragging ? "none" : "width 0.2s ease, height 0.2s ease",
          }}
          role="dialog"
          aria-label={chatMode === "staff" ? "Wild Grove chat" : "Sage Chat"}
        >
          <ChatWindow
            onDragStart={isMobile ? undefined : onDragStart}
            isDragging={isDragging}
            sizeMode={sizeMode}
            onToggleSize={toggleSize}
          />
        </div>
      )}

      {/* Floating bubble — draggable, snaps to edge on release */}
      {!isOpen && (
        <div
          ref={bubbleRef}
          className="fixed z-50"
          style={{
            right:       position.x,
            bottom:      position.y,
            cursor:      isDraggingBubble ? "grabbing" : "grab",
            touchAction: "none",
            // Smooth snap animation when not actively dragging
            transition:  isDraggingBubble ? "none" : "right 0.35s cubic-bezier(0.34,1.56,0.64,1), bottom 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
          onMouseDown={onBubbleDragStart}
          onTouchStart={onBubbleDragStart}
          onClickCapture={(e) => {
            // The mouse click that ends a drag is not a request to open.
            // Keyboard clicks (detail 0) always go through.
            if (e.detail !== 0 && bubbleMoved.current) e.stopPropagation()
          }}
        >
          <ChatBubble />
        </div>
      )}
    </>
  )
}
