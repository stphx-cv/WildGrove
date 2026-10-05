"use client"

import { cmsLink } from "@wildgrove/core/urls"
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "@/i18n/routing"
import { Link } from "@/i18n/routing"
import NextLink from "next/link"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { WildGroveLogo } from "@wildgrove/ui/WildGroveLogo"
import { useTranslations } from "next-intl"
import { ThemeToggle } from "@wildgrove/ui/ThemeToggle"
import { LanguageSelector } from "@/components/layout/LanguageSelector"
import { CurrencySelector } from "@/components/layout/CurrencySelector"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { createClient } from "@wildgrove/core/clients/client"
import { SocialLinks, type SocialLinkView } from "@wildgrove/ui/social/SocialLinks"
import { useDrawerFocus } from "@/components/ui/useDrawerFocus"
import {
    ArrowRightOnRectangleIcon,
    BarsIcon,
    BookOpenIcon,
    CalendarBandIcon,
    ChevronRightIcon,
    ClipboardListIcon,
    CloseIcon,
    CogIcon,
    EnvelopeIcon,
    MapPinIcon,
    PhoneRoundedIcon,
    UserCircleIcon,
    UserGroupIcon,
    WalletIcon,
} from "@wildgrove/ui/icons"

export interface MobileNavVisitInfo {
    address: string | null
    mapsUrl: string | null
    socials: SocialLinkView[]
    hideSocialHandles: boolean
    phone: string | null
    telHref: string | null
}

interface MobileNavProps {
    links: { href: string; label: string }[]
    user: { firstName: string | null; lastName: string | null; username: string | null; email: string; avatarUrl: string | null } | null
    isAdmin?: boolean
    visitInfo?: MobileNavVisitInfo
}

const NAV_ICONS: Record<string, ReactNode> = {
    "/menu": (
        <BookOpenIcon className="w-6 h-6" />
    ),
    "/reservations": (
        <CalendarBandIcon className="w-6 h-6" />
    ),
    "/about": (
        <UserGroupIcon className="w-6 h-6" />
    ),
    "/contact": (
        <EnvelopeIcon className="w-6 h-6" />
    ),
}

function getInitial(firstName: string | null, email: string): string {
    if (firstName && firstName.length > 0) return firstName[0].toUpperCase()
    return email[0].toUpperCase()
}

function getAvatarColor(identifier: string): string {
    let hash = 0
    for (let i = 0; i < identifier.length; i++) {
        hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colors = [
        "bg-emerald-600", "bg-teal-600", "bg-cyan-600",
        "bg-sky-600", "bg-indigo-600", "bg-violet-600",
        "bg-purple-600", "bg-fuchsia-600", "bg-rose-600",
        "bg-amber-600",
    ]
    return colors[Math.abs(hash) % colors.length]
}

const accountRowClass =
    "flex items-center gap-2.5 w-full min-h-10 px-3 py-2 text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors"

const accountIconClass = "w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted"

function AccountRowChevron() {
    return (
        <ChevronRightIcon className="w-3.5 h-3.5 shrink-0 text-wg-muted/80 dark:text-wg-dark-muted/80" />
    )
}

function AccountOrdersIcon() {
    return (
        <ClipboardListIcon className={accountIconClass} />
    )
}

function AccountWalletIcon() {
    return (
        <WalletIcon className={accountIconClass} />
    )
}

function AccountReservationsIcon() {
    return (
        <CalendarBandIcon className={accountIconClass} />
    )
}

function AccountAddressesIcon() {
    return (
        <MapPinIcon className={accountIconClass} />
    )
}

function AccountSignOutIcon() {
    return (
        <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
    )
}

function navCardClass(isActive: boolean): string {
    const base =
        "flex flex-col items-center justify-center gap-1.5 min-h-[3.75rem] max-[380px]:min-h-[3.25rem] p-2.5 max-[380px]:p-2 rounded-card border text-sm max-[380px]:text-xs font-medium transition-all duration-200"
    if (isActive) {
        return `${base} border-wg-accent/40 dark:border-wg-dark-accent/40 bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20 shadow-card`
    }
    return `${base} border-wg-border/60 dark:border-wg-dark-border bg-wg-bg/60 dark:bg-wg-dark-raised/60 text-wg-text dark:text-wg-dark-text hover:border-wg-primary/30 dark:hover:border-wg-dark-primary/30 hover:bg-wg-bg dark:hover:bg-wg-dark-raised hover:shadow-card`
}

export function MobileNav({ links, user, isAdmin, visitInfo }: MobileNavProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const insforge = createClient()
    const tc = useTranslations("common")
    // With one store currency there is nothing to choose.
    const { storeCurrency } = useCurrency()

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    /* eslint-disable react-hooks/set-state-in-effect -- portal mount guard after hydration */
    useEffect(() => {
        setMounted(true)
    }, [])
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleClose = useCallback(() => setIsOpen(false), [])
    const burgerRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useDrawerFocus(isOpen, handleClose, burgerRef)

    const handleNavClick = useCallback(() => setIsOpen(false), [])

    async function handleSignOut() {
        await insforge.auth.signOut()
        setIsOpen(false)
        router.refresh()
    }

    // Stays mounted so it can animate out; closed, it is inert: nothing inside
    // takes focus or is read by a screen reader.
    const overlay = (
        <div
            ref={dialogRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={tc("navigationMenu")}
            inert={!isOpen}
            className={`fixed inset-0 z-[200] transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
        >
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70"
                onClick={handleClose}
            />

            <div
                className={`absolute top-0 right-0 h-full w-[min(calc(100vw-1rem),20rem)] bg-wg-surface dark:bg-wg-dark-surface border-l border-wg-border dark:border-wg-dark-border shadow-elevated transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-wg-border dark:border-wg-dark-border shrink-0">
                    <div className="flex items-center gap-2">
                        <WildGroveLogo size="lg" />
                        <span className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                            Wild Grove
                        </span>
                    </div>
                    <button
                        onClick={handleClose}
                        aria-label={tc("closeNavigation")}
                        className="p-2 text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body — linear stack (no flex-1 centering) to avoid overlap on short viewports */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    <nav className="p-3 max-[380px]:p-2.5 grid grid-cols-2 gap-2 max-[380px]:gap-1.5 shrink-0">
                        {links.map((link) => {
                            const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={handleNavClick}
                                    className={navCardClass(isActive)}
                                >
                                    <span className={isActive ? "text-wg-accent dark:text-wg-dark-accent" : "text-wg-primary dark:text-wg-dark-primary"}>
                                        {NAV_ICONS[link.href] ?? null}
                                    </span>
                                    <span>{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    {isAdmin && (
                        <div className="px-3 max-[380px]:px-2.5 pb-2 shrink-0">
                            <a
                                href={cmsLink()}
                                onClick={handleNavClick}
                                className="flex items-center justify-center gap-2 w-full min-h-11 px-4 py-2.5 text-sm font-semibold rounded-card border border-wg-accent/45 dark:border-wg-dark-accent/50 text-wg-accent dark:text-wg-dark-accent bg-wg-accent/15 dark:bg-wg-dark-accent/20 ring-1 ring-wg-accent/25 dark:ring-wg-dark-accent/30 shadow-card hover:bg-wg-accent/25 dark:hover:bg-wg-dark-accent/30 transition-all"
                            >
                                <CogIcon className="w-4 h-4 shrink-0" />
                                {tc("adminPanel")}
                            </a>
                        </div>
                    )}

                    {user && (
                        <div className="px-3 max-[380px]:px-2.5 pb-3 pt-3 shrink-0">
                            <div className="rounded-card border border-wg-border/60 dark:border-wg-dark-border/60 overflow-hidden bg-wg-bg/40 dark:bg-wg-dark-raised/40">
                                <Link
                                    href="/account"
                                    onClick={handleNavClick}
                                    className={`${accountRowClass} border-b border-wg-border/60 dark:border-wg-dark-border/60 font-medium`}
                                >
                                    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden">
                                        {user.avatarUrl ? (
                                            <FadeInImage
                                                src={user.avatarUrl}
                                                alt={user.firstName ?? user.email}
                                                width={32}
                                                height={32}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className={`w-full h-full ${getAvatarColor(user.username ?? user.email)} text-white text-xs font-semibold flex items-center justify-center`}>
                                                {getInitial(user.firstName, user.email)}
                                            </div>
                                        )}
                                    </div>
                                    <span className="min-w-0 flex-1 truncate">
                                        {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                                    </span>
                                    <AccountRowChevron />
                                </Link>
                                <Link href="/orders" onClick={handleNavClick} className={`${accountRowClass} border-b border-wg-border/60 dark:border-wg-dark-border/60`}>
                                    <AccountOrdersIcon />
                                    <span className="flex-1 truncate">{tc("myOrders")}</span>
                                    <AccountRowChevron />
                                </Link>
                                <Link href="/account/wallet" onClick={handleNavClick} className={`${accountRowClass} border-b border-wg-border/60 dark:border-wg-dark-border/60`}>
                                    <AccountWalletIcon />
                                    <span className="flex-1 truncate">{tc("myWallet")}</span>
                                    <AccountRowChevron />
                                </Link>
                                <Link href="/account/reservations" onClick={handleNavClick} className={`${accountRowClass} border-b border-wg-border/60 dark:border-wg-dark-border/60`}>
                                    <AccountReservationsIcon />
                                    <span className="flex-1 truncate">{tc("myReservations")}</span>
                                    <AccountRowChevron />
                                </Link>
                                <Link href="/account/addresses" onClick={handleNavClick} className={`${accountRowClass} border-b border-wg-border/60 dark:border-wg-dark-border/60`}>
                                    <AccountAddressesIcon />
                                    <span className="flex-1 truncate">{tc("addresses")}</span>
                                    <AccountRowChevron />
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className={`${accountRowClass} font-medium text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-950/40 hover:bg-red-500/15 dark:hover:bg-red-950/55`}
                                >
                                    <AccountSignOutIcon />
                                    <span className="flex-1 text-left truncate">{tc("signOut")}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {!user && (
                        <div className="px-3 max-[380px]:px-2.5 pb-3 shrink-0">
                            <Link
                                href="/portal"
                                onClick={handleNavClick}
                                className="flex items-center justify-center gap-2 w-full min-h-10 px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:text-wg-primary hover:border-wg-primary dark:hover:text-wg-dark-primary dark:hover:border-wg-dark-primary transition-all"
                            >
                                <UserCircleIcon className="w-4 h-4 shrink-0" />
                                {tc("signIn")}
                            </Link>
                        </div>
                    )}
                </div>

                {/* Fixed footer — contact, settings, primary CTA */}
                <div className="shrink-0 border-t border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {visitInfo && (
                        <div className="px-3 max-[380px]:px-2.5 pt-3 pb-1 flex flex-wrap items-center justify-center gap-2">
                            {visitInfo.mapsUrl && visitInfo.address && (
                                <a
                                    href={visitInfo.mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={handleNavClick}
                                    aria-label={`${tc("openInMaps")}: ${visitInfo.address}`}
                                    className="flex items-center justify-center w-11 h-11 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-primary dark:text-wg-dark-primary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-all"
                                >
                                    <MapPinIcon className="w-5 h-5" />
                                </a>
                            )}
                            {visitInfo.telHref && visitInfo.phone && (
                                <a
                                    href={`tel:${visitInfo.telHref}`}
                                    onClick={handleNavClick}
                                    aria-label={visitInfo.phone}
                                    className="flex items-center justify-center w-11 h-11 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-primary dark:text-wg-dark-primary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-all"
                                >
                                    <PhoneRoundedIcon className="w-5 h-5" />
                                </a>
                            )}
                            <SocialLinks
                                links={visitInfo.socials}
                                size="md"
                                hideHandles={visitInfo.hideSocialHandles}
                                onNavigate={handleNavClick}
                            />
                        </div>
                    )}
                    <div className={`px-3 max-[380px]:px-2.5 pt-2.5 pb-1.5 grid ${storeCurrency ? "grid-cols-2" : "grid-cols-3"} gap-1.5 max-[380px]:gap-1`}>
                        <div className="flex flex-col items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                {tc("language")}
                            </span>
                            <LanguageSelector />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                {tc("theme")}
                            </span>
                            <ThemeToggle />
                        </div>
                        {!storeCurrency && (
                            <div className="flex flex-col items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted">
                                    {tc("currency")}
                                </span>
                                <CurrencySelector compact />
                            </div>
                        )}
                    </div>
                    <div className="px-3 max-[380px]:px-2.5 pb-2 pt-0.5">
                        <Link
                            href="/reservations"
                            onClick={handleNavClick}
                            className="flex items-center justify-center w-full min-h-11 max-[380px]:min-h-10 px-4 py-2.5 max-[380px]:py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all"
                        >
                            {tc("reserveTable")}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="md:hidden flex items-center gap-1">
            <button
                ref={burgerRef}
                onClick={() => setIsOpen(true)}
                aria-label={tc("openNavigation")}
                aria-expanded={isOpen}
                aria-controls="mobile-nav"
                className="p-2 text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors"
            >
                <BarsIcon className="w-6 h-6" />
            </button>

            {mounted ? createPortal(overlay, document.body) : null}
        </div>
    )
}
