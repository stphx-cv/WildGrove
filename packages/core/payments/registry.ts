// ══════════════════════════════════════════════════════════════════
// Payment provider registry
//
// Central lookup for all payment providers. OrderService resolves
// the correct provider at checkout time via getProvider().
// ══════════════════════════════════════════════════════════════════

import { PaymentMethod } from "@wildgrove/db"
import type { PaymentProvider } from './PaymentProvider'
import { WalletPaymentProvider } from './WalletPaymentProvider'

const registry = new Map<PaymentMethod, PaymentProvider>([
  [PaymentMethod.WALLET, WalletPaymentProvider],
])

export function getProvider(method: PaymentMethod): PaymentProvider {
  const provider = registry.get(method)
  if (!provider) throw new Error(`No payment provider registered for method: ${method}`)
  return provider
}

export { PaymentMethod }
