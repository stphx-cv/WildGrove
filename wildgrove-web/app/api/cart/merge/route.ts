// ══════════════════════════════════════════════════════════════════
// POST /api/cart/merge
// Called on login: merges the guest localStorage cart into the
// authenticated user's server cart. Existing items are incremented,
// new items are added. Silent errors on unavailable items are OK.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { CartService } from "@wildgrove/core/cart/CartService"

const guestItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  notes: z.string().max(140).nullish(),
})

const mergeSchema = z.object({
  items: z.array(guestItemSchema).max(50),
  currency: z.enum(["PEN", "USD"]),
})

export async function POST(request: Request) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = mergeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 })
    }

    const { items, currency } = parsed.data
    await CartService.mergeGuestCart(items, user.id, currency)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[cart/merge POST]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
