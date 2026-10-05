"use client"

import Link from "next/link"
import { useDashboardData } from "@/hooks/useDashboardData"
import { LiveOrderQueue } from "@/components/dashboard/LiveOrderQueue"
import { StatCardWithTrend, StatCardSkeleton } from "@/components/dashboard/StatCardWithTrend"
import type { OperationsDTO, TodayReservation, WaitingChat } from "@/lib/admin/dashboard-types"
import {
    ClipboardDocumentTextIcon,
    ClockRightAngleIcon,
    ExclamationTriangleIcon,
    MapPinIcon,
} from "@wildgrove/ui/icons"

const RESERVATION_STATUS_COLORS: Record<string, string> = {
    PENDING:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    CONFIRMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    COMPLETED: "bg-wg-border/40 text-wg-muted dark:bg-wg-dark-border/40 dark:text-wg-dark-muted",
}

function SectionPanel({ title, children, viewAllHref }: { title: string; children: React.ReactNode; viewAllHref?: string }) {
    return (
        <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border/30 dark:border-wg-dark-border">
                <h3 className="font-display text-base font-semibold text-wg-text dark:text-wg-dark-text">{title}</h3>
                {viewAllHref && (
                    <Link href={viewAllHref} className="text-xs font-medium text-wg-accent dark:text-wg-dark-accent hover:underline">
                        View all
                    </Link>
                )}
            </div>
            {children}
        </div>
    )
}

function ReservationRow({ r }: { r: TodayReservation }) {
    const time = new Date(r.date).toLocaleTimeString("en-US", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    })
    return (
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-wg-border/15 dark:border-wg-dark-border/15 last:border-0 hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/10">
            <div>
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{r.guestName ?? "Guest"}</p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{time} · {r.partySize} guests</p>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${RESERVATION_STATUS_COLORS[r.status] ?? ""}`}>
                {r.status.toLowerCase()}
            </span>
        </div>
    )
}

function ChatRow({ c }: { c: WaitingChat }) {
    return (
        <Link
            href="/chat"
            className="flex items-start gap-3 px-5 py-2.5 border-b border-wg-border/15 dark:border-wg-dark-border/15 last:border-0 hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-accent"
        >
            <span className={`mt-0.5 shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                c.status === "WAITING"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            }`}>
                {c.status}
            </span>
            <div className="min-w-0">
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{c.customerName}</p>
                {c.lastMessage && (
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">{c.lastMessage}</p>
                )}
            </div>
        </Link>
    )
}

export function OperationsSection() {
    const { data, isLoading } = useDashboardData<OperationsDTO>({
        endpoint: "/api/dashboard/operations",
        intervalMs: 5_000,
    })

    const kitchenAlert = data?.kitchenAlertMinutes ?? 20
    const pickupAlert = data?.pickupAlertMinutes ?? 10

    return (
        <section aria-labelledby="ops-heading" className="space-y-6">
            <div className="flex items-center gap-2">
                <h2 id="ops-heading" className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">
                    Operations
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
                    Live
                </span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {isLoading && !data ? (
                    Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCardWithTrend
                            title="Active orders"
                            value={data?.activeOrdersCount ?? 0}
                            icon={<ClipboardDocumentTextIcon className="w-5 h-5" />}
                            tooltip="Orders currently in PENDING, PREPARING, READY or OUT_FOR_DELIVERY"
                        />
                        <StatCardWithTrend
                            title="Avg prep time"
                            value={data?.avgPrepMinutes != null ? `${data.avgPrepMinutes}m` : "—"}
                            icon={<ClockRightAngleIcon className="w-5 h-5" />}
                            tooltip="Rolling average of last 20 visible completed orders today"
                        />
                        <StatCardWithTrend
                            title="Pickup / Delivery"
                            value={`${data?.pickupCount ?? 0} / ${data?.deliveryCount ?? 0}`}
                            icon={<MapPinIcon className="w-5 h-5" />}
                            tooltip="Active orders by fulfillment type"
                        />
                        <StatCardWithTrend
                            title="Late alerts"
                            value={data?.lateOrdersCount ?? 0}
                            className={data && data.lateOrdersCount > 0 ? "border-red-300 dark:border-red-800" : ""}
                            icon={<ExclamationTriangleIcon className="w-5 h-5" />}
                            tooltip={`Orders past alert thresholds: PREPARING >${kitchenAlert}m, READY >${pickupAlert}m`}
                        />
                    </>
                )}
            </div>

            {/* Live queue + Reservations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionPanel title="Live Order Queue" viewAllHref="/orders">
                    <LiveOrderQueue
                        orders={data?.liveOrders ?? []}
                        kitchenAlertMinutes={kitchenAlert}
                        pickupAlertMinutes={pickupAlert}
                    />
                </SectionPanel>

                <div className="space-y-4">
                    <SectionPanel title="Today's Reservations" viewAllHref="/reservations">
                        {!data || data.todayReservations.length === 0 ? (
                            <p className="px-5 py-6 text-sm text-wg-muted dark:text-wg-dark-muted text-center">No reservations today</p>
                        ) : (
                            <div>
                                {data.todayReservations.map((r) => <ReservationRow key={r.id} r={r} />)}
                            </div>
                        )}
                    </SectionPanel>

                    <SectionPanel title="Waiting Chats" viewAllHref="/chat">
                        {!data || data.waitingChats.length === 0 ? (
                            <p className="px-5 py-6 text-sm text-wg-muted dark:text-wg-dark-muted text-center">No waiting chats</p>
                        ) : (
                            <div>
                                {data.waitingChats.map((c) => <ChatRow key={c.id} c={c} />)}
                            </div>
                        )}
                    </SectionPanel>
                </div>
            </div>
        </section>
    )
}
