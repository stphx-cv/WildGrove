"use client"

// ══════════════════════════════════════════════════════════════════
// AdminSidebar — Fixed sidebar on desktop, slide-in drawer on mobile
// Links to all admin sections with active state highlighting
// ══════════════════════════════════════════════════════════════════

import Link from "next/link"
import { WildGroveLogo } from "@wildgrove/ui/WildGroveLogo"
import { usePathname } from "next/navigation"
import { useState, useCallback, useEffect } from "react"
import { createClient } from "@wildgrove/core/clients/client"
import { siteLink } from "@wildgrove/core/urls"
import { DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { useCmsQuery, preloadCms } from "@/lib/cms-query"
import {
    ADMIN_RESERVATIONS_LIST_CHANNEL,
    ADMIN_RESERVATION_CREATED_EVENT,
    ADMIN_RESERVATION_UPDATED_EVENT,
} from "@wildgrove/core/admin/reservationsRealtimeShared"
import {
    ArrowUturnLeftIcon,
    BarsBottomLeftIcon,
    BarsIcon,
    BellFlaredIcon,
    CakeIcon,
    CalendarBandIcon,
    ChatBubbleEllipsisIcon,
    ClipboardDocumentListIcon,
    CloseIcon,
    CogFineIcon,
    MapPinIcon,
    SquaresGridIcon,
    StarOutlineIcon,
    TagIcon,
    TicketIcon,
    UsersIcon,
    WalletIcon,
} from "@wildgrove/ui/icons"

// ── Navigation items ──
// Centralized config — add new admin sections here
const NAV_ITEMS = [
    {
        href: "/",
        label: "Dashboard",
        icon: (
            <SquaresGridIcon className="w-5 h-5" />
        ),
        exact: true, // Only highlight when exactly on /
    },
    {
        href: "/notifications",
        label: "Notifications",
        icon: (
            <BellFlaredIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/menu",
        label: "Menu Items",
        icon: (
            <CakeIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/categories",
        label: "Categories",
        icon: (
            <BarsBottomLeftIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/discounts",
        label: "Discounts",
        icon: (
            <TagIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/reservations",
        label: "Reservations",
        icon: (
            <CalendarBandIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/chat",
        label: "Live Chat",
        icon: (
            <ChatBubbleEllipsisIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/tickets",
        label: "Tickets",
        icon: (
            <TicketIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/reviews",
        label: "Reviews",
        icon: (
            <StarOutlineIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/customers",
        label: "Customers",
        icon: (
            <UsersIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/orders",
        label: "Orders",
        separator: true,
        icon: (
            <ClipboardDocumentListIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/wallets",
        label: "Wallets",
        icon: (
            <WalletIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/delivery-zones",
        label: "Delivery Zones",
        icon: (
            <MapPinIcon className="w-5 h-5" />
        ),
    },
    {
        href: "/settings",
        label: "Settings",
        separator: true,
        icon: (
            <CogFineIcon className="w-5 h-5" />
        ),
    },
] as const

const PENDING_COUNTS_KEY = "/api/pending-counts"

/** `GET /api/pending-counts` answers `{ success, counts }`, with no `data` key. */
type PendingCountsPayload = {
    counts?: {
        tickets: number
        reviews: number
        productReviews: number
        orders: number
        unreadReservations: number
        unreadNotifications: number
    }
}

/**
 * The first request each section makes on arrival, so hovering a nav link can
 * start it (D6). The strings must match what the pages ask for exactly, or the
 * preload warms a key nobody reads — they are the same builders with no filters
 * and page 1.
 */
const SECTION_FIRST_KEY: Record<string, string> = {
    "/menu": `/api/menu?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/categories": "/api/categories",
    "/discounts": `/api/discounts?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/reservations": `/api/reservations?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/orders": `/api/orders?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/customers": `/api/customers?page=1&limit=${DEFAULT_PAGE_SIZE}&status=all`,
    "/wallets": `/api/wallets?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/delivery-zones": `/api/delivery-zones?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/reviews": `/api/reviews?page=1&limit=${DEFAULT_PAGE_SIZE}`,
    "/notifications": "/api/notifications?page=1&limit=20&filter=all",
    "/settings": "/api/settings",
}

export function AdminSidebar() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)

    // Close drawer when route changes (mobile) — derived-state-from-props pattern
    const [prevPathname, setPrevPathname] = useState(pathname)
    if (prevPathname !== pathname) {
        setPrevPathname(pathname)
        setIsOpen(false)
    }
    // One request, not seven. Seven parallel fetches meant seven serverless
    // isolates each opening its own Postgres connection, which is what
    // exhausted the database (P2037). See app/api/pending-counts/route.ts.
    //
    // `refreshWhenHidden: false` is the old "only poll while the tab is being
    // looked at" rule, and `revalidateOnFocus` is the old "refresh on return".
    const { data: countsData, mutate: refreshCounts } = useCmsQuery<PendingCountsPayload>(
        PENDING_COUNTS_KEY,
        { refreshInterval: 30_000, refreshWhenHidden: false, revalidateOnFocus: true },
    )

    const counts = countsData?.counts
    const unreadReservationCount = counts?.unreadReservations ?? 0
    const pendingTicketCount = counts?.tickets ?? 0
    const pendingReviewCount = counts?.reviews ?? 0
    const pendingProductReviewCount = counts?.productReviews ?? 0
    const unreadNotifCount = counts?.unreadNotifications ?? 0
    const pendingOrderCount = counts?.orders ?? 0


    // Anything that changes a badge asks this one endpoint again, rather than
    // the per-badge endpoints it used to call: the answer is the same and it is
    // one request instead of two.
    useEffect(() => {
        const refresh = () => { void refreshCounts() }

        window.addEventListener("admin:notification-changed", refresh)
        window.addEventListener("admin:reservation-viewed", refresh)

        const insforge = createClient()
        const channel = insforge.channel(ADMIN_RESERVATIONS_LIST_CHANNEL)
        channel
            .on("broadcast", { event: ADMIN_RESERVATION_CREATED_EVENT }, refresh)
            .on("broadcast", { event: ADMIN_RESERVATION_UPDATED_EVENT }, refresh)
            .subscribe()

        return () => {
            window.removeEventListener("admin:notification-changed", refresh)
            window.removeEventListener("admin:reservation-viewed", refresh)
            insforge.removeChannel(channel)
        }
    }, [refreshCounts])

    // Close drawer with Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false)
        }
        if (isOpen) {
            document.addEventListener("keydown", handleEscape)
            // Prevent body scroll when drawer is open
            document.body.style.overflow = "hidden"
        }
        return () => {
            document.removeEventListener("keydown", handleEscape)
            document.body.style.overflow = ""
        }
    }, [isOpen])

    /**
     * Hovering a nav link starts that section's first request, so the table is
     * full when the page arrives instead of empty for a round trip. The link
     * itself is already prefetched by `<Link>`; this is its data.
     */
    const preloadSection = useCallback((href: string) => {
        const key = SECTION_FIRST_KEY[href]
        if (key) void preloadCms(key)
    }, [])

    const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), [])
    const closeSidebar = useCallback(() => setIsOpen(false), [])

    /** Determines if a nav item should show as active */
    const isActive = useCallback(
        (href: string, exact?: boolean) => {
            if (exact) return pathname === href
            return pathname === href || pathname.startsWith(href + "/")
        },
        [pathname]
    )

    // ── Sidebar content (shared between desktop and mobile) ──
    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 h-16 border-b border-wg-border/50 dark:border-wg-dark-border shrink-0">
                {/* Close button — only visible inside mobile drawer */}
                <button
                    onClick={closeSidebar}
                    className="lg:hidden -ml-1 mr-1 p-1.5 rounded-brand text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text transition-colors shrink-0"
                    aria-label="Close sidebar"
                >
                    <CloseIcon className="w-5 h-5" />
                </button>
                <WildGroveLogo size="md" className="opacity-80" />
                <span className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                    Admin
                </span>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href, "exact" in item ? item.exact : undefined)
                    return (
                        <div key={item.href}>
                            {"separator" in item && item.separator && (
                                <div className="border-t border-wg-border/50 dark:border-wg-dark-border my-3" />
                            )}
                            <Link
                                href={item.href}
                                onPointerEnter={() => preloadSection(item.href)}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-brand text-sm font-medium
                                    transition-all duration-150
                                    ${active
                                        ? "bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary"
                                        : "text-wg-muted hover:text-wg-text hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border"
                                    }
                                `}
                            >
                                <span className={active ? "text-wg-primary dark:text-wg-dark-primary" : ""}>
                                    {item.icon}
                                </span>
                                <span className="flex-1">{item.label}</span>
                                {item.href === "/notifications" && unreadNotifCount > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-sky-400 text-sky-900">
                                        {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                                    </span>
                                )}
                                {item.href === "/reservations" && unreadReservationCount > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-400 text-amber-900">
                                        {unreadReservationCount > 99 ? "99+" : unreadReservationCount}
                                    </span>
                                )}
                                {item.href === "/tickets" && pendingTicketCount > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-400 text-emerald-900">
                                        {pendingTicketCount > 99 ? "99+" : pendingTicketCount}
                                    </span>
                                )}
                                {item.href === "/reviews" && (pendingReviewCount + pendingProductReviewCount) > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-violet-400 text-violet-900">
                                        {(pendingReviewCount + pendingProductReviewCount) > 99 ? "99+" : (pendingReviewCount + pendingProductReviewCount)}
                                    </span>
                                )}
                                {item.href === "/orders" && pendingOrderCount > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-orange-400 text-orange-900">
                                        {pendingOrderCount > 99 ? "99+" : pendingOrderCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    )
                })}
            </nav>

            {/* Back to storefront (absolute — CMS and site are different hosts) */}
            <div className="px-3 py-4 border-t border-wg-border/50 dark:border-wg-dark-border shrink-0">
                <a
                    href={siteLink()}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-brand text-sm font-medium text-wg-muted hover:text-wg-text hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border transition-all duration-150"
                >
                    <ArrowUturnLeftIcon className="w-5 h-5" />
                    Back to Site
                </a>
            </div>
        </div>
    )

    return (
        <>
            {/* ── Mobile hamburger toggle (visible in AdminHeader via context) ── */}
            <button
                onClick={toggleSidebar}
                className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-brand bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text transition-colors shadow-card"
                aria-label="Toggle admin sidebar"
            >
                <BarsIcon className="w-5 h-5" />
            </button>

            {/* ── Desktop sidebar — always visible on lg+ ── */}
            <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-wg-surface dark:bg-wg-dark-surface border-r border-wg-border/50 dark:border-wg-dark-border z-40">
                {sidebarContent}
            </aside>

            {/* ── Mobile drawer overlay ── */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="lg:hidden fixed inset-0 z-40 bg-black/60"
                        onClick={closeSidebar}
                        aria-hidden="true"
                    />
                    {/* Drawer */}
                    <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-wg-surface dark:bg-wg-dark-surface border-r border-wg-border/50 dark:border-wg-dark-border shadow-elevated animate-fade-in">
                        {sidebarContent}
                    </aside>
                </>
            )}
        </>
    )
}
