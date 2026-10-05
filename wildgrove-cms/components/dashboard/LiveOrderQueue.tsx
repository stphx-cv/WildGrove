"use client"

import { memo, useEffect, useState } from "react"
import Link from "next/link"
import type { LiveOrder } from "@/lib/admin/dashboard-types"

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending",
    PREPARING: "Preparing",
    READY: "Ready",
    OUT_FOR_DELIVERY: "Out for delivery",
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    PREPARING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
}

function useElapsedMinutes(isoDate: string): number {
    const [minutes, setMinutes] = useState(() =>
        Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000)
    )
    useEffect(() => {
        const id = setInterval(() => {
            setMinutes(Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000))
        }, 30_000)
        return () => clearInterval(id)
    }, [isoDate])
    return minutes
}

const OrderRow = memo(function OrderRow({
    order,
    kitchenAlertMinutes,
    pickupAlertMinutes,
}: {
    order: LiveOrder
    kitchenAlertMinutes: number
    pickupAlertMinutes: number
}) {
    const elapsed = useElapsedMinutes(order.createdAt)
    const isLate =
        (order.status === "PREPARING" && elapsed > kitchenAlertMinutes) ||
        (order.status === "READY" && elapsed > pickupAlertMinutes)

    return (
        <tr
            className={`border-b border-wg-border/20 dark:border-wg-dark-border/20 transition-colors ${
                isLate ? "bg-red-50/60 dark:bg-red-950/20" : "hover:bg-wg-border/10 dark:hover:bg-wg-dark-border/10"
            }`}
        >
            <td className="px-4 py-3">
                <Link
                    href={`/orders/${order.id}`}
                    className="text-sm font-semibold text-wg-accent dark:text-wg-dark-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent rounded"
                >
                    #{order.orderNumber}
                </Link>
            </td>
            <td className="px-4 py-3 text-sm text-wg-text dark:text-wg-dark-text max-w-[140px] truncate">
                {order.customerName ?? "—"}
            </td>
            <td className="px-4 py-3 text-sm text-wg-muted dark:text-wg-dark-muted">
                {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
            </td>
            <td className="px-4 py-3">
                <span className="text-xs capitalize text-wg-muted dark:text-wg-dark-muted">
                    {order.fulfillment.toLowerCase()}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? ""}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                </span>
            </td>
            <td className="px-4 py-3 text-sm tabular-nums">
                {isLate ? (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium" role="status">
                        <span aria-hidden="true">⚠</span>
                        <span>Late {elapsed}m</span>
                    </span>
                ) : (
                    <span className="text-wg-muted dark:text-wg-dark-muted">{elapsed}m</span>
                )}
            </td>
        </tr>
    )
})

interface LiveOrderQueueProps {
    orders: LiveOrder[]
    kitchenAlertMinutes: number
    pickupAlertMinutes: number
}

export function LiveOrderQueue({ orders, kitchenAlertMinutes, pickupAlertMinutes }: LiveOrderQueueProps) {
    if (orders.length === 0) {
        return (
            <div className="px-4 py-8 text-center text-sm text-wg-muted dark:text-wg-dark-muted">
                No active orders right now
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="Active order queue">
                <thead>
                    <tr className="border-b border-wg-border/30 dark:border-wg-dark-border">
                        <th className="px-4 py-2 text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">Order</th>
                        <th className="px-4 py-2 text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">Customer</th>
                        <th className="px-4 py-2 text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">Items</th>
                        <th className="px-4 py-2 text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">Type</th>
                        <th className="px-4 py-2 text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">Status</th>
                        <th className="px-4 py-2 text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">Age</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            kitchenAlertMinutes={kitchenAlertMinutes}
                            pickupAlertMinutes={pickupAlertMinutes}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}
