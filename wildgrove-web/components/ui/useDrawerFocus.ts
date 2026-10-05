"use client"

import { useEffect, useRef, type RefObject } from "react"

// ══════════════════════════════════════════════════════════════════
// Keyboard behaviour of a slide-in drawer that stays mounted (cart, mobile
// nav). While it is open: focus moves to its first control, Tab and
// Shift+Tab cycle inside it, and Escape closes it. On close, focus goes back
// to whatever had it before opening, or to `returnFocus` if that was nothing.
// The closed drawer itself is made inert by the component (`inert` prop), so
// nothing inside it can be focused or read.
// ══════════════════════════════════════════════════════════════════

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDrawerFocus(
    open: boolean,
    onClose: () => void,
    returnFocus?: RefObject<HTMLElement | null>,
) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose }, [onClose])

    useEffect(() => {
        if (!open) return
        const container = containerRef.current
        if (!container) return

        const active = document.activeElement
        const opener = active instanceof HTMLElement && active !== document.body ? active : returnFocus?.current ?? null

        const focusables = () =>
            Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)

        focusables()[0]?.focus()

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                onCloseRef.current()
                return
            }
            if (e.key !== "Tab") return
            const list = focusables()
            if (list.length === 0) return
            const first = list[0]
            const last = list[list.length - 1]
            if (!container.contains(document.activeElement)) {
                e.preventDefault()
                first.focus()
            } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener("keydown", onKeyDown)

        return () => {
            document.removeEventListener("keydown", onKeyDown)
            if (opener && opener.isConnected) opener.focus()
        }
    }, [open, returnFocus])

    return containerRef
}
