// ══════════════════════════════════════════════════════════════════
// POST /api/orders/[id]/cancel — user self-cancellation
// Only allowed for PENDING or PREPARING orders.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { OrderService, OrderError } from "@wildgrove/core/orders/OrderService"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"

const cancelSchema = z.object({
  reason: z.string().min(1).max(280).default("Cancelled by customer"),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = cancelSchema.safeParse(body)
    const reason = parsed.success ? parsed.data.reason : "Cancelled by customer"

    const result = await OrderService.cancel(id, reason, user.id, { byUser: true })

    createAdminNotificationForAllAdmins({
      type: "ORDER_CANCELLED",
      entityType: "ORDER",
      entityId: id,
      title: `Order #${result.orderNumber} cancelled`,
      message: `Customer cancelled order #${result.orderNumber}: ${reason}`,
      href: `/orders/${id}`,
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { status: result.status } })
  } catch (error) {
    if (error instanceof OrderError) {
      // An order this customer does not own answers like one that is not there.
      const status = error.code === "NOT_FOUND" ? 404 : 422
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status },
      )
    }
    console.error("[orders/[id]/cancel POST]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
