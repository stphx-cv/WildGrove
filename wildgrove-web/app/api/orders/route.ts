// ══════════════════════════════════════════════════════════════════
// GET /api/orders — paginated order history for authenticated user
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { OrderService } from "@wildgrove/core/orders/OrderService"

export async function GET(request: Request) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)))

    const { orders, total } = await OrderService.getUserOrders(user.id, { page, perPage })

    return NextResponse.json({
      success: true,
      data: {
        orders: orders.map((o) => ({
          ...o,
          total: o.total.toFixed(2),
        })),
        total,
        page,
        perPage,
      },
    })
  } catch (error) {
    console.error("[orders GET]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
