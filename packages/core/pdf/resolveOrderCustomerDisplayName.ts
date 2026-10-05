/**
 * Name shown on billing PDFs: prefer snapshot on the order, else profile
 * (nombres y apellidos de la cuenta).
 */
export function resolveOrderCustomerDisplayName(order: {
  customerName: string | null
  profile: {
    firstName: string | null
    lastName: string | null
    name: string | null
  } | null
}): string | null {
  const fromOrder = order.customerName?.trim()
  if (fromOrder) return fromOrder
  const p = order.profile
  if (!p) return null
  const fromNames = [p.firstName, p.lastName].filter(Boolean).join(" ").trim()
  if (fromNames) return fromNames
  return p.name?.trim() || null
}
