// ══════════════════════════════════════════════════════════════════
// The answer an order route gives when the order service refuses.
// Same shape as the storefront's cancellation: an order that is not there
// is a 404, any other domain refusal is a 422 carrying its `code`. Anything
// else is a 500 with the route's own message, never the database's text.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { Prisma } from "@wildgrove/db"
import { OrderError } from "@wildgrove/core/orders/OrderService"

export function orderErrorResponse(error: unknown, fallback: string): NextResponse {
    if (error instanceof OrderError) {
        const status = error.code === "NOT_FOUND" ? 404 : 422
        return NextResponse.json(
            { success: false, error: error.message, code: error.code },
            { status },
        )
    }

    // `findUniqueOrThrow` and `update` on an id that does not exist.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return NextResponse.json(
            { success: false, error: "Order not found", code: "NOT_FOUND" },
            { status: 404 },
        )
    }

    return NextResponse.json({ success: false, error: fallback }, { status: 500 })
}
