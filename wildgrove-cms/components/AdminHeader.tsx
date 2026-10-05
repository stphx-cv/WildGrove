"use client"

// ══════════════════════════════════════════════════════════════════
// AdminHeader — Top bar for admin pages
// Shows breadcrumbs, admin user info, and theme toggle
// ══════════════════════════════════════════════════════════════════

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { ThemeToggle } from "@wildgrove/ui/ThemeToggle"
import { AdminNotificationsBell } from "@/components/AdminNotificationsBell"
import { SignOutButton } from "@/components/SignOutButton"
import Link from "next/link"
import { ChevronRightIcon } from "@wildgrove/ui/icons"

/**
 * Converts a pathname like "/menu/new" into breadcrumbs:
 * [{ label: "Admin", href: "/" }, { label: "Menu", href: "/menu" }, { label: "New" }]
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUID_RE = /^c[a-z0-9]{20,}$/

function useBreadcrumbs(pathname: string) {
    return useMemo(() => {
        const segments = pathname.split("/").filter(Boolean)
        return segments.map((segment, index) => {
            const href = "/" + segments.slice(0, index + 1).join("/")
            // Replace UUIDs / CUIDs / dynamic segments with "Details"
            const isId = UUID_RE.test(segment) || CUID_RE.test(segment)
            const label = isId
                ? "Details"
                : segment
                    .replace(/\[.*?\]/g, "Details")
                    .replace(/-/g, " ")
                    .replace(/^\w/, (c) => c.toUpperCase())
            const isLast = index === segments.length - 1
            return { label, href, isLast }
        })
    }, [pathname])
}

export function AdminHeader() {
    const pathname = usePathname()
    const breadcrumbs = useBreadcrumbs(pathname)

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-wg-bg dark:bg-wg-dark-bg border-b border-wg-border/50 dark:border-wg-dark-border">
            {/* Breadcrumbs — hidden on mobile (too narrow), shown on sm+ */}
            <nav className="hidden sm:flex items-center gap-1.5 text-sm" aria-label="Breadcrumbs">
                {breadcrumbs.map((crumb, index) => (
                    <span key={crumb.href} className="flex items-center gap-1.5">
                        {index > 0 && (
                            <ChevronRightIcon className="w-3.5 h-3.5 text-wg-border dark:text-wg-dark-border" strokeWidth={2} />
                        )}
                        {crumb.isLast ? (
                            <span className="font-medium text-wg-text dark:text-wg-dark-text">
                                {crumb.label}
                            </span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </span>
                ))}
            </nav>

            {/* Mobile: page title */}
            <h1 className="sm:hidden font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text pl-12">
                {breadcrumbs[breadcrumbs.length - 1]?.label ?? "Admin"}
            </h1>

            {/* Right actions */}
            <div className="flex items-center gap-3">
                <AdminNotificationsBell />
                <ThemeToggle />
                <SignOutButton />
            </div>
        </header>
    )
}
