// ══════════════════════════════════════════════════════════════════
// PATCH  /api/cart/items/[id]  — update item quantity (0 = remove)
// DELETE /api/cart/items/[id]  — remove item from cart
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { CartService } from "@wildgrove/core/cart/CartService"

const updateSchema = z.object({
  quantity: z.number().int().min(0).max(20),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 })
    }

    await CartService.updateQuantity(id, user.id, parsed.data.quantity)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[cart/items PATCH]", error)
    if (error instanceof Error && error.message === "Cart item not found") {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { id } = await params
    await CartService.removeItem(id, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[cart/items DELETE]", error)
    if (error instanceof Error && error.message === "Cart item not found") {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
