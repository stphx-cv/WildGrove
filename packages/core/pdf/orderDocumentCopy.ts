// UI strings for Order PDF (Boleta / Factura) — keep in sync with OrderDocument.tsx

export type OrderPdfLocale = "en" | "es"

export interface OrderDocumentCopy {
  docBoleta: string
  docFactura: string
  tagline: string
  issuer: string
  customer: string
  customerInvoice: string
  order: string
  pickup: string
  delivery: string
  detail: string
  productsSection: string
  tableDescription: string
  tableQty: string
  tableUnit: string
  tableLineTotal: string
  subtotal: string
  discount: string
  deliveryFee: string
  taxableBase: string
  igvLabel: (rate: number) => string
  totalDue: string
  total: string
  thanks: string
  footerDocLine: (docLabel: string, docCode: string, orderNumber: number) => string
  datePrefix: (dateStr: string) => string
  defaultLegalName: string
  listUnitRef: (sym: string, list: string, paid: string) => string
}

const ES: OrderDocumentCopy = {
  docBoleta: "BOLETA DE VENTA",
  docFactura: "FACTURA ELECTRÓNICA",
  tagline: "Forest Kitchen & Bar",
  issuer: "Emisor",
  customer: "Cliente",
  customerInvoice: "Datos del Cliente (Factura)",
  order: "Pedido",
  pickup: "Recojo en tienda",
  delivery: "Delivery",
  detail: "Detalle",
  productsSection: "Detalle de Productos",
  tableDescription: "Descripción",
  tableQty: "Cant.",
  tableUnit: "P. Unit.",
  tableLineTotal: "Total",
  subtotal: "Subtotal",
  discount: "Descuento",
  deliveryFee: "Delivery",
  taxableBase: "Base imponible",
  igvLabel: (rate) => `IGV (${rate}%)`,
  totalDue: "Total a pagar",
  total: "TOTAL",
  thanks: "Gracias por su preferencia",
  footerDocLine: (docLabel, docCode, orderNumber) =>
    `${docLabel} ${docCode} · Pedido #${orderNumber}`,
  datePrefix: (dateStr) => `Fecha: ${dateStr}`,
  defaultLegalName: "Wild Grove Restaurant",
  listUnitRef: (sym, list, paid) => `P. unit. ref. ${sym} ${list} → ${sym} ${paid}`,
}

const EN: OrderDocumentCopy = {
  docBoleta: "SALES RECEIPT",
  docFactura: "ELECTRONIC INVOICE",
  tagline: "Forest Kitchen & Bar",
  issuer: "Issuer",
  customer: "Customer",
  customerInvoice: "Bill to (invoice)",
  order: "Order",
  pickup: "Pickup in store",
  delivery: "Delivery",
  detail: "Items",
  productsSection: "Line items",
  tableDescription: "Description",
  tableQty: "Qty",
  tableUnit: "Unit",
  tableLineTotal: "Amount",
  subtotal: "Subtotal",
  discount: "Discount",
  deliveryFee: "Delivery fee",
  taxableBase: "Taxable base",
  igvLabel: (rate) => `IGV (${rate}%)`,
  totalDue: "Amount due",
  total: "TOTAL",
  thanks: "Thank you for your business",
  footerDocLine: (docLabel, docCode, orderNumber) =>
    `${docLabel} ${docCode} · Order #${orderNumber}`,
  datePrefix: (dateStr) => `Date: ${dateStr}`,
  defaultLegalName: "Wild Grove Restaurant",
  listUnitRef: (sym, list, paid) => `Ref. list ${sym} ${list} → ${sym} ${paid}`,
}

export function getOrderDocumentCopy(locale: OrderPdfLocale): OrderDocumentCopy {
  return locale === "es" ? ES : EN
}

export function normalizeOrderPdfLocale(raw: string | null | undefined): OrderPdfLocale {
  return raw === "es" ? "es" : "en"
}

/** Query `lang` wins (UI); otherwise stored order locale; default `en`. */
export function resolveOrderPdfLocale(
  langQuery: string | null | undefined,
  orderLocale: string | null | undefined
): OrderPdfLocale {
  if (langQuery === "en" || langQuery === "es") return langQuery
  return normalizeOrderPdfLocale(orderLocale)
}
