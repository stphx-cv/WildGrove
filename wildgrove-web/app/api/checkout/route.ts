// ══════════════════════════════════════════════════════════════════
// POST /api/checkout
// Creates an order and charges the user's wallet.
// Requires idempotencyKey to prevent double-charge on retry.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@wildgrove/core/clients/server"
import { OrderService, OrderError } from "@wildgrove/core/orders/OrderService"
import { WalletService, WalletInsufficientFundsError } from "@wildgrove/core/wallet/WalletService"
import { ZoneNotFoundError, MinOrderNotMetError } from "@wildgrove/core/delivery/ZoneResolver"
import { prisma } from "@wildgrove/db"
import {
  orderConfirmationHtml,
  orderAdminNewHtml,
  sendOrderEmail,
  getAdminEmail,
} from "@wildgrove/core/email"
import { generateOrderPdfBuffer } from "@wildgrove/core/pdf/generateOrderPdf"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"
import { readCheckoutSwitches } from "@wildgrove/core/settings"

const boletaSchema = z.object({
  documentType: z.literal("BOLETA"),
  buyerDni: z.string().max(8).optional(),
})

const facturaSchema = z.object({
  documentType: z.literal("FACTURA"),
  fiscalRuc: z.string().length(11, "RUC must be 11 digits"),
  fiscalLegalName: z.string().min(2).max(200),
  fiscalAddress: z.string().max(255).optional(),
})

function checkoutBody(order: { id: string; orderNumber: number; total: { toFixed(digits: number): string }; currency: string }) {
  return {
    success: true as const,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total.toFixed(2),
      currency: order.currency,
    },
  }
}

/**
 * A key already stored on a purchase of this customer points at that order.
 * Any other stored key is a conflict and carries no order data back.
 */
async function existingOrderForKey(profileId: string, idempotencyKey: string) {
  const row = await WalletService.findByIdempotencyKey(idempotencyKey)
  if (!row) return null
  if (row.type !== "PURCHASE" || !row.reference || row.wallet.profileId !== profileId) {
    return { conflict: true as const }
  }
  const order = await prisma.order.findFirst({
    where: { id: row.reference, profileId },
    select: { id: true, orderNumber: true, total: true, currency: true },
  })
  if (!order) return { conflict: true as const }
  return { conflict: false as const, order }
}

const billingSchema = z.discriminatedUnion("documentType", [boletaSchema, facturaSchema])

const checkoutSchema = z.object({
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  idempotencyKey: z.string().uuid(),
  paymentMethod: z.enum(["WALLET"]),
  scheduledFor: z.string().datetime().optional(),
  addressId: z.string().optional(),
  customerPhone: z.string().max(20).optional(),
  customerName: z.string().max(100).optional(),
  notes: z.string().max(280).optional(),
  locale: z.enum(["en", "es"]).default("en"),
  billing: billingSchema.default({ documentType: "BOLETA" }),
})

export async function POST(request: Request) {
  let profileId: string | undefined
  let idempotencyKey: string | undefined
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      )
    }

    const {
      fulfillment,
      idempotencyKey: parsedKey,
      paymentMethod,
      scheduledFor,
      addressId,
      customerPhone,
      customerName,
      notes,
      locale,
      billing,
    } = parsed.data
    profileId = user.id
    idempotencyKey = parsedKey

    const already = await existingOrderForKey(profileId, idempotencyKey)
    if (already?.conflict) {
      return NextResponse.json(
        { success: false, error: "Idempotency key already used", code: "IDEMPOTENCY_CONFLICT" },
        { status: 409 },
      )
    }
    if (already?.order) {
      return NextResponse.json(checkoutBody(already.order), { status: 200 })
    }

    // What the owner switched off in the panel is refused here, not only hidden
    // on the checkout page.
    const switches = await readCheckoutSwitches()
    const fulfillmentOn = fulfillment === "PICKUP" ? switches.pickupEnabled : switches.deliveryEnabled
    if (!fulfillmentOn) {
      return NextResponse.json(
        { success: false, error: "This fulfillment method is not available", code: "FULFILLMENT_DISABLED" },
        { status: 422 },
      )
    }
    if (paymentMethod === "WALLET" && !switches.walletEnabled) {
      return NextResponse.json(
        { success: false, error: "Wallet payments are not available", code: "PAYMENT_METHOD_DISABLED" },
        { status: 422 },
      )
    }
    // With both documents off the order is placed without one, whatever
    // `billing` says. With one on, the other is refused.
    const documentsOn = switches.boletaEnabled || switches.facturaEnabled
    const documentTypeOn = billing.documentType === "BOLETA" ? switches.boletaEnabled : switches.facturaEnabled
    if (documentsOn && !documentTypeOn) {
      return NextResponse.json(
        { success: false, error: "This billing document is not available", code: "DOCUMENT_TYPE_DISABLED" },
        { status: 422 },
      )
    }

    // Get cart currency + user profile email
    const [cart, profile] = await Promise.all([
      prisma.cart.findUnique({
        where: { profileId: user.id },
        select: { currency: true },
      }),
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { email: true, firstName: true, lastName: true },
      }),
    ])
    if (!cart) {
      return NextResponse.json({ success: false, error: "Your cart is empty" }, { status: 400 })
    }
    // The cart moves to the store currency when it is read or quoted. One still
    // in the other currency was not reviewed in it, so it is not charged.
    if (switches.storeCurrency && cart.currency !== switches.storeCurrency) {
      return NextResponse.json(
        { success: false, error: "This currency is not available", code: "CURRENCY_UNAVAILABLE" },
        { status: 422 },
      )
    }

    const activeDiscounts = await loadActiveAutomaticDiscounts({ fresh: true })

    const result = await OrderService.createOrder({
      profileId: user.id,
      paymentMethod,
      fulfillment,
      currency: cart.currency,
      idempotencyKey,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      addressId,
      customerPhone,
      customerName,
      notes,
      locale,
      activeDiscounts,
      billing: documentsOn ? billing : null,
    })

    // Fire-and-forget: confirmation emails + PDF attachment
    const customerEmail = profile?.email ?? user.email ?? ""
    if (customerEmail) {
      const fullName =
        customerName ??
        ([profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Customer")
      const sym = result.currency === "USD" ? "$" : "S/"

      // Fetch item names for summary (best-effort)
      prisma.orderItem
        .findMany({
          where: { orderId: result.orderId },
          select: { nameSnapshot: true, quantity: true },
        })
        .then(async (items) => {
          const itemsSummary = items
            .map((i) => `${i.quantity}× ${i.nameSnapshot}`)
            .join(", ")

          // Generate PDF (best-effort | may fail if fonts unavailable)
          const pdfResult = await generateOrderPdfBuffer(result.orderId).catch(() => null)

          const emailData = {
            orderNumber: result.orderNumber,
            customerName: fullName,
            customerEmail,
            fulfillment: fulfillment as "PICKUP" | "DELIVERY",
            itemsSummary,
            currencySymbol: sym,
            total: result.total.toFixed(2),
          }
          const isEs = locale === "es"
          const subject = isEs
            ? `Recibimos tu pedido #${result.orderNumber} | Wild Grove`
            : `We received your order #${result.orderNumber} | Wild Grove`

          await sendOrderEmail(
            customerEmail,
            subject,
            orderConfirmationHtml(emailData, locale as "en" | "es"),
            pdfResult,
          )

          // Admin notification email (Settings → Notification Email only)
          const adminEmail = await getAdminEmail()
          if (adminEmail) {
            const adminSubject = isEs
              ? `Nuevo pedido #${result.orderNumber}`
              : `New order #${result.orderNumber}`
            await sendOrderEmail(
              adminEmail,
              adminSubject,
              orderAdminNewHtml(emailData, locale as "en" | "es"),
            )
          }
        })
        .catch(() => null)
    }

    return NextResponse.json(
      checkoutBody({
        id: result.orderId,
        orderNumber: result.orderNumber,
        total: result.total,
        currency: result.currency,
      }),
      { status: 201 },
    )
  } catch (error) {
    if (profileId && idempotencyKey) {
      try {
        const raced = await existingOrderForKey(profileId, idempotencyKey)
        if (raced?.order) {
          return NextResponse.json(checkoutBody(raced.order), { status: 200 })
        }
      } catch {
        // Keep the error this request already produced.
      }
    }
    if (error instanceof WalletInsufficientFundsError) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient wallet balance",
          code: "INSUFFICIENT_BALANCE",
          available: error.available.toFixed(2),
          required: error.required.toFixed(2),
        },
        { status: 402 },
      )
    }
    if (error instanceof ZoneNotFoundError) {
      return NextResponse.json(
        { success: false, error: "No delivery zone covers this address", code: "NO_ZONE" },
        { status: 422 },
      )
    }
    if (error instanceof MinOrderNotMetError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "MIN_ORDER" },
        { status: 422 },
      )
    }
    if (error instanceof OrderError) {
      // The balance is checked before the charge too; that refusal comes as
      // an OrderError and answers 402 like the charge's own.
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === "INSUFFICIENT_BALANCE" ? 402 : 422 },
      )
    }
    console.error("[checkout POST]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
