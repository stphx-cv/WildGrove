// ══════════════════════════════════════════════════════════════════
// GET /api/tickets — List all tickets (admin only)
// Supports filters: status, category, priority, search, pagination
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { formatTicketNumber } from "@wildgrove/core/tickets"
import type { Prisma } from "@wildgrove/db"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const url = new URL(request.url)
        const status = url.searchParams.get("status")
        const category = url.searchParams.get("category")
        const priority = url.searchParams.get("priority")
        const search = url.searchParams.get("search")
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")))
        const skip = (page - 1) * limit

        // Build where clause
        const where: Prisma.TicketWhereInput = {}

        if (status) {
            const statuses = status.split(",").filter(Boolean)
            if (statuses.length > 0) {
                where.status = { in: statuses as ("OPEN" | "IN_PROGRESS" | "AWAITING_REPLY" | "RESOLVED" | "CLOSED")[] }
            }
        }

        if (category) {
            where.category = category as Prisma.TicketWhereInput["category"]
        }

        if (priority) {
            where.priority = priority as Prisma.TicketWhereInput["priority"]
        }

        if (search) {
            where.OR = [
                { subject: { contains: search, mode: "insensitive" } },
                { profile: { name: { contains: search, mode: "insensitive" } } },
                { profile: { email: { contains: search, mode: "insensitive" } } },
                // Search by ticket number
                ...(search.startsWith("#WG-") || /^\d+$/.test(search)
                    ? [{ ticketNumber: parseInt(search.replace("#WG-", "").replace(/^0+/, "")) || -1 }]
                    : []),
            ]
        }

        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                orderBy: [
                    // OPEN and IN_PROGRESS first
                    { status: "asc" },
                    { updatedAt: "desc" },
                ],
                skip,
                take: limit,
                include: {
                    profile: {
                        select: { name: true, email: true, avatarUrl: true },
                    },
                    _count: { select: { messages: true } },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        where: { isInternal: false },
                        select: { content: true, createdAt: true, senderRole: true },
                    },
                },
            }),
            prisma.ticket.count({ where }),
        ])

        const data = tickets.map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            formattedNumber: formatTicketNumber(t.ticketNumber),
            category: t.category,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            assignedAdminId: t.assignedAdminId,
            customerName: t.profile?.name || "Unknown",
            customerEmail: t.profile?.email || null,
            customerAvatar: t.profile?.avatarUrl || null,
            messageCount: t._count.messages,
            lastMessage: t.messages[0]?.content?.slice(0, 120) ?? null,
            lastMessageRole: t.messages[0]?.senderRole ?? null,
            lastMessageAt: t.messages[0]?.createdAt?.toISOString() ?? t.updatedAt.toISOString(),
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
        }))

        return NextResponse.json({
            success: true,
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            callerRole: auth.role,
        })
    } catch (error) {
        console.error("[admin/tickets] List failed:", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        )
    }
}
