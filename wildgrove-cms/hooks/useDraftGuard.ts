"use client"

// ══════════════════════════════════════════════════════════════════
// useDraftGuard — Intercepts navigation when form has unsaved changes
// Handles both browser close (beforeunload) and in-app link clicks
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

interface UseDraftGuardReturn {
    /** Whether the guard modal is open */
    modalOpen: boolean
    /** The href the user was trying to navigate to */
    pendingHref: string | null
    /** Immediately disable the guard (call before programmatic navigation) */
    disableGuard: () => void
    /** Close the modal, stay on page */
    closeModal: () => void
    /** Discard changes and navigate to pendingHref */
    discardAndNavigate: () => void
}

export function useDraftGuard(isDirty: boolean): UseDraftGuardReturn {
    const [modalOpen, setModalOpen] = useState(false)
    const [pendingHref, setPendingHref] = useState<string | null>(null)
    const isDirtyRef = useRef(isDirty)
    const router = useRouter()

    // Keep ref in sync with prop (synchronous, for beforeunload handler)
    useEffect(() => {
        isDirtyRef.current = isDirty
    }, [isDirty])

    // ── Browser close / hard navigation ──
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!isDirtyRef.current) return
            e.preventDefault()
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [])

    // ── In-app link click interception (capture phase) ──
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!isDirtyRef.current) return

            // Find the closest anchor with an href
            const anchor = (e.target as Element)?.closest("a[href]") as HTMLAnchorElement | null
            if (!anchor) return

            const href = anchor.getAttribute("href")
            if (!href) return

            // Skip hash-only, mailto, tel links
            if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return

            // Skip external / new-tab links
            const target = anchor.getAttribute("target")
            if (target && target !== "_self") return

            // Only intercept same-origin admin navigation
            try {
                const url = new URL(href, window.location.origin)
                if (url.origin !== window.location.origin) return
                // Only intercept  routes (not the public site)
                if (!url.pathname.startsWith("/")) return
            } catch {
                return
            }

            e.preventDefault()
            e.stopPropagation()
            setPendingHref(href)
            setModalOpen(true)
        }

        window.addEventListener("click", handler, true) // capture phase
        return () => window.removeEventListener("click", handler, true)
    }, [])

    const disableGuard = useCallback(() => {
        isDirtyRef.current = false
        setModalOpen(false)
        setPendingHref(null)
    }, [])

    const closeModal = useCallback(() => {
        setModalOpen(false)
        setPendingHref(null)
    }, [])

    const discardAndNavigate = useCallback(() => {
        const href = pendingHref
        isDirtyRef.current = false
        setModalOpen(false)
        setPendingHref(null)
        if (href) router.push(href)
    }, [pendingHref, router])

    return { modalOpen, pendingHref, disableGuard, closeModal, discardAndNavigate }
}
