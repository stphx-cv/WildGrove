// ══════════════════════════════════════════════════════════════════
// Admin Cancel Order — POST /api/orders/[id]/cancel
// Cancels the order and automatically refunds the wallet if paid.
// Available to both ADMIN and OWNER.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { orderErrorResponse } from "@/lib/order-error-response"
import { cancelOrderSchema } from "@wildgrove/core/admin-validation"
import { OrderService } from "@wildgrove/core/orders/OrderService"

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
        const parsed = cancelOrderSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            )
        }

        const result = await OrderService.cancel(id, parsed.data.reason, auth.userId)
        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        console.error("[admin/orders/[id]/cancel POST]", error)
        return orderErrorResponse(error, "Failed to cancel order")
    }
}
