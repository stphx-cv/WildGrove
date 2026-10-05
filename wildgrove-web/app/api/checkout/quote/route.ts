// ══════════════════════════════════════════════════════════════════
// POST /api/checkout/quote
// Calculates order totals (with delivery zone + discounts) without
// charging — used for the checkout preview / review step.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { CartService } from "@wildgrove/core/cart/CartService"
import { ZoneResolver, ZoneNotFoundError, MinOrderNotMetError } from "@wildgrove/core/delivery/ZoneResolver"
import { prisma } from "@wildgrove/db"
import { Prisma } from "@wildgrove/db"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"
import { readCheckoutSwitches } from "@wildgrove/core/settings"

const quoteSchema = z.object({
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  addressId: z.string().optional(),
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
    const parsed = quoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      )
    }

    const { fulfillment, addressId } = parsed.data

    const switches = await readCheckoutSwitches()
    const fulfillmentOn = fulfillment === "PICKUP" ? switches.pickupEnabled : switches.deliveryEnabled
    if (!fulfillmentOn) {
      return NextResponse.json(
        { success: false, error: "This fulfillment method is not available", code: "FULFILLMENT_DISABLED" },
        { status: 422 },
      )
    }

    // A cart kept in the other currency moves to the store's before it is priced.
    if (switches.storeCurrency) await CartService.changeCurrency(user.id, switches.storeCurrency)

    const activeDiscounts = await loadActiveAutomaticDiscounts({ fresh: true })

    const pricedCart = await CartService.priceCart(user.id, {
      discounts: activeDiscounts,
    })

    if (!pricedCart || pricedCart.items.length === 0) {
      return NextResponse.json({ success: false, error: "Your cart is empty" }, { status: 400 })
    }

    let deliveryFee = new Prisma.Decimal(0)
    let zoneInfo: { id: string; name: string; estimatedMinutes: number } | null = null
    let zoneError: string | null = null

    if (fulfillment === "DELIVERY") {
      if (!addressId) {
        return NextResponse.json(
          { success: false, error: "Delivery address is required" },
          { status: 400 },
        )
      }

      const address = await prisma.userAddress.findFirst({
        where: { id: addressId, profileId: user.id },
        select: {
          lat: true,
          lng: true,
          district: true,
          province: true,
          region: true,
          country: true,
        },
      })

      if (!address) {
        return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 })
      }

      try {
        const zone = await ZoneResolver.resolveZone({
          lat: address.lat ? Number(address.lat) : null,
          lng: address.lng ? Number(address.lng) : null,
          components: {
            district: address.district,
            province: address.province,
            region: address.region,
            country: address.country,
          },
        })

        // The fee is known once the zone is: the review shows it and the
        // total includes it even while the order is still under the minimum.
        deliveryFee = ZoneResolver.getFee(zone, pricedCart.currency)
        zoneInfo = { id: zone.id, name: zone.name, estimatedMinutes: zone.estimatedMinutes }

        ZoneResolver.validateMinOrder(zone, pricedCart.currency, pricedCart.discountedSubtotal)
      } catch (e) {
        if (e instanceof ZoneNotFoundError) {
          zoneError = "no_zone"
        } else if (e instanceof MinOrderNotMetError) {
          zoneError = "min_order"
        } else {
          throw e
        }
      }
    }

    const total = pricedCart.discountedSubtotal.add(deliveryFee)

    // Check wallet balance
    const cart = await prisma.cart.findUnique({
      where: { profileId: user.id },
      select: { currency: true },
    })
    const currency = cart?.currency ?? "PEN"

    const wallet = await prisma.wallet.findUnique({
      where: { profileId_currency: { profileId: user.id, currency } },
      select: { balance: true },
    })

    const walletBalance = wallet?.balance ?? new Prisma.Decimal(0)
    const hasSufficientFunds = walletBalance.gte(total)

    return NextResponse.json({
      success: true,
      data: {
        currency,
        subtotal: pricedCart.subtotal.toFixed(2),
        discountTotal: pricedCart.discountTotal.toFixed(2),
        discountedSubtotal: pricedCart.discountedSubtotal.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
        itemCount: pricedCart.itemCount,
        items: pricedCart.items.map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          name: i.name,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toFixed(2),
          effectiveUnitPrice: i.effectiveUnitPrice.toFixed(2),
          lineTotal: i.lineTotal.toFixed(2),
          notes: i.notes,
        })),
        zone: zoneInfo,
        zoneError,
        walletBalance: walletBalance.toFixed(2),
        hasSufficientFunds,
      },
    })
  } catch (error) {
    console.error("[checkout/quote POST]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
