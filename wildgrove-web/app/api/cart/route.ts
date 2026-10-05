// ══════════════════════════════════════════════════════════════════
// GET   /api/cart          — returns the authenticated user's cart
// POST  /api/cart          — adds an item to the authenticated user's cart
// PATCH /api/cart          — updates the cart's active currency
//
// While dual currency is off, the cart is always in the store currency: GET
// and POST move a cart kept in the other one, and PATCH refuses it.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { CartService } from "@wildgrove/core/cart/CartService"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"
import { displayCartUnitPrices, getDiscountForItem } from "@wildgrove/core/menu-discounts"
import { readCheckoutSwitches } from "@wildgrove/core/settings"
import type { ApiResponse } from "@wildgrove/core/types"

const addItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  // nullish() = string | null | undefined — JSON.stringify sends null for optional notes
  notes: z.string().max(140).nullish(),
  currency: z.enum(["PEN", "USD"]),
})

export async function GET() {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      const response: ApiResponse = { success: false, error: "Authentication required" }
      return NextResponse.json(response, { status: 401 })
    }

    const [found, { storeCurrency }] = await Promise.all([
      CartService.getCart(user.id),
      readCheckoutSwitches(),
    ])

    if (!found) {
      return NextResponse.json({ success: true, data: null })
    }

    let cart = found
    if (storeCurrency && cart.currency !== storeCurrency) {
      await CartService.changeCurrency(user.id, storeCurrency)
      cart = { ...cart, currency: storeCurrency }
    }

    const discounts = await loadActiveAutomaticDiscounts()

    const items = cart.items.map((item) => {
      const prices = item.menuItem.prices as Record<string, number>
      const discount = getDiscountForItem(
        { id: item.menuItemId, categoryId: item.menuItem.categoryId },
        discounts,
      )
      const listUnitPricePEN = prices.PEN ?? 0
      const listUnitPriceUSD = prices.USD ?? 0
      const { unitPricePEN, unitPriceUSD } = displayCartUnitPrices(prices, discount)
      return {
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem.name,
        nameEs: item.menuItem.nameEs ?? null,
        imageUrl: item.menuItem.imageUrl ?? null,
        quantity: item.quantity,
        listUnitPricePEN,
        listUnitPriceUSD,
        unitPricePEN,
        unitPriceUSD,
        notes: item.notes ?? null,
        available: item.menuItem.available,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        currency: cart.currency,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        items,
      },
    })
  } catch (error) {
    console.error("[cart GET]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = z.object({ currency: z.enum(["PEN", "USD"]) }).safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid currency" }, { status: 400 })
    }

    const { storeCurrency } = await readCheckoutSwitches()
    if (storeCurrency && parsed.data.currency !== storeCurrency) {
      return NextResponse.json(
        { success: false, error: "This currency is not available", code: "CURRENCY_UNAVAILABLE" },
        { status: 422 },
      )
    }

    await CartService.changeCurrency(user.id, parsed.data.currency)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[cart PATCH]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

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
    const parsed = addItemSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      )
    }

    const { menuItemId, quantity, notes } = parsed.data
    const { storeCurrency } = await readCheckoutSwitches()
    const currency = storeCurrency ?? parsed.data.currency
    if (storeCurrency) await CartService.changeCurrency(user.id, storeCurrency)

    await CartService.addItem(user.id, { menuItemId, quantity, notes }, currency)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("[cart POST]", error)
    if (error instanceof Error && error.message === "This item is currently unavailable") {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
