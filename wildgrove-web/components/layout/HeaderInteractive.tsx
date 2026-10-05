"use client"

import { useEffect, useState } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { HeaderMenu } from "@/components/layout/HeaderMenu"
import { MobileNav, type MobileNavVisitInfo } from "@/components/layout/MobileNav"
import { UserMenu } from "@/components/auth/UserMenu"
import { CartButton } from "@/components/cart/CartButton"
import { Skeleton } from "@/components/ui/Skeleton"
import { createClient } from "@wildgrove/core/clients/client"
import { UserCircleIcon } from "@wildgrove/ui/icons"

type HeaderUser = {
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string
    avatarUrl: string | null
}

type MeResponse = {
    user: HeaderUser | null
    isAdmin: boolean
}

/** Backoff for /api/me. A failed lookup must not render the signed-out header:
 *  the proxy would then bounce the resulting /portal click straight back to the
 *  current page, so the Sign In button would look dead. Retry, then give up. */
const ME_RETRY_DELAYS_MS = [400, 1_200, 3_000]

type HeaderInteractiveProps = {
    links: { href: string; label: string }[]
    visitInfo?: MobileNavVisitInfo
}

/**
 * Client island for the header's right section. Resolves the signed-in user in
 * the browser (via /api/me) so the server-rendered page shell no longer reads
 * auth cookies — keeping public routes statically renderable / prefetchable.
 * While the session is loading, a neutral skeleton stands in for the avatar.
 */
export function HeaderInteractive({ links, visitInfo }: HeaderInteractiveProps) {
    const tc = useTranslations("common")
    const [user, setUser] = useState<HeaderUser | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        let retryTimer: ReturnType<typeof setTimeout> | undefined

        async function loadMe(attempt = 0): Promise<void> {
            try {
                const res = await fetch("/api/me", { cache: "no-store" })
                // 503 means "cannot tell" — treated as a failure so it retries.
                if (!res.ok) throw new Error(`me failed: ${res.status}`)
                const data: MeResponse = await res.json()
                if (!active) return
                setUser(data.user)
                setIsAdmin(data.isAdmin)
                setLoading(false)
            } catch {
                if (!active) return
                const delay = ME_RETRY_DELAYS_MS[attempt]
                if (delay !== undefined) {
                    retryTimer = setTimeout(() => {
                        if (active) void loadMe(attempt + 1)
                    }, delay)
                    return
                }
                // Out of retries — fall back to the signed-out header rather
                // than leaving the skeleton spinning forever.
                setUser(null)
                setIsAdmin(false)
                setLoading(false)
            }
        }

        void loadMe()

        // Keep the header in sync when the user logs in or out.
        const insforge = createClient()
        const { data: sub } = insforge.auth.onAuthStateChange(() => {
            void loadMe()
        })

        return () => {
            active = false
            if (retryTimer) clearTimeout(retryTimer)
            sub.subscription.unsubscribe()
        }
    }, [])

    return (
        <div className="flex items-center gap-2">
            {/* Cart icon with badge */}
            <CartButton />
            {/* Desktop: settings dropdown (theme + language + admin) */}
            <HeaderMenu isAdmin={isAdmin} />

            {loading ? (
                <Skeleton className="h-8 w-8 rounded-full" />
            ) : user ? (
                <>
                    {/* Logged in — desktop avatar menu */}
                    <div className="hidden md:block">
                        <UserMenu
                            firstName={user.firstName}
                            lastName={user.lastName}
                            username={user.username}
                            email={user.email}
                            avatarUrl={user.avatarUrl}
                        />
                    </div>
                    {/* Logged in — mobile shortcut to account */}
                    <Link
                        href="/account"
                        aria-label={tc("myAccount")}
                        className="md:hidden p-1 rounded-brand transition-colors hover:opacity-90"
                    >
                        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-wg-border dark:ring-wg-dark-border">
                            {user.avatarUrl ? (
                                <FadeInImage
                                    src={user.avatarUrl}
                                    alt=""
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-wg-primary dark:bg-wg-dark-primary text-white text-xs font-semibold flex items-center justify-center">
                                    {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </Link>
                </>
            ) : (
                <>
                    {/* Logged out — desktop Sign In */}
                    <Link
                        href="/portal"
                        className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted hover:text-wg-primary hover:border-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:border-wg-dark-primary transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <UserCircleIcon className="w-4 h-4" />
                        {tc("signIn")}
                    </Link>
                    {/* Logged out — mobile Sign In (visible in header bar) */}
                    <Link
                        href="/portal"
                        aria-label={tc("signIn")}
                        className="md:hidden p-2 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
                    >
                        <UserCircleIcon className="w-5 h-5" />
                    </Link>
                </>
            )}

            {/* Desktop CTA */}
            <Link
                href="/reservations"
                className="hidden md:inline-flex items-center px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                {tc("reserveTable")}
            </Link>

            {/* Mobile hamburger */}
            <MobileNav
                links={links}
                user={user}
                isAdmin={isAdmin}
                visitInfo={visitInfo}
            />
        </div>
    )
}
