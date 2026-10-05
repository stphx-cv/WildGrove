// ══════════════════════════════════════════════════════════════════
// Dashboard DTOs — typed contracts between server queries and client
// ══════════════════════════════════════════════════════════════════

export type DateRange = { from: Date; to: Date }

/** % change vs previous equivalent period */
export type Trend = {
    value: number   // e.g. 12.5 means +12.5%
    prev: number    // previous period raw value for tooltip
}

// ── Section 1 · Operations ────────────────────────────────────────

export type LiveOrder = {
    id: string
    orderNumber: number
    customerName: string | null
    itemCount: number
    fulfillment: string
    status: string
    createdAt: string      // ISO
    paidAt: string | null  // ISO
}

export type TodayReservation = {
    id: string
    date: string // ISO
    partySize: number
    status: string
    guestName: string | null
}

export type WaitingChat = {
    id: string
    status: string
    customerName: string
    lastMessage: string | null
    isContactForm: boolean
}

export type OperationsDTO = {
    liveOrders: LiveOrder[]
    activeOrdersCount: number
    pendingOrdersCount: number
    avgPrepMinutes: number | null   // rolling avg of last 20 visible completed today
    pickupCount: number
    deliveryCount: number
    lateOrdersCount: number
    todayReservations: TodayReservation[]
    waitingChats: WaitingChat[]
    kitchenAlertMinutes: number
    pickupAlertMinutes: number
}

// ── Section 2 · Financial ─────────────────────────────────────────

export type DailyRevenue = {
    date: string     // "YYYY-MM-DD"
    revenuePen: number
    revenueUsd: number
    orderCount: number
}

export type PaymentMethodBreakdown = {
    method: string
    count: number
    pct: number
}

export type HourlyHeatCell = {
    day: number    // 0=Mon … 6=Sun
    hour: number   // 0–23
    revenue: number
}

export type WeekdayBar = {
    day: string    // "Mon" | "Tue" | … | "Sun"
    orders: number
    revenue: number
}

export type FinancialDTO = {
    revenuePen: number
    revenueUsd: number
    orderCount: number
    avgTicketPen: number
    avgTicketUsd: number
    trend: {
        revenuePen: Trend
        revenueUsd: Trend
        orderCount: Trend
        avgTicketPen: Trend
    }
    // Charts
    dailyRevenue: DailyRevenue[]          // last 30 days fixed context
    paymentMethods: PaymentMethodBreakdown[]
    hoursHeatmap: HourlyHeatCell[]        // last 7 days
    weekdayBars: WeekdayBar[]
}

// ── Section 3 · Products & Customers ─────────────────────────────

export type TopMenuItem = {
    menuItemId: string
    name: string
    qty: number
    revenue: number
    currency: string
}

export type LowPerformer = {
    menuItemId: string
    name: string
    qty: number
}

export type CategoryRevenue = {
    categoryId: string
    name: string
    revenue: number
}

export type TopCustomer = {
    profileId: string
    name: string | null
    orderCount: number
    totalSpend: number
    currency: string
}

export type WalletCirculation = {
    currency: string
    totalBalance: number
}

export type ProductsCustomersDTO = {
    topItems: TopMenuItem[]
    lowPerformers: LowPerformer[]
    categoryRevenue: CategoryRevenue[]
    topCustomers: TopCustomer[]
    newCustomers: number
    returningPct: number      // 0–100
    walletCirculation: WalletCirculation[]
    lowStockThreshold: number
}

// ── Section 4 · Operational Health ───────────────────────────────

export type OpenTicketsByPriority = {
    priority: string
    count: number
}

export type RecentReview = {
    id: string
    rating: number
    comment: string
    createdAt: string
}

export type SystemAlert = {
    type: "LATE_ORDER" | "LOW_REVIEW" | "HIGH_TICKET" | "LOW_PERFORMER"
    message: string
    href?: string
}

export type HealthDTO = {
    cancelRate: number     // 0–100
    refundRate: number
    avgCompletionMinutes: number | null
    etaHitRate: number | null  // 0–100, delivery only
    openTickets: OpenTicketsByPriority[]
    reviewsAvg: number | null
    recentReviews: RecentReview[]
    systemAlerts: SystemAlert[]
    etaToleranceMinutes: number
}
