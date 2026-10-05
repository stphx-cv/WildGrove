"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Customers Page — /customers
// Rich customer grid with avatar, role, providers, and stats
// ══════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import Link from "next/link"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { LoadingState } from "@/components/LoadingState"
import { useCmsQuery } from "@/lib/cms-query"
import {
    DevicePhoneMobileIcon,
    EnvelopeIcon,
    ExclamationTriangleIcon,
    GoogleMonoLogo,
    UsersIcon,
} from "@wildgrove/ui/icons"

interface CustomerRow {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string | null
    avatarUrl: string | null
    phoneNumber: string | null
    phoneCountryCode: string | null
    role: string
    connections: string[]
    createdAt: string
    reservationCount: number
    messageCount: number
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

const ROLE_BADGE: Record<string, string> = {
    CUSTOMER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    OWNER: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
}

const PROVIDER_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
    EMAIL: {
        label: "Email",
        icon: (
            <EnvelopeIcon className="w-3.5 h-3.5" />
        ),
    },
    GOOGLE: {
        label: "Google",
        icon: (
            <GoogleMonoLogo className="w-3.5 h-3.5" />
        ),
    },
    PHONE: {
        label: "Phone",
        icon: (
            <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
        ),
    },
}

function CustomerCard({ item }: { item: CustomerRow }) {
    const isIncomplete = item.connections.length === 0
    const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ") || "No name"
    const initials = [item.firstName?.[0], item.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?"
    const phone = item.phoneCountryCode && item.phoneNumber
        ? `+${item.phoneCountryCode} ${item.phoneNumber}`
        : item.phoneNumber || null

    return (
        <Link
            href={`/customers/${item.id}`}
            className="group block rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card hover:shadow-elevated hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40 transition-all duration-200"
        >
            {/* Top accent strip — orange if incomplete */}
            <div className={`h-1.5 w-full rounded-t-card ${isIncomplete ? "bg-gradient-to-r from-orange-500/70 via-orange-400/40 to-orange-300/20" : "bg-gradient-to-r from-wg-primary/60 via-wg-primary/20 to-wg-accent/40"}`} />

            <div className="p-5">
                {/* Avatar + name row */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0">
                        {item.avatarUrl ? (
                            <FadeInImage
                                src={item.avatarUrl}
                                alt={fullName}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-full object-cover border-2 border-wg-border/30 dark:border-wg-dark-border/50"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-wg-primary dark:bg-wg-dark-primary flex items-center justify-center border-2 border-wg-border/30 dark:border-wg-dark-border/50">
                                <span className="text-sm font-bold text-white">{initials}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-wg-text dark:text-wg-dark-text truncate group-hover:text-wg-accent dark:group-hover:text-wg-dark-accent transition-colors">
                                {fullName}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide ${ROLE_BADGE[item.role] ?? ROLE_BADGE.CUSTOMER}`}>
                                {item.role}
                            </span>
                            {isIncomplete && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                    <ExclamationTriangleIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                                    Incomplete
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                            {item.username ? `@${item.username}` : <span className="italic opacity-60">No username</span>}
                        </p>
                        <p className="text-xs text-wg-muted/80 dark:text-wg-dark-muted/80 mt-0.5 truncate">{item.email || "—"}</p>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-wg-border/30 dark:border-wg-dark-border/30 mb-4" />

                {/* Info grid — always show all fields */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs mb-4">
                    <div>
                        <p className="text-wg-muted dark:text-wg-dark-muted mb-0.5 uppercase tracking-wide text-[10px] font-medium">Phone</p>
                        <p className="text-wg-text dark:text-wg-dark-text font-medium truncate">{phone || <span className="text-wg-muted/60 dark:text-wg-dark-muted/60">Not set</span>}</p>
                    </div>
                    <div>
                        <p className="text-wg-muted dark:text-wg-dark-muted mb-0.5 uppercase tracking-wide text-[10px] font-medium">Joined</p>
                        <p className="text-wg-text dark:text-wg-dark-text font-medium">
                            {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                    </div>
                    <div>
                        <p className="text-wg-muted dark:text-wg-dark-muted mb-0.5 uppercase tracking-wide text-[10px] font-medium">Reservations</p>
                        <p className={`font-semibold tabular-nums ${item.reservationCount > 0 ? "text-wg-accent dark:text-wg-dark-accent" : "text-wg-muted/60 dark:text-wg-dark-muted/60"}`}>
                            {item.reservationCount}
                        </p>
                    </div>
                    <div>
                        <p className="text-wg-muted dark:text-wg-dark-muted mb-0.5 uppercase tracking-wide text-[10px] font-medium">Messages</p>
                        <p className={`font-semibold tabular-nums ${item.messageCount > 0 ? "text-wg-accent dark:text-wg-dark-accent" : "text-wg-muted/60 dark:text-wg-dark-muted/60"}`}>
                            {item.messageCount}
                        </p>
                    </div>
                </div>

                {/* Auth providers — always show */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {item.connections.length > 0 ? item.connections.map((conn) => {
                        const info = PROVIDER_ICONS[conn]
                        return (
                            <span key={conn} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-wg-border/20 dark:bg-wg-dark-border/40 text-wg-muted dark:text-wg-dark-muted">
                                {info?.icon}{info?.label ?? conn}
                            </span>
                        )
                    }) : (
                        <span className="text-[11px] italic text-wg-muted/50 dark:text-wg-dark-muted/50">No linked providers</span>
                    )}
                </div>
            </div>
        </Link>
    )
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

type CustomerListPayload = { items: CustomerRow[]; pagination: PaginationData }

export default function AdminCustomersPage() {
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "incomplete">("all")

    // `/api/role` is shared with every other reader in the panel: one request.
    const { data: roleData } = useCmsQuery<{ role?: "ADMIN" | "OWNER" }>("/api/role")
    const adminRole = roleData?.role ?? "ADMIN"

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE), status: statusFilter })
        if (search) params.set("search", search)
        return `/api/customers?${params}`
    }, [page, search, statusFilter])

    const { data: list, isLoading } = useCmsQuery<CustomerListPayload>(listKey)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION

    // Back to page 1 when the filters change. Derived-state-from-props rather
    // than an effect: the render that changes the filter is the render that
    // resets the page, so no second pass and no intermediate fetch of page 5
    // under the new filter.
    const filterKey = `${search}|${statusFilter}`
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
    if (prevFilterKey !== filterKey) {
        setPrevFilterKey(filterKey)
        setPage(1)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">Customers</h1>
                        <span className="inline-flex items-center justify-center min-w-[22px] h-6 px-2 text-xs font-semibold rounded-full bg-wg-border/30 dark:bg-wg-dark-border/40 text-wg-muted dark:text-wg-dark-muted">
                            {pagination.total}
                        </span>
                    </div>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                        {adminRole === "OWNER"
                            ? "Manage customer and admin profiles, roles, and account status"
                            : "Manage customer profiles, activity, and account status"}
                    </p>
                </div>
                <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, or username..." className="sm:w-80" />
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1 p-1 bg-wg-border/20 dark:bg-wg-dark-border/20 rounded-brand w-fit">
                {(["all", "complete", "incomplete"] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-1.5 text-xs font-medium rounded-[6px] transition-all capitalize ${
                            statusFilter === s
                                ? "bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text shadow-sm"
                                : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text"
                        }`}
                    >
                        {s === "incomplete" ? "Incomplete" : s === "complete" ? "Complete" : "All"}
                    </button>
                ))}
            </div>

            {/* Grid */}
            {isLoading ? (
                <LoadingState size="page" message="Loading customers…" />
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <UsersIcon className="w-12 h-12 text-wg-muted/40 dark:text-wg-dark-muted/40 mb-4" strokeWidth={1} />
                    <p className="text-wg-muted dark:text-wg-dark-muted font-medium">No customers found</p>
                    {search && <p className="text-sm text-wg-muted/70 dark:text-wg-dark-muted/70 mt-1">Try a different search term</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {items.map((item) => (
                        <CustomerCard key={item.id} item={item} />
                    ))}
                </div>
            )}

            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={setPage}
            />
        </div>
    )
}
