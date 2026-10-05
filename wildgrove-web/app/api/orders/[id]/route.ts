// ══════════════════════════════════════════════════════════════════
// GET /api/orders/[id] — full order detail for authenticated user
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { OrderService } from "@wildgrove/core/orders/OrderService"

export async function GET(
  _request: Request,
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
    const order = await OrderService.getOrderDetail(id, user.id)

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        subtotal: order.subtotal.toFixed(2),
        discountTotal: order.discountTotal.toFixed(2),
        deliveryFee: order.deliveryFee.toFixed(2),
        total: order.total.toFixed(2),
        items: order.items.map((i) => ({
          ...i,
          unitPrice: i.unitPrice.toFixed(2),
          lineTotal: i.lineTotal.toFixed(2),
        })),
        appliedDiscounts: order.appliedDiscounts.map((d) => ({
          ...d,
          amount: d.amount.toFixed(2),
        })),
      },
    })
  } catch (error) {
    console.error("[orders/[id] GET]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
