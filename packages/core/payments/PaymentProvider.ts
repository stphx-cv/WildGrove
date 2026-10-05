// ══════════════════════════════════════════════════════════════════
// PaymentProvider — provider-agnostic payment abstraction
//
// Strategy pattern: OrderService calls provider.charge() without
// knowing whether it's a wallet debit, an external gateway call, etc.
// Adding a new payment method = implement this interface + register.
// ══════════════════════════════════════════════════════════════════

import { Prisma, PaymentMethod } from "@wildgrove/db"

// ─── Context passed to isAvailable ────────────────────────────────

export interface CheckoutContext {
  profileId: string
  currency: string
  total: Prisma.Decimal
}

// ─── Charge ────────────────────────────────────────────────────────

export interface ChargeInput {
  profileId: string
  currency: string
  amount: Prisma.Decimal
  orderId: string
  idempotencyKey: string
  /**
   * When the caller already has a transaction open, the charge runs inside it
   * and does not open another one. Without it, the provider opens its own.
   */
  tx?: Prisma.TransactionClient
}

export interface ChargeResult {
  success: true
  /** Provider-specific reference (e.g. an external gateway's payment ID) */
  providerRef?: string
}

// ─── Refund ────────────────────────────────────────────────────────

export interface RefundInput {
  profileId: string
  currency: string
  amount: Prisma.Decimal
  orderId: string
  reason?: string
  /** Stable key for this refund. A repeat with the same key is rejected. */
  idempotencyKey?: string
  /**
   * When the caller already has a transaction open, the refund runs inside it
   * and does not open another one. Without it, the provider opens its own.
   */
  tx?: Prisma.TransactionClient
}

export interface RefundResult {
  success: true
  providerRef?: string
}

// ─── Interface ─────────────────────────────────────────────────────

export interface PaymentProvider {
  readonly id: PaymentMethod
  charge(input: ChargeInput): Promise<ChargeResult>
  refund(input: RefundInput): Promise<RefundResult>
  /** Whether this provider can be used for the given checkout */
  isAvailable(ctx: CheckoutContext): Promise<boolean>
}
