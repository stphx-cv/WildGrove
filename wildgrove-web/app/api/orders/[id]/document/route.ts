import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { OrderDocument } from "@wildgrove/core/pdf/OrderDocument"
import type { OrderDocumentData } from "@wildgrove/core/pdf/OrderDocument"
import { resolveOrderCustomerDisplayName } from "@wildgrove/core/pdf/resolveOrderCustomerDisplayName"
import { resolveOrderPdfLocale } from "@wildgrove/core/pdf/orderDocumentCopy"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const insforge = await createClient()
  const {
    data: { user },
  } = await insforge.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch order (must belong to user)
  const order = await prisma.order.findFirst({
    where: { id, profileId: user.id },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      currency: true,
      subtotal: true,
      discountTotal: true,
      deliveryFee: true,
      total: true,
      fulfillment: true,
      deliveryAddress: true,
      documentType: true,
      documentSeries: true,
      documentNumber: true,
      locale: true,
      buyerDni: true,
      fiscalRuc: true,
      fiscalLegalName: true,
      fiscalAddress: true,
      customerName: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
          listUnitPrice: true,
          unitPrice: true,
          lineTotal: true,
          notes: true,
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (!order.documentSeries || !order.documentNumber) {
    return NextResponse.json(
      { error: "Billing document not yet assigned" },
      { status: 422 }
    )
  }

  const pdfLocale = resolveOrderPdfLocale(
    req.nextUrl.searchParams.get("lang"),
    order.locale
  )

  // Fetch restaurant fiscal data from AppSettings
  const settings = await prisma.appSettings.findUnique({
    where: { key: "global" },
    select: {
      companyLegalName: true,
      companyRuc: true,
      companyFiscalAddress: true,
      igvRate: true,
    },
  })

  const docData: OrderDocumentData = {
    locale: pdfLocale,
    orderId: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    currency: order.currency,
    subtotal: order.subtotal.toFixed(2),
    discountTotal: order.discountTotal.toFixed(2),
    deliveryFee: order.deliveryFee.toFixed(2),
    total: order.total.toFixed(2),
    fulfillment: order.fulfillment,
    deliveryAddress: order.deliveryAddress,
    documentType: order.documentType,
    documentSeries: order.documentSeries,
    documentNumber: order.documentNumber,
    buyerDni: order.buyerDni,
    fiscalRuc: order.fiscalRuc,
    fiscalLegalName: order.fiscalLegalName,
    fiscalAddress: order.fiscalAddress,
    customerName: resolveOrderCustomerDisplayName(order),
    items: order.items.map((i) => ({
      nameSnapshot: i.nameSnapshot,
      quantity: i.quantity,
      listUnitPrice: i.listUnitPrice != null ? i.listUnitPrice.toFixed(2) : null,
      unitPrice: i.unitPrice.toFixed(2),
      lineTotal: i.lineTotal.toFixed(2),
      notes: i.notes,
    })),
    restaurant: {
      legalName: settings?.companyLegalName ?? "",
      ruc: settings?.companyRuc ?? "",
      fiscalAddress: settings?.companyFiscalAddress ?? "",
      igvRate: settings?.igvRate ? Number(settings.igvRate) : 18,
    },
  }

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(
      React.createElement(OrderDocument, {
        data: docData,
      }) as unknown as Parameters<typeof renderToBuffer>[0]
    )
  } catch (err) {
    console.error("[PDF] renderToBuffer failed:", err)
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 })
  }

  const filename = `WG-${order.documentSeries}-${order.documentNumber}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
