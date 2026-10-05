"use client"

import { useState, useRef, useEffect } from "react"
import { Link } from "@/i18n/routing"
import { clearCheckoutDraftOnSignOut } from "@/components/cart/checkout-draft"
import { useTranslations } from "next-intl"
import {
    ArrowRightOnRectangleIcon,
    CalendarBandIcon,
    ClipboardListIcon,
    MapPinIcon,
    UserCircleIcon,
    WalletIcon,
} from "@wildgrove/ui/icons"

interface UserMenuProps {
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string
    avatarUrl: string | null
}

function getInitials(firstName: string | null, lastName: string | null, email: string): string {
    const first = firstName?.[0] ?? ""
    const last = lastName?.[0] ?? ""
    const combined = (first + last).toUpperCase()
    return combined || email[0].toUpperCase()
}

export function UserMenu({ firstName, lastName, username, email, avatarUrl }: UserMenuProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const tc = useTranslations("common")
    const tOrders = useTranslations("orders")

    const initials = getInitials(firstName, lastName, email)
    const displayName = firstName && lastName ? `${firstName} ${lastName}` : email

    // Close on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        if (open) document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        if (open) document.addEventListener("keydown", handleKey)
        return () => document.removeEventListener("keydown", handleKey)
    }, [open])

    async function handleSignOut() {
        clearCheckoutDraftOnSignOut()
        await fetch("/api/auth/sign-out", { method: "POST" })
        setOpen(false)
        // Full navigation so CartProvider remounts as guest
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose, see above
        window.location.href = "/"
    }

    return (
        <div ref={ref} className="relative">
            {/* Avatar button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-2 ring-transparent hover:ring-wg-accent/30 dark:hover:ring-wg-dark-accent/30 overflow-hidden"
                style={!avatarUrl ? { background: "linear-gradient(135deg, #3A5A40, #C17F3A)" } : undefined}
                aria-label={tc("userMenu")}
                aria-expanded={open}
                aria-haspopup="menu"
            >
                {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                    initials
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-[min(15rem,calc(100vw-1.25rem))] sm:w-60 rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated animate-fade-up z-50"
                >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-wg-border dark:border-wg-dark-border">
                        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">
                            {displayName}
                        </p>
                        {username && (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">
                                @{username}
                            </p>
                        )}
                        <p className="text-xs text-wg-muted/70 dark:text-wg-dark-muted/70 truncate mt-0.5">
                            {email}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                        <Link
                            href="/account"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors min-h-11"
                        >
                            <UserCircleIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                            <span className="truncate">{tc("myAccount")}</span>
                        </Link>
                        <Link
                            href="/orders"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors min-h-11"
                        >
                            <ClipboardListIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                            <span className="truncate">{tc("myOrders")}</span>
                        </Link>
                        <Link
                            href="/account/wallet"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors min-h-11"
                        >
                            <WalletIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                            <span className="truncate">{tc("myWallet")}</span>
                        </Link>
                        <Link
                            href="/account/reservations"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors min-h-11"
                        >
                            <CalendarBandIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                            <span className="truncate">{tc("myReservations")}</span>
                        </Link>
                        <Link
                            href="/account/addresses"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors min-h-11"
                        >
                            <MapPinIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                            <span className="truncate">{tOrders("sidebar.myAddresses")}</span>
                        </Link>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleSignOut}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors min-h-11 text-left"
                        >
                            <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0" />
                            {tc("signOut")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
