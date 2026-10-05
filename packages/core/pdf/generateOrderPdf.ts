// Generates a PDF buffer for a given order ID.
// Fetches order and AppSettings from DB, then renders the PDF.
// Safe to call server-side (not in browser).

import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { prisma } from "@wildgrove/db"
import { OrderDocument } from "./OrderDocument"
import type { OrderDocumentData } from "./OrderDocument"
import { resolveOrderCustomerDisplayName } from "./resolveOrderCustomerDisplayName"
import { resolveOrderPdfLocale } from "./orderDocumentCopy"

export async function generateOrderPdfBuffer(orderId: string): Promise<{
  content: Buffer
  filename: string
} | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  if (!order || !order.documentSeries || !order.documentNumber) return null

  const pdfLocale = resolveOrderPdfLocale(undefined, order.locale)

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

  const rawBuffer = await renderToBuffer(
    React.createElement(OrderDocument, {
      data: docData,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  )

  return {
    content: Buffer.from(rawBuffer),
    filename: `WG-${order.documentSeries}-${order.documentNumber}.pdf`,
  }
}
