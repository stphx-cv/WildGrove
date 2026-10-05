"use client"

// ══════════════════════════════════════════════════════════════════
// Textarea — Free-text field that grows with its content, with a resize
// grip of our own. Shared by the storefront and the CMS.
//
// The native <textarea> corner is never used. The browser paints it
// itself: `::-webkit-resizer` exists only in Chromium and Safari, Firefox
// ignores it, and neither iOS Safari nor Android Chrome draws one at all,
// so the affordance is both unstyleable and desktop-only.
//
// Behaviour:
//   • Auto-grow   → height follows the content, from minRows up to maxHeight.
//                   Past maxHeight the field scrolls instead of growing.
//   • Manual drag → dragging the grip pins an explicit height inside the
//                   same bounds and pauses auto-grow (what the native corner
//                   did). Pointer Events, so mouse, touch and pen all work.
//   • Reset       → double-tap the grip, or Enter/Space when it has focus,
//                   hands the height back to auto-grow.
//   • Keyboard    → the grip is focusable; ↑/↓ resize in 16px steps.
//
// `resizable={false}` drops the grip and keeps only the auto-grow. That is
// the right shape for a chat composer, which grows as you type but is not
// something you drag.
//
// Props:
//   value / onChange  → string-based (mirrors form state convention)
//   minRows           → rows attribute, sets the floor height (default: 2)
//   maxHeight         → ceiling in px; never below the floor (default: 220)
//   className         → theme classes for the field; `wrapperClassName` styles
//                       the positioned wrapper, e.g. `flex-1` inside a row
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

// ── Types ──

export interface TextareaProps {
    value: string
    onChange: (value: string) => void
    ref?: React.Ref<HTMLTextAreaElement>
    placeholder?: string
    minRows?: number                // floor height, in rows (default: 2)
    maxHeight?: number              // ceiling height, in px (default: 220)
    resizable?: boolean             // show the drag grip (default: true)
    maxLength?: number
    minLength?: number
    required?: boolean
    disabled?: boolean
    id?: string
    name?: string
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>
    onBlur?: React.FocusEventHandler<HTMLTextAreaElement>
    "aria-label"?: string
    "aria-describedby"?: string
    className?: string              // theme classes (border, bg, ring, padding…)
    wrapperClassName?: string       // layout classes for the wrapper
}

// ── Constants ──

const KEYBOARD_STEP = 16            // px per ↑/↓ press on the grip
const MIN_HEIGHT_FALLBACK = 40      // px, if measurement runs before layout

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

// ── Grip icon (branded twin of the native corner) ──

function GripIcon() {
    return (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M11 5 5 11" />
            <path d="M11 9 9 11" />
        </svg>
    )
}

// ── Component ──

export function Textarea({
    value,
    onChange,
    ref,
    placeholder,
    minRows = 2,
    maxHeight = 220,
    resizable = true,
    maxLength,
    minLength,
    required = false,
    disabled = false,
    id,
    name,
    onKeyDown,
    onBlur,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    className = "",
    wrapperClassName = "",
}: TextareaProps) {
    const taRef = useRef<HTMLTextAreaElement>(null)
    const minHeightRef = useRef(MIN_HEIGHT_FALLBACK)
    const borderRef = useRef(0)
    const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

    const [manualHeight, setManualHeight] = useState<number | null>(null)
    const [dragging, setDragging] = useState(false)

    // The caller may want the node too (focus, scroll into view, select)
    const attachRef = (node: HTMLTextAreaElement | null) => {
        taRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node
    }

    /** The ceiling can never sit below the floor the `rows` attribute sets. */
    const ceiling = useCallback(
        () => Math.max(maxHeight, minHeightRef.current),
        [maxHeight],
    )

    // ── Measure the floor height once, before any height is written ──
    // Tailwind's preflight makes the box border-box, so scrollHeight (which
    // excludes borders) has to be topped up with them before it becomes a height.
    useLayoutEffect(() => {
        const el = taRef.current
        if (!el) return
        const cs = getComputedStyle(el)
        borderRef.current = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
        minHeightRef.current = el.offsetHeight || MIN_HEIGHT_FALLBACK
    }, [])

    // ── Auto-grow ──

    const applyAutoHeight = useCallback(() => {
        const el = taRef.current
        if (!el || manualHeight !== null) return
        el.style.height = "auto"
        const content = el.scrollHeight + borderRef.current
        el.style.height = `${clamp(content, minHeightRef.current, ceiling())}px`
    }, [manualHeight, ceiling])

    useLayoutEffect(() => {
        applyAutoHeight()
    }, [value, applyAutoHeight])

    // A width change rewraps the text, which changes how tall the content is.
    // Only width is acted on: reacting to height would re-enter the observer
    // every time auto-grow writes one.
    useEffect(() => {
        const el = taRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        let lastWidth = el.clientWidth
        const ro = new ResizeObserver(() => {
            if (el.clientWidth === lastWidth) return
            lastWidth = el.clientWidth
            applyAutoHeight()
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [applyAutoHeight])

    // ── Manual height ──

    useLayoutEffect(() => {
        const el = taRef.current
        if (!el || manualHeight === null) return
        el.style.height = `${manualHeight}px`
    }, [manualHeight])

    // ── Grip: drag (mouse, touch and pen alike) ──

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = taRef.current
        if (disabled || !el) return
        e.preventDefault()
        // Capture keeps the drag alive when the finger or cursor leaves the grip.
        // It throws for a pointer the browser no longer tracks, which is harmless.
        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
            /* drag still works without capture */
        }
        dragRef.current = { startY: e.clientY, startHeight: el.offsetHeight }
        setDragging(true)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        if (!drag) return
        const next = drag.startHeight + (e.clientY - drag.startY)
        setManualHeight(clamp(next, minHeightRef.current, ceiling()))
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return
        dragRef.current = null
        setDragging(false)
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
            }
        } catch {
            /* nothing to release */
        }
    }

    // ── Grip: keyboard ──

    const handleGripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = taRef.current
        if (disabled || !el) return
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            const delta = e.key === "ArrowDown" ? KEYBOARD_STEP : -KEYBOARD_STEP
            setManualHeight(clamp(el.offsetHeight + delta, minHeightRef.current, ceiling()))
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setManualHeight(null)
        }
    }

    return (
        <div className={["relative", wrapperClassName].filter(Boolean).join(" ")}>
            <textarea
                ref={attachRef}
                id={id}
                name={name}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                placeholder={placeholder}
                rows={minRows}
                maxLength={maxLength}
                minLength={minLength}
                required={required}
                disabled={disabled}
                className={[
                    "block w-full resize-none overflow-y-auto",
                    className,
                    // Last, and important, so the grip keeps its corner whatever
                    // horizontal padding the caller's theme classes ask for.
                    resizable && "!pr-8",
                ]
                    .filter(Boolean)
                    .join(" ")}
            />

            {/* ── Resize grip ── */}
            {resizable && !disabled && (
                <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize field"
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onDoubleClick={() => setManualHeight(null)}
                    onKeyDown={handleGripKeyDown}
                    className={[
                        "absolute bottom-0.5 right-0.5 flex h-6 w-6 items-center justify-center",
                        "rounded-md cursor-ns-resize touch-none select-none",
                        "transition-colors focus:outline-none",
                        dragging
                            ? "text-wg-accent dark:text-wg-dark-accent"
                            : "text-wg-muted/50 dark:text-wg-dark-muted/50 hover:text-wg-accent dark:hover:text-wg-dark-accent",
                        "focus-visible:text-wg-accent dark:focus-visible:text-wg-dark-accent",
                        "focus-visible:ring-2 focus-visible:ring-wg-accent/50 dark:focus-visible:ring-wg-dark-accent/50",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <GripIcon />
                </div>
            )}
        </div>
    )
}
