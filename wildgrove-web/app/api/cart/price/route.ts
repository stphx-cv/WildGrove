// ══════════════════════════════════════════════════════════════════
// POST /api/cart/price
// Calculates cart totals with automatic discounts applied.
// Returns a PricedCart (subtotal, discountTotal, items with
// effectiveUnitPrice).
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { CartService } from "@wildgrove/core/cart/CartService"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"

export async function POST() {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const activeDiscounts = await loadActiveAutomaticDiscounts()

    const pricedCart = await CartService.priceCart(user.id, {
      discounts: activeDiscounts,
    })

    if (!pricedCart) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({
      success: true,
      data: {
        cartId: pricedCart.cartId,
        currency: pricedCart.currency,
        subtotal: pricedCart.subtotal.toString(),
        discountTotal: pricedCart.discountTotal.toString(),
        discountedSubtotal: pricedCart.discountedSubtotal.toString(),
        itemCount: pricedCart.itemCount,
        items: pricedCart.items.map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          name: i.name,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toString(),
          effectiveUnitPrice: i.effectiveUnitPrice.toString(),
          lineTotal: i.lineTotal.toString(),
          notes: i.notes,
        })),
      },
    })
  } catch (error) {
    console.error("[cart/price POST]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
