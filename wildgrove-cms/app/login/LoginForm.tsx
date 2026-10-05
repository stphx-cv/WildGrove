"use client"

// ══════════════════════════════════════════════════════════════════
// CMS sign in — email + password, or Google.
//
// No sign up and no locale switch: staff accounts are created from the
// storefront or by an owner, and this host only lets ADMIN | OWNER through
// (the role check lives in proxy.ts). Google does not create anything either:
// /api/auth/callback turns away any account that is not already staff.
// `insforge_*` cookies are host-only, so signing in here does not touch the
// storefront session and vice versa.
// ══════════════════════════════════════════════════════════════════
import { useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { WildGroveLogo } from "@wildgrove/ui/WildGroveLogo"
import { safeInternalPath } from "@wildgrove/core/safe-path"
import { GoogleLogo } from "@wildgrove/ui/icons"

/**
 * The wording for a `?error=` that /api/auth/callback sends back. Any other
 * value is ignored, so the page never prints something it was handed.
 */
function oauthErrorMessage(code: string | null): string | null {
    switch (code) {
        case "not_staff":
            return "That Google account does not have access to the CMS."
        case "oauth_failed":
            return "Google sign-in could not be completed. Try again."
        default:
            return null
    }
}

export function LoginForm() {
    const searchParams = useSearchParams()
    // Where to land after signing in comes from the URL, so it is only ever
    // followed when it points inside the panel.
    const next = safeInternalPath(searchParams.get("next"))

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(() =>
        oauthErrorMessage(searchParams.get("error")),
    )
    const [submitting, setSubmitting] = useState(false)
    const [startingGoogle, setStartingGoogle] = useState(false)

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)

        try {
            const res = await fetch("/api/auth/sign-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(
                    body?.error === "EMAIL_PASSWORD_REQUIRED"
                        ? "Enter your email and password."
                        : body?.error === "AUTH_FORBIDDEN"
                          ? "That account does not have access to the CMS."
                          : "Those credentials are not valid.",
                )
                setSubmitting(false)
                return
            }

            // Full reload so the proxy re-runs the role check with the new cookies.
            window.location.assign(next)
        } catch {
            setError("Could not reach the server. Try again.")
            setSubmitting(false)
        }
    }

    async function onGoogle() {
        setError(null)
        setStartingGoogle(true)

        try {
            const res = await fetch("/api/auth/oauth/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ next }),
            })
            const body = await res.json().catch(() => ({}))

            if (!res.ok || typeof body?.url !== "string") {
                setError(
                    res.status === 429
                        ? "Too many attempts. Wait a minute and try again."
                        : "Could not start Google sign-in. Try again.",
                )
                setStartingGoogle(false)
                return
            }

            // Off to Google; the button stays busy until the page unloads.
            window.location.assign(body.url)
        } catch {
            setError("Could not reach the server. Try again.")
            setStartingGoogle(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-wg-bg px-4 dark:bg-wg-dark-bg">
            <div className="w-full max-w-sm rounded-card border border-wg-border/60 bg-wg-surface p-8 shadow-card dark:border-wg-dark-border dark:bg-wg-dark-surface dark:shadow-glow-sm">
                <div className="mb-8 flex flex-col items-center gap-3 text-center">
                    <WildGroveLogo size="lg" priority />
                    <div>
                        <h1 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text">
                            Wild Grove CMS
                        </h1>
                        <p className="mt-1 text-sm text-wg-muted dark:text-wg-dark-muted">
                            Staff access only
                        </p>
                    </div>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="mb-4 rounded-brand bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    >
                        {error}
                    </p>
                )}

                <button
                    type="button"
                    onClick={onGoogle}
                    disabled={submitting || startingGoogle}
                    className="mb-4 flex w-full items-center justify-center gap-3 rounded-brand border border-wg-border bg-wg-surface px-4 py-2.5 text-sm font-medium text-wg-text shadow-card transition-all hover:border-wg-primary/40 hover:bg-wg-bg disabled:opacity-60 dark:border-wg-dark-border dark:bg-wg-dark-surface dark:text-wg-dark-text dark:hover:border-wg-dark-primary/40 dark:hover:bg-wg-dark-bg"
                >
                    <GoogleLogo width="18" height="18" aria-hidden="true" />
                    {startingGoogle ? "Redirecting…" : "Continue with Google"}
                </button>

                <div className="mb-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-wg-border dark:bg-wg-dark-border" />
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted">or</span>
                    <div className="h-px flex-1 bg-wg-border dark:bg-wg-dark-border" />
                </div>

                <form onSubmit={onSubmit} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                            Email
                        </span>
                        <input
                            type="email"
                            required
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="rounded-brand border border-wg-border bg-wg-bg px-3 py-2 text-sm text-wg-text outline-none focus:border-wg-accent dark:border-wg-dark-border dark:bg-wg-dark-bg dark:text-wg-dark-text dark:focus:border-wg-dark-accent"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                            Password
                        </span>
                        <input
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="rounded-brand border border-wg-border bg-wg-bg px-3 py-2 text-sm text-wg-text outline-none focus:border-wg-accent dark:border-wg-dark-border dark:bg-wg-dark-bg dark:text-wg-dark-text dark:focus:border-wg-dark-accent"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={submitting || startingGoogle}
                        className="mt-2 rounded-brand bg-wg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-wg-primary/90 disabled:opacity-60 dark:bg-wg-dark-primary"
                    >
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    )
}
