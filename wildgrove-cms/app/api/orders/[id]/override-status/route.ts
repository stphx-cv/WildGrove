// ══════════════════════════════════════════════════════════════════
// Admin Override Order Status — POST /api/orders/[id]/override-status
// Forces an order to any valid status, bypassing the state machine.
// REFUNDED is rejected (system-only state).
// CANCELLED + paidAt → delegates to cancel() for automatic refund.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { orderErrorResponse } from "@/lib/order-error-response"
import { adminOverrideStatusSchema } from "@wildgrove/core/admin-validation"
import { OrderService } from "@wildgrove/core/orders/OrderService"
import { OrderStatus } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const parsed = adminOverrideStatusSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            )
        }

        await OrderService.adminOverride(id, parsed.data.status as OrderStatus, auth.userId, parsed.data.reason)

        const updated = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                cancelReason: true,
                events: {
                    select: { id: true, type: true, message: true, actorId: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                },
            },
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        console.error("[admin/orders/[id]/override-status POST]", error)
        return orderErrorResponse(error, "Failed to override order status")
    }
}
