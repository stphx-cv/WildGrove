// ══════════════════════════════════════════════════════════════════
// Dashboard Queries — all Prisma aggregations for the admin dashboard
//
// LIVE-DATA-ONLY rules (applied universally):
//  1. Orders → exclude CANCELLED, REFUNDED (except in cancel/refund rate)
//  2. Reservations → exclude CANCELLED (except health metrics)
//  3. MenuItem → isDraft=false; low-performers also available=true
//  4. Profile → role=CUSTOMER for "Total Customers"
//  5. Wallet → isActive=true
//  6. Timezone → Lima (UTC-5, no DST) via getLimaDayBounds()
//  7. Hidden rows → Order and Reservation with hiddenByAdmin=true never count
// ══════════════════════════════════════════════════════════════════

import { prisma } from "@wildgrove/db"
import { getLimaDayBounds } from "@wildgrove/core/app-datetime-format"
import type {
    DateRange, Trend,
    OperationsDTO, FinancialDTO, ProductsCustomersDTO, HealthDTO,
    DailyRevenue, HourlyHeatCell, WeekdayBar,
} from "./dashboard-types"

const LIVE_ORDER_STATUSES = ["PENDING", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const
const TERMINAL_STATUSES = ["CANCELLED", "REFUNDED"] as const
const VISIBLE = { hiddenByAdmin: false } as const

function calcTrend(current: number, previous: number): Trend {
    if (previous === 0) return { value: current > 0 ? 100 : 0, prev: previous }
    return { value: Math.round(((current - previous) / previous) * 1000) / 10, prev: previous }
}

function prevRange(range: DateRange): DateRange {
    const duration = range.to.getTime() - range.from.getTime()
    return { from: new Date(range.from.getTime() - duration), to: new Date(range.from.getTime()) }
}

// ── Section 1 · Operations (always "now") ────────────────────────

export async function getOperationsData(settings: {
    kitchenAlertMinutes: number
    pickupAlertMinutes: number
}): Promise<OperationsDTO> {
    const now = new Date()
    const { start: todayStart, end: todayEnd } = getLimaDayBounds(now)
    const kitchenMs = settings.kitchenAlertMinutes * 60_000
    const pickupMs = settings.pickupAlertMinutes * 60_000

    const [liveOrdersRaw, last20Completed, todayResRaw, waitingChatsRaw] = await Promise.all([
        prisma.order.findMany({
            where: { ...VISIBLE, status: { in: [...LIVE_ORDER_STATUSES] } },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                fulfillment: true,
                createdAt: true,
                paidAt: true,
                items: { select: { quantity: true } },
                profile: { select: { firstName: true, lastName: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
        }),
        // Avg prep time: last 20 visible orders completed today
        prisma.order.findMany({
            where: {
                ...VISIBLE,
                status: "COMPLETED",
                updatedAt: { gte: todayStart, lt: todayEnd },
                paidAt: { not: null },
            },
            select: { paidAt: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 20,
        }),
        prisma.reservation.findMany({
            where: {
                ...VISIBLE,
                date: { gte: todayStart, lt: todayEnd },
                status: { not: "CANCELLED" },
            },
            select: {
                id: true, date: true, partySize: true, status: true,
                profile: { select: { firstName: true, lastName: true } },
            },
            orderBy: { date: "asc" },
            take: 15,
        }),
        prisma.chatSession.findMany({
            where: { status: { in: ["WAITING", "ACTIVE"] } },
            select: {
                id: true, status: true, sessionKey: true,
                profile: { select: { name: true } },
                messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
            },
            orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
            take: 5,
        }),
    ])

    const liveOrders = liveOrdersRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: (o.profile?.name ?? [o.profile?.firstName, o.profile?.lastName].filter(Boolean).join(" ")) || null,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        fulfillment: o.fulfillment,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
    }))

    const activeCount = liveOrdersRaw.length
    const pendingCount = liveOrdersRaw.filter((o) => o.status === "PENDING").length
    const pickupCount = liveOrdersRaw.filter((o) => o.fulfillment === "PICKUP").length
    const deliveryCount = liveOrdersRaw.filter((o) => o.fulfillment === "DELIVERY").length

    let lateCount = 0
    for (const o of liveOrdersRaw) {
        const ageMs = now.getTime() - o.createdAt.getTime()
        if (o.status === "PREPARING" && ageMs > kitchenMs) lateCount++
        if (o.status === "READY" && ageMs > pickupMs) lateCount++
    }

    let avgPrepMinutes: number | null = null
    if (last20Completed.length > 0) {
        const totalMs = last20Completed.reduce((s, o) => {
            if (!o.paidAt) return s
            return s + (o.updatedAt.getTime() - o.paidAt.getTime())
        }, 0)
        avgPrepMinutes = Math.round(totalMs / last20Completed.length / 60_000)
    }

    return {
        liveOrders,
        activeOrdersCount: activeCount,
        pendingOrdersCount: pendingCount,
        avgPrepMinutes,
        pickupCount,
        deliveryCount,
        lateOrdersCount: lateCount,
        todayReservations: todayResRaw.map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            partySize: r.partySize,
            status: r.status,
            guestName: r.profile ? [r.profile.firstName, r.profile.lastName].filter(Boolean).join(" ") || null : null,
        })),
        waitingChats: waitingChatsRaw.map((c) => ({
            id: c.id,
            status: c.status,
            customerName: c.profile?.name ?? "Anonymous",
            lastMessage: c.messages[0]?.content ?? null,
            isContactForm: c.sessionKey.startsWith("contact-"),
        })),
        kitchenAlertMinutes: settings.kitchenAlertMinutes,
        pickupAlertMinutes: settings.pickupAlertMinutes,
    }
}

// ── Section 2 · Financial ─────────────────────────────────────────

export async function getFinancialData(range: DateRange): Promise<FinancialDTO> {
    const prev = prevRange(range)

    // Revenue + order count for current and previous period
    const [currPen, currUsd, prevPen, prevUsd, paymentMethodsRaw, last30DaysRaw, heatmapRaw] =
        await Promise.all([
            prisma.order.aggregate({
                where: { ...VISIBLE, createdAt: { gte: range.from, lt: range.to }, status: { notIn: [...TERMINAL_STATUSES] }, currency: "PEN" },
                _sum: { total: true }, _count: true,
            }),
            prisma.order.aggregate({
                where: { ...VISIBLE, createdAt: { gte: range.from, lt: range.to }, status: { notIn: [...TERMINAL_STATUSES] }, currency: "USD" },
                _sum: { total: true }, _count: true,
            }),
            prisma.order.aggregate({
                where: { ...VISIBLE, createdAt: { gte: prev.from, lt: prev.to }, status: { notIn: [...TERMINAL_STATUSES] }, currency: "PEN" },
                _sum: { total: true }, _count: true,
            }),
            prisma.order.aggregate({
                where: { ...VISIBLE, createdAt: { gte: prev.from, lt: prev.to }, status: { notIn: [...TERMINAL_STATUSES] }, currency: "USD" },
                _sum: { total: true }, _count: true,
            }),
            // Payment method breakdown
            prisma.order.groupBy({
                by: ["paymentMethod"],
                where: { ...VISIBLE, createdAt: { gte: range.from, lt: range.to }, status: { notIn: [...TERMINAL_STATUSES] } },
                _count: true,
            }),
            // Daily revenue last 30 days (fixed context for line chart)
            prisma.order.findMany({
                where: {
                    ...VISIBLE,
                    createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                    status: { notIn: [...TERMINAL_STATUSES] },
                },
                select: { createdAt: true, total: true, currency: true },
                orderBy: { createdAt: "asc" },
            }),
            // Raw orders for heatmap (last 7 days)
            prisma.order.findMany({
                where: {
                    ...VISIBLE,
                    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    status: { notIn: [...TERMINAL_STATUSES] },
                },
                select: { createdAt: true, total: true, currency: true },
            }),
        ])

    const revPen = Number(currPen._sum.total ?? 0)
    const revUsd = Number(currUsd._sum.total ?? 0)
    const orderCount = currPen._count + currUsd._count
    const prevRevPen = Number(prevPen._sum.total ?? 0)
    const prevRevUsd = Number(prevUsd._sum.total ?? 0)
    const prevOrderCount = prevPen._count + prevUsd._count

    const avgTicketPen = currPen._count > 0 ? revPen / currPen._count : 0
    const avgTicketUsd = currUsd._count > 0 ? revUsd / currUsd._count : 0
    const prevAvgTicketPen = prevPen._count > 0 ? prevRevPen / prevPen._count : 0

    // Build daily revenue map
    const dailyMap = new Map<string, { pen: number; usd: number; count: number }>()
    for (const o of last30DaysRaw) {
        const key = o.createdAt.toISOString().slice(0, 10)
        const existing = dailyMap.get(key) ?? { pen: 0, usd: 0, count: 0 }
        if (o.currency === "PEN") existing.pen += Number(o.total)
        else existing.usd += Number(o.total)
        existing.count++
        dailyMap.set(key, existing)
    }
    const dailyRevenue: DailyRevenue[] = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, revenuePen: v.pen, revenueUsd: v.usd, orderCount: v.count }))

    // Payment method breakdown
    const totalOrders = paymentMethodsRaw.reduce((s, r) => s + r._count, 0)
    const paymentMethods = paymentMethodsRaw.map((r) => ({
        method: r.paymentMethod,
        count: r._count,
        pct: totalOrders > 0 ? Math.round((r._count / totalOrders) * 1000) / 10 : 0,
    }))

    // Hours heatmap — group by day-of-week (Lima TZ) and hour
    const heatMap = new Map<string, number>()
    for (const o of heatmapRaw) {
        const limaDate = new Date(o.createdAt.toLocaleString("en-US", { timeZone: "America/Lima" }))
        const day = (limaDate.getDay() + 6) % 7 // 0=Mon
        const hour = limaDate.getHours()
        const key = `${day}-${hour}`
        heatMap.set(key, (heatMap.get(key) ?? 0) + Number(o.total))
    }
    const hoursHeatmap: HourlyHeatCell[] = Array.from(heatMap.entries()).map(([k, revenue]) => {
        const [day, hour] = k.split("-").map(Number)
        return { day, hour, revenue }
    })

    // Weekday bars
    const weekdayMap = new Map<number, { orders: number; revenue: number }>()
    for (const o of last30DaysRaw) {
        const limaDate = new Date(o.createdAt.toLocaleString("en-US", { timeZone: "America/Lima" }))
        const day = (limaDate.getDay() + 6) % 7
        const existing = weekdayMap.get(day) ?? { orders: 0, revenue: 0 }
        existing.orders++
        existing.revenue += Number(o.total)
        weekdayMap.set(day, existing)
    }
    const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const weekdayBars: WeekdayBar[] = DAY_LABELS.map((day, i) => {
        const v = weekdayMap.get(i) ?? { orders: 0, revenue: 0 }
        return { day, orders: v.orders, revenue: Math.round(v.revenue * 100) / 100 }
    })

    return {
        revenuePen: Math.round(revPen * 100) / 100,
        revenueUsd: Math.round(revUsd * 100) / 100,
        orderCount,
        avgTicketPen: Math.round(avgTicketPen * 100) / 100,
        avgTicketUsd: Math.round(avgTicketUsd * 100) / 100,
        trend: {
            revenuePen: calcTrend(revPen, prevRevPen),
            revenueUsd: calcTrend(revUsd, prevRevUsd),
            orderCount: calcTrend(orderCount, prevOrderCount),
            avgTicketPen: calcTrend(avgTicketPen, prevAvgTicketPen),
        },
        dailyRevenue,
        paymentMethods,
        hoursHeatmap,
        weekdayBars,
    }
}

// ── Section 3 · Products & Customers ─────────────────────────────

export async function getProductsCustomersData(range: DateRange, lowStockThreshold: number): Promise<ProductsCustomersDTO> {
    const [topItemsRaw, allItemsInRange, categoryRaw, topCustomersRaw, newCustomers, returningCustomers, totalInRange, wallets] =
        await Promise.all([
            // Top 10 items by revenue
            prisma.orderItem.groupBy({
                by: ["menuItemId", "nameSnapshot"],
                where: {
                    order: {
                        ...VISIBLE,
                        createdAt: { gte: range.from, lt: range.to },
                        status: { notIn: [...TERMINAL_STATUSES] },
                    },
                },
                _sum: { lineTotal: true, quantity: true },
                orderBy: { _sum: { lineTotal: "desc" } },
                take: 10,
            }),
            // All items in range (for low performer detection)
            prisma.orderItem.groupBy({
                by: ["menuItemId", "nameSnapshot"],
                where: {
                    order: {
                        ...VISIBLE,
                        createdAt: { gte: range.from, lt: range.to },
                        status: { notIn: [...TERMINAL_STATUSES] },
                    },
                },
                _sum: { quantity: true },
                having: { quantity: { _sum: { lt: lowStockThreshold } } },
            }),
            // Category revenue
            prisma.$queryRaw<Array<{ category_id: string; name: string; revenue: number }>>`
                SELECT mc.id as category_id, mc.name, COALESCE(SUM(oi."lineTotal"::numeric), 0)::float as revenue
                FROM "OrderItem" oi
                JOIN "Order" o ON o.id = oi."orderId"
                JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
                JOIN "MenuCategory" mc ON mc.id = mi."categoryId"
                WHERE o."createdAt" >= ${range.from}
                  AND o."createdAt" < ${range.to}
                  AND o.status NOT IN ('CANCELLED', 'REFUNDED')
                  AND o."hiddenByAdmin" = false
                  AND mi."isDraft" = false
                GROUP BY mc.id, mc.name
                ORDER BY revenue DESC
            `,
            // Top 10 customers
            prisma.order.groupBy({
                by: ["profileId"],
                where: {
                    ...VISIBLE,
                    createdAt: { gte: range.from, lt: range.to },
                    status: { notIn: [...TERMINAL_STATUSES] },
                },
                _sum: { total: true },
                _count: true,
                orderBy: { _sum: { total: "desc" } },
                take: 10,
            }),
            // New customers
            prisma.profile.count({
                where: { role: "CUSTOMER", createdAt: { gte: range.from, lt: range.to } },
            }),
            // Returning customers (>1 order in range)
            prisma.order.groupBy({
                by: ["profileId"],
                where: { ...VISIBLE, createdAt: { gte: range.from, lt: range.to }, status: { notIn: [...TERMINAL_STATUSES] } },
                _count: true,
                having: { profileId: { _count: { gt: 1 } } },
            }),
            // Total unique customers with orders in range
            prisma.order.groupBy({
                by: ["profileId"],
                where: { ...VISIBLE, createdAt: { gte: range.from, lt: range.to }, status: { notIn: [...TERMINAL_STATUSES] } },
            }),
            // Wallet circulation
            prisma.wallet.groupBy({
                by: ["currency"],
                where: { isActive: true },
                _sum: { balance: true },
            }),
        ])

    // Enrich top customers with names
    const profileIds = topCustomersRaw.map((r) => r.profileId)
    const profiles = profileIds.length
        ? await prisma.profile.findMany({
              where: { id: { in: profileIds } },
              select: { id: true, name: true, firstName: true, lastName: true },
          })
        : []
    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    const returningPct = totalInRange.length > 0
        ? Math.round((returningCustomers.length / totalInRange.length) * 1000) / 10
        : 0

    return {
        topItems: topItemsRaw.map((r) => ({
            menuItemId: r.menuItemId,
            name: r.nameSnapshot,
            qty: Number(r._sum.quantity ?? 0),
            revenue: Math.round(Number(r._sum.lineTotal ?? 0) * 100) / 100,
            currency: "mixed",
        })),
        lowPerformers: allItemsInRange.map((r) => ({
            menuItemId: r.menuItemId,
            name: r.nameSnapshot,
            qty: Number(r._sum.quantity ?? 0),
        })),
        categoryRevenue: categoryRaw.map((r) => ({
            categoryId: r.category_id,
            name: r.name,
            revenue: Math.round(r.revenue * 100) / 100,
        })),
        topCustomers: topCustomersRaw.map((r) => {
            const p = profileMap.get(r.profileId)
            return {
                profileId: r.profileId,
                name: (p?.name ?? [p?.firstName, p?.lastName].filter(Boolean).join(" ")) || null,
                orderCount: r._count,
                totalSpend: Math.round(Number(r._sum.total ?? 0) * 100) / 100,
                currency: "mixed",
            }
        }),
        newCustomers,
        returningPct,
        walletCirculation: wallets.map((w) => ({
            currency: w.currency,
            totalBalance: Math.round(Number(w._sum.balance ?? 0) * 100) / 100,
        })),
        lowStockThreshold,
    }
}

// ── Section 4 · Operational Health ───────────────────────────────

export async function getHealthData(range: DateRange, etaToleranceMinutes: number): Promise<HealthDTO> {
    const [allOrders, deliveryOrders, openTickets, recentReviews] = await Promise.all([
        prisma.order.findMany({
            where: { ...VISIBLE, createdAt: { gte: range.from, lt: range.to } },
            select: { status: true, createdAt: true, updatedAt: true, paidAt: true },
        }),
        prisma.order.findMany({
            where: {
                ...VISIBLE,
                createdAt: { gte: range.from, lt: range.to },
                fulfillment: "DELIVERY",
                status: "COMPLETED",
                estimatedReadyAt: { not: null },
            },
            select: { estimatedReadyAt: true, updatedAt: true },
        }),
        prisma.ticket.groupBy({
            by: ["priority"],
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
            _count: true,
        }),
        prisma.review.findMany({
            where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            select: { id: true, rating: true, comment: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 3,
        }),
    ])

    const total = allOrders.length
    const cancelled = allOrders.filter((o) => o.status === "CANCELLED").length
    const refunded = allOrders.filter((o) => o.status === "REFUNDED").length
    const completed = allOrders.filter((o) => o.status === "COMPLETED")

    const cancelRate = total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0
    const refundRate = total > 0 ? Math.round((refunded / total) * 1000) / 10 : 0

    let avgCompletionMinutes: number | null = null
    if (completed.length > 0) {
        const totalMs = completed.reduce((s, o) => {
            const start = o.paidAt ?? o.createdAt
            return s + (o.updatedAt.getTime() - start.getTime())
        }, 0)
        avgCompletionMinutes = Math.round(totalMs / completed.length / 60_000)
    }

    let etaHitRate: number | null = null
    if (deliveryOrders.length > 0) {
        const toleranceMs = etaToleranceMinutes * 60_000
        const hits = deliveryOrders.filter((o) => {
            if (!o.estimatedReadyAt) return false
            return o.updatedAt.getTime() <= o.estimatedReadyAt.getTime() + toleranceMs
        })
        etaHitRate = Math.round((hits.length / deliveryOrders.length) * 1000) / 10
    }

    // Reviews avg
    const allRatings = recentReviews.map((r) => r.rating)
    const reviewsAvg = allRatings.length > 0
        ? Math.round((allRatings.reduce((s, v) => s + v, 0) / allRatings.length) * 10) / 10
        : null

    // System alerts
    const systemAlerts: HealthDTO["systemAlerts"] = []
    if (cancelRate > 10) systemAlerts.push({ type: "LOW_REVIEW", message: `High cancel rate: ${cancelRate}%` })
    if (reviewsAvg !== null && reviewsAvg < 3) {
        systemAlerts.push({ type: "LOW_REVIEW", message: `Low average rating: ${reviewsAvg}/5`, href: "/reviews" })
    }
    const urgentTickets = openTickets.find((t) => t.priority === "URGENT" || t.priority === "HIGH")
    if (urgentTickets && urgentTickets._count > 0) {
        systemAlerts.push({ type: "HIGH_TICKET", message: `${urgentTickets._count} high-priority open tickets`, href: "/tickets" })
    }

    return {
        cancelRate,
        refundRate,
        avgCompletionMinutes,
        etaHitRate,
        openTickets: openTickets.map((t) => ({ priority: t.priority, count: t._count })),
        reviewsAvg,
        recentReviews: recentReviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt.toISOString(),
        })),
        systemAlerts,
        etaToleranceMinutes,
    }
}
