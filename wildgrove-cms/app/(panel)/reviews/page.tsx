"use client"

// ══════════════════════════════════════════════════════════════════
// Unified Admin Reviews page — /reviews
// Tabbed UI: Reservation reviews + Product reviews under one route.
// ══════════════════════════════════════════════════════════════════

import { useState } from "react"
import { ReservationReviewsList } from "./_components/ReservationReviewsList"
import { ProductReviewsList } from "./_components/ProductReviewsList"
import { useCmsQuery } from "@/lib/cms-query"

type TabKey = "reservations" | "products"

/** The pending-count endpoints answer `{ success, count }`, with no `data` key. */
type PendingCount = { count?: number }

export default function AdminReviewsPage() {
    const [tab, setTab] = useState<TabKey>("reservations")

    const { data: reservationPending } = useCmsQuery<PendingCount>("/api/reviews/pending-count")
    const { data: productPending } = useCmsQuery<PendingCount>("/api/product-reviews/pending-count")

    const pendingReservation = reservationPending?.count ?? 0
    const pendingProduct = productPending?.count ?? 0

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-display font-bold text-wg-text dark:text-wg-dark-text">
                    Reviews
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Manage customer reviews from both reservations and product purchases.
                </p>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-wg-border/50 dark:border-wg-dark-border">
                <nav className="flex gap-1" role="tablist" aria-label="Review type">
                    <TabButton
                        active={tab === "reservations"}
                        onClick={() => setTab("reservations")}
                        label="Reservations"
                        badge={pendingReservation}
                    />
                    <TabButton
                        active={tab === "products"}
                        onClick={() => setTab("products")}
                        label="Products"
                        badge={pendingProduct}
                    />
                </nav>
            </div>

            {/* Active tab content */}
            <div role="tabpanel">
                {tab === "reservations" ? <ReservationReviewsList /> : <ProductReviewsList />}
            </div>
        </div>
    )
}

function TabButton({
    active,
    onClick,
    label,
    badge,
}: {
    active: boolean
    onClick: () => void
    label: string
    badge: number
}) {
    return (
        <button
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                active
                    ? "border-wg-primary text-wg-text dark:border-wg-dark-primary dark:text-wg-dark-text"
                    : "border-transparent text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text"
            }`}
        >
            {label}
            {badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-violet-400 text-violet-900">
                    {badge > 99 ? "99+" : badge}
                </span>
            )}
        </button>
    )
}
