// ══════════════════════════════════════════════════════════════════
// Admin Reactivate Order — POST /api/orders/[id]/reactivate
// Re-charges the customer's wallet and sets a REFUNDED order back to PENDING.
// Returns 402 with balance details if the wallet has insufficient funds,
// so the UI can guide the OWNER to top up before retrying.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { orderErrorResponse } from "@/lib/order-error-response"
import { OrderService, WalletInsufficientFundsError } from "@wildgrove/core/orders/OrderService"
import { prisma } from "@wildgrove/db"

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        await OrderService.reactivate(id, auth.userId)

        const updated = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                cancelReason: true,
                paidAt: true,
                events: {
                    select: { id: true, type: true, message: true, actorId: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                },
            },
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        if (error instanceof WalletInsufficientFundsError) {
            return NextResponse.json({
                success: false,
                error: "INSUFFICIENT_BALANCE",
                details: {
                    available: error.available.toFixed(2),
                    required: error.required.toFixed(2),
                    currency: error.currency,
                },
            }, { status: 402 })
        }

        console.error("[admin/orders/[id]/reactivate POST]", error)
        return orderErrorResponse(error, "Failed to reactivate order")
    }
}
