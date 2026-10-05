import type { OrderPdfLocale } from "./orderDocumentCopy"

function pdfLang(locale: string): OrderPdfLocale {
  return locale === "es" ? "es" : "en"
}

/** User-facing PDF (boleta / factura) — `locale` = next-intl UI locale. */
export function publicOrderDocumentPdfUrl(orderId: string, locale: string) {
  return `/api/orders/${orderId}/document?lang=${pdfLang(locale)}`
}

/** Admin PDF — explicit UI language (`es` / `en`), independent of order checkout locale. */
export function adminOrderDocumentPdfUrl(orderId: string, pdfLocale: OrderPdfLocale | string) {
  return `/api/orders/${orderId}/document?lang=${pdfLang(pdfLocale)}`
}
