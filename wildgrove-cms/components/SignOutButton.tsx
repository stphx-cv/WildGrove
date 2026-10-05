"use client"

// ══════════════════════════════════════════════════════════════════
// Sign out — the CMS is its own host with its own session, so it needs its
// own control. In wildgrove-web this lived in the public header's UserMenu,
// which does not exist here.
// ══════════════════════════════════════════════════════════════════
import { useState } from "react"
import { ArrowLeftOnRectangleIcon } from "@wildgrove/ui/icons"

export function SignOutButton() {
    const [busy, setBusy] = useState(false)

    async function onClick() {
        setBusy(true)
        try {
            await fetch("/api/auth/sign-out", { method: "POST" })
        } finally {
            // Full reload so the proxy re-evaluates with the cleared cookies.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the proxy must see the cleared cookies
            window.location.assign("/login")
        }
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-brand p-2 text-wg-muted transition-colors hover:bg-wg-surface hover:text-wg-primary disabled:opacity-60 dark:text-wg-dark-muted dark:hover:bg-wg-dark-surface dark:hover:text-wg-dark-primary"
        >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" strokeWidth={2} />
        </button>
    )
}
