/**
 * Human-readable billing document label (Boleta / Factura) for the current UI locale.
 * Used where next-intl is not wired (e.g. admin) or with `useLocale()` / `order.locale`.
 */
export function billingDocumentTypeLabel(
  documentType: string | null | undefined,
  locale: string,
): string {
  if (!documentType) return ""
  const preferEs = /^es/i.test(locale.trim())
  if (documentType === "FACTURA") return preferEs ? "Factura" : "Invoice"
  if (documentType === "BOLETA") return preferEs ? "Boleta de venta" : "Sales receipt"
  return documentType
}
