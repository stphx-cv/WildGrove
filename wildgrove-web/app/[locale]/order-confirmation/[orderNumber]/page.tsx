import { getTranslations, setRequestLocale } from "next-intl/server"
import { createClient } from "@wildgrove/core/clients/server"
import { redirect, type Locale } from "@/i18n/routing"
import { prisma } from "@wildgrove/db"
import { OrderConfirmationClient } from "./OrderConfirmationClient"
import { safeJsonLd } from "@wildgrove/core/seo/json-ld"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "orderConfirmation" })
  return {
    title: t("metaTitle"),
  }
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>
}) {
  const { locale, orderNumber } = await params
  setRequestLocale(locale)

  // getClaims() verifies the JWT locally (asymmetric keys) — no network
  // round-trip to InsForge. The middleware (proxy.ts) is the real auth gate.
  const insforge = await createClient()
  const { data: claimsData } = await insforge.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null

  const localeKey = locale as Locale
  if (!userId) {
    redirect({ href: "/portal", locale: localeKey })
    return null
  }

  const orderNum = parseInt(orderNumber, 10)
  if (isNaN(orderNum)) {
    redirect({ href: "/", locale: localeKey })
    return null
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber: orderNum, profileId: userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      fulfillment: true,
      currency: true,
      total: true,
      deliveryFee: true,
      subtotal: true,
      discountTotal: true,
      paymentMethod: true,
      paidAt: true,
      scheduledFor: true,
      estimatedReadyAt: true,
      deliveryAddress: true,
      deliveryZoneName: true,
      documentType: true,
      documentSeries: true,
      documentNumber: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          nameSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          notes: true,
        },
      },
    },
  })

  if (!order) {
    redirect({ href: "/", locale: localeKey })
    return null
  }

  // Build Order JSON-LD for schema.org
  const orderStatusMap: Record<string, string> = {
    PENDING: "https://schema.org/OrderProcessing",
    PREPARING: "https://schema.org/OrderProcessing",
    READY: "https://schema.org/OrderPickupAvailable",
    OUT_FOR_DELIVERY: "https://schema.org/OrderInTransit",
    COMPLETED: "https://schema.org/OrderDelivered",
    CANCELLED: "https://schema.org/OrderCancelled",
    REFUNDED: "https://schema.org/OrderReturned",
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Order",
    orderNumber: String(order.orderNumber),
    orderStatus: orderStatusMap[order.status] ?? "https://schema.org/OrderProcessing",
    orderDate: order.createdAt.toISOString(),
    priceCurrency: order.currency,
    price: order.total.toFixed(2),
    acceptedOffer: order.items.map((item) => ({
      "@type": "Offer",
      name: item.nameSnapshot,
      price: item.unitPrice.toFixed(2),
      priceCurrency: order.currency,
      eligibleQuantity: { "@type": "QuantitativeValue", value: item.quantity },
    })),
    seller: {
      "@type": "FoodEstablishment",
      name: "Wild Grove",
      url: "https://www.wildgrove.cv",
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <OrderConfirmationClient
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillment: order.fulfillment,
        currency: order.currency,
        total: order.total.toFixed(2),
        deliveryFee: order.deliveryFee.toFixed(2),
        subtotal: order.subtotal.toFixed(2),
        discountTotal: order.discountTotal.toFixed(2),
        paymentMethod: order.paymentMethod,
        paidAt: order.paidAt?.toISOString() ?? null,
        scheduledFor: order.scheduledFor?.toISOString() ?? null,
        estimatedReadyAt: order.estimatedReadyAt?.toISOString() ?? null,
        deliveryAddress: order.deliveryAddress,
        deliveryZoneName: order.deliveryZoneName,
        documentType: order.documentType,
        documentSeries: order.documentSeries,
        documentNumber: order.documentNumber,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((i) => ({
          id: i.id,
          nameSnapshot: i.nameSnapshot,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toFixed(2),
          lineTotal: i.lineTotal.toFixed(2),
          notes: i.notes,
        })),
      }}
    />
    </>
  )
}
