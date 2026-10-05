import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import type { Prisma } from "@wildgrove/db"
import { cmsPanelPath } from "@wildgrove/core/urls"

function presentHref(href: string | null): string | null {
  return href ? cmsPanelPath(href) : null
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

// All valid AdminNotificationType values
const VALID_TYPES = new Set([
  "CUSTOMER_CREATED",
  "RESERVATION_CREATED",
  "RESERVATION_CANCELLED",
  "RESERVATION_RESCHEDULED",
  "RESERVATION_CHANGE_REQUESTED",
  "PROFILE_UPDATED",
  "CHAT_SESSION_CREATED",
  "CHAT_MESSAGE_RECEIVED",
  "CHAT_ESCALATED",
  "TICKET_CREATED",
  "TICKET_REPLY_RECEIVED",
])

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limitParam = Number(searchParams.get("limit") || DEFAULT_LIMIT)
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, MAX_LIMIT))
      : DEFAULT_LIMIT

    // ── Cursor-based mode (used by the bell dropdown) ────────────────
    if (cursor !== null) {
      const notifications = await prisma.adminNotification.findMany({
        where: { adminId: auth.userId },
        select: {
          id: true,
          type: true,
          entityType: true,
          entityId: true,
          title: true,
          message: true,
          href: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: { id: cursor },
        skip: 1,
      })

      const unreadCount = await prisma.adminNotification.count({
        where: { adminId: auth.userId, isRead: false },
      })

      const hasMore = notifications.length > limit
      const sliced = hasMore ? notifications.slice(0, limit) : notifications
      const items = sliced.map((item) => ({ ...item, href: presentHref(item.href) }))
      const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

      return NextResponse.json({
        success: true,
        data: { items, unreadCount, nextCursor, currentUserId: auth.userId },
      })
    }

    // ── First load (no cursor) — could be bell or page ───────────────
    // Bell: no extra params beyond limit
    // Page: may send filter, type, search, page
    const filterParam = searchParams.get("filter") // "all" | "read" | "unread"
    const typeParam = searchParams.get("type")     // comma-separated enum values
    const searchParam = searchParams.get("search")
    const pageParam = Math.max(1, Number(searchParams.get("page") || 1))

    const isPageMode =
      filterParam !== null ||
      typeParam !== null ||
      searchParam !== null ||
      searchParams.has("page")

    // ── Bell first-load (no filter params) ──────────────────────────
    if (!isPageMode) {
      const notifications = await prisma.adminNotification.findMany({
        where: { adminId: auth.userId },
        select: {
          id: true,
          type: true,
          entityType: true,
          entityId: true,
          title: true,
          message: true,
          href: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      })

      const unreadCount = await prisma.adminNotification.count({
        where: { adminId: auth.userId, isRead: false },
      })

      const hasMore = notifications.length > limit
      const sliced = hasMore ? notifications.slice(0, limit) : notifications
      const items = sliced.map((item) => ({ ...item, href: presentHref(item.href) }))
      const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

      return NextResponse.json({
        success: true,
        data: { items, unreadCount, nextCursor, currentUserId: auth.userId },
      })
    }

    // ── Page mode (offset-based with filters) ────────────────────────
    const where: Prisma.AdminNotificationWhereInput = {
      adminId: auth.userId,
    }

    if (filterParam === "read") where.isRead = true
    if (filterParam === "unread") where.isRead = false

    if (typeParam) {
      const types = typeParam
        .split(",")
        .map((t) => t.trim())
        .filter((t) => VALID_TYPES.has(t))
      if (types.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where.type = { in: types as any }
      }
    }

    if (searchParam) {
      where.OR = [
        { title: { contains: searchParam, mode: "insensitive" } },
        { message: { contains: searchParam, mode: "insensitive" } },
      ]
    }

    const [rawItems, totalCount, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        select: {
          id: true,
          type: true,
          entityType: true,
          entityId: true,
          title: true,
          message: true,
          href: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (pageParam - 1) * limit,
        take: limit,
      }),
      prisma.adminNotification.count({ where }),
      prisma.adminNotification.count({
        where: { adminId: auth.userId, isRead: false },
      }),
    ])

    const items = rawItems.map((item) => ({ ...item, href: presentHref(item.href) }))

    return NextResponse.json({
      success: true,
      data: {
        items,
        unreadCount,
        totalCount,
        nextCursor: null,
        currentUserId: auth.userId,
        pagination: {
          page: pageParam,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    })
  } catch (error) {
    console.error("[admin/notifications] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications." },
      { status: 500 }
    )
  }
}
