// ══════════════════════════════════════════════════════════════════
// WalletPaymentProvider — charges the user's Wild Grove wallet
// ══════════════════════════════════════════════════════════════════

import { PaymentMethod } from "@wildgrove/db"
import type {
  PaymentProvider,
  ChargeInput,
  ChargeResult,
  RefundInput,
  RefundResult,
  CheckoutContext,
} from './PaymentProvider'
import { WalletService } from '../wallet/WalletService'

export const WalletPaymentProvider: PaymentProvider = {
  id: PaymentMethod.WALLET,

  async charge(input: ChargeInput): Promise<ChargeResult> {
    await WalletService.charge({
      profileId: input.profileId,
      currency: input.currency,
      amount: input.amount,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      tx: input.tx,
    })
    return { success: true }
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    await WalletService.refund({
      profileId: input.profileId,
      currency: input.currency,
      amount: input.amount,
      orderId: input.orderId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      tx: input.tx,
    })
    return { success: true }
  },

  async isAvailable(ctx: CheckoutContext): Promise<boolean> {
    const balance = await WalletService.getBalance(ctx.profileId, ctx.currency)
    return balance.gte(ctx.total)
  },
}
