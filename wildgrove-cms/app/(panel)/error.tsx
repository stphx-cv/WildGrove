"use client"

// ══════════════════════════════════════════════════════════════════
// Admin segment error boundary — one panel section fails, the panel
// survives. Without this, a throw anywhere under (panel) reaches the
// root and Next replaces the whole document with "This page couldn't
// load", sidebar included.
//
// It exists because of exactly that: Google removed DrawingManager
// from the Maps API in v3.65, the delivery-zone editor built one in an
// effect, and pressing "Draw polygon" took down the entire CMS.
// ══════════════════════════════════════════════════════════════════

import { useEffect } from "react"
import Link from "next/link"
import { ExclamationTriangleWideIcon } from "@wildgrove/ui/icons"

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("[panel] section crashed:", error)
    }, [error])

    return (
        <div className="flex items-center justify-center py-20 px-4">
            <div className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6 text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center">
                    <ExclamationTriangleWideIcon className="w-5 h-5 text-red-500" strokeWidth={2} aria-hidden="true" />
                </div>

                <h2 className="mt-4 text-base font-semibold text-wg-text dark:text-wg-dark-text">
                    This section could not load
                </h2>
                <p className="mt-1.5 text-sm text-wg-muted dark:text-wg-dark-muted">
                    The rest of the panel still works. Try again, and if it keeps failing the details
                    are in the browser console.
                </p>

                {error.digest && (
                    <p className="mt-3 text-xs font-mono text-wg-muted/70 dark:text-wg-dark-muted/70">
                        {error.digest}
                    </p>
                )}

                <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={reset}
                        className="px-4 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.02]"
                    >
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-colors"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}
