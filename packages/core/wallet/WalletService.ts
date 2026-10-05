// ══════════════════════════════════════════════════════════════════
// WalletService — atomic wallet operations
//
// Rules:
//  • Every mutation runs in one transaction: the caller's, when one is passed,
//    otherwise a transaction this service opens. Never a plain update.
//  • All amounts use Prisma.Decimal — never JS number
//  • balanceAfter is always stored as an audit snapshot
//  • idempotencyKey prevents double-charge on client retry
//  • Balance never goes below 0 (caller receives a typed error)
// ══════════════════════════════════════════════════════════════════

import { Prisma } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"
import { createAdminNotificationForAllAdmins } from '../admin-notifications'

// ─── Typed errors ─────────────────────────────────────────────────

export class WalletInsufficientFundsError extends Error {
  constructor(
    public readonly available: Prisma.Decimal,
    public readonly required: Prisma.Decimal,
    public readonly currency: string,
  ) {
    super(
      `Insufficient ${currency} balance: available ${available.toFixed(2)}, required ${required.toFixed(2)}`,
    )
    this.name = 'WalletInsufficientFundsError'
  }
}

export class WalletIdempotencyError extends Error {
  constructor(key: string) {
    super(`Transaction with idempotency key "${key}" already processed`)
    this.name = 'WalletIdempotencyError'
  }
}

export class WalletNotFoundError extends Error {
  constructor(profileId: string, currency: string) {
    super(`Wallet not found for profile ${profileId} / ${currency}`)
    this.name = 'WalletNotFoundError'
  }
}

// ─── Input types ──────────────────────────────────────────────────

export interface RechargeInput {
  profileId: string
  currency: string
  amount: Prisma.Decimal
  performedById: string
  note?: string
  idempotencyKey: string
}

export interface AdjustInput {
  profileId: string
  currency: string
  /** Positive = add, negative = deduct */
  delta: Prisma.Decimal
  performedById: string
  note?: string
}

export interface SetBalanceInput {
  profileId: string
  currency: string
  /** Exact target balance (must be ≥ 0). */
  targetBalance: Prisma.Decimal
  performedById: string
  note?: string
}

export interface ChargeInput {
  profileId: string
  currency: string
  amount: Prisma.Decimal
  orderId: string
  idempotencyKey: string
  /** Run inside the caller's transaction. Without it, charge opens its own. */
  tx?: Prisma.TransactionClient
}

export interface RefundInput {
  profileId: string
  currency: string
  amount: Prisma.Decimal
  orderId: string
  reason?: string
  /** Stable key for this refund. A repeat with the same key is rejected. */
  idempotencyKey?: string
  /** Run inside the caller's transaction. Without it, refund opens its own. */
  tx?: Prisma.TransactionClient
}

export interface LedgerOptions {
  page?: number
  perPage?: number
}

// ─── Service ──────────────────────────────────────────────────────

export const WalletService = {
  /**
   * Returns the wallet for a profile+currency, creating it if it doesn't exist.
   * Both PEN and USD wallets are auto-created on first access.
   */
  async getOrCreateWallet(profileId: string, currency: string) {
    return prisma.wallet.upsert({
      where: { profileId_currency: { profileId, currency } },
      update: {},
      create: { profileId, currency, balance: new Prisma.Decimal(0) },
    })
  },

  /**
   * Returns the current balance for a profile+currency.
   * Creates the wallet if it doesn't exist.
   */
  async getBalance(profileId: string, currency: string): Promise<Prisma.Decimal> {
    const wallet = await WalletService.getOrCreateWallet(profileId, currency)
    return wallet.balance
  },

  /**
   * Returns paginated ledger entries for a wallet.
   */
  async getLedger(profileId: string, currency: string, opts: LedgerOptions = {}) {
    const { page = 1, perPage = 25 } = opts
    const wallet = await prisma.wallet.findUnique({
      where: { profileId_currency: { profileId, currency } },
      select: { id: true },
    })
    if (!wallet) return { transactions: [], total: 0 }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          type: true,
          amount: true,
          direction: true,
          balanceAfter: true,
          reference: true,
          performedById: true,
          note: true,
          createdAt: true,
        },
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ])

    return { transactions, total }
  },

  /**
   * Paginated ledger across all wallets for a profile (PEN + USD), sorted by createdAt desc.
   * Each row includes `currency` from the parent wallet.
   */
  async getMergedLedger(profileId: string, opts: LedgerOptions = {}) {
    const { page = 1, perPage = 25 } = opts
    const where = { wallet: { profileId } as const }

    const [rows, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          type: true,
          amount: true,
          direction: true,
          balanceAfter: true,
          reference: true,
          performedById: true,
          note: true,
          createdAt: true,
          wallet: { select: { currency: true } },
        },
      }),
      prisma.walletTransaction.count({ where }),
    ])

    const transactions = rows.map(({ wallet, ...t }) => ({
      ...t,
      currency: wallet.currency,
    }))

    return { transactions, total }
  },

  /**
   * OWNER-only: add balance to a wallet (RECHARGE).
   * Idempotent — safe to retry with same key.
   */
  async recharge(input: RechargeInput) {
    const { profileId, currency, amount, performedById, note, idempotencyKey } = input

    if (amount.lte(0)) throw new Error('Recharge amount must be positive')

    // Check idempotency
    const existing = await prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    })
    if (existing) throw new WalletIdempotencyError(idempotencyKey)

    const tx = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { profileId_currency: { profileId, currency } },
        update: { balance: { increment: amount } },
        create: { profileId, currency, balance: amount },
      })

      const newBalance = wallet.balance

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'RECHARGE',
          direction: 'CREDIT',
          amount,
          balanceAfter: newBalance,
          performedById,
          note,
          idempotencyKey,
        },
      })
    })

    // Notify admins (fire-and-forget)
    createAdminNotificationForAllAdmins({
      type: 'WALLET_RECHARGE',
      entityType: 'WALLET_TRANSACTION',
      entityId: tx.id,
      title: `Wallet recharged`,
      message: `${currency} ${amount.toFixed(2)} added to wallet`,
      href: `/wallets/${profileId}`,
    }).catch(() => null)

    return tx
  },

  /**
   * OWNER-only: adjust a wallet balance (positive or negative delta).
   * Uses ADJUST_ADD or ADJUST_DEDUCT accordingly.
   * Will error if the result would go below 0 (unless bypassMinimum is set by OWNER explicitly).
   */
  async adjust(input: AdjustInput) {
    const { profileId, currency, delta, performedById, note } = input

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { profileId_currency: { profileId, currency } },
        update: {},
        create: { profileId, currency, balance: new Prisma.Decimal(0) },
      })

      // Add the delta to the stored balance instead of writing a value
      // computed from the upsert's read, which does not lock the row: a
      // charge committed in between would be overwritten. The update waits
      // for any concurrent writer and applies on top of its result; a
      // negative outcome throws, and the transaction undoes the update.
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: delta } },
      })

      if (updated.balance.lt(0)) {
        throw new WalletInsufficientFundsError(updated.balance.sub(delta), delta.abs(), currency)
      }

      const isCredit = delta.gte(0)

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: isCredit ? 'ADJUST_ADD' : 'ADJUST_DEDUCT',
          direction: isCredit ? 'CREDIT' : 'DEBIT',
          amount: delta.abs(),
          balanceAfter: updated.balance,
          performedById,
          note,
        },
      })
    })
  },

  /**
   * OWNER-only: set wallet balance to an exact value (ADJUST_SET).
   * Logs the delta vs previous balance; no-op if already equal.
   */
  async setBalance(input: SetBalanceInput) {
    const { profileId, currency, targetBalance, performedById, note } = input

    if (targetBalance.lt(0)) throw new Error('Target balance cannot be negative')

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { profileId_currency: { profileId, currency } },
        update: {},
        create: { profileId, currency, balance: new Prisma.Decimal(0) },
      })

      // Lock the row before reading the balance the delta is taken from.
      // The upsert's read does not lock, so a charge committed after it
      // would be missing from the delta written to the ledger. This write
      // waits for any concurrent writer and returns the balance after it.
      const locked = await tx.wallet.update({
        where: { id: wallet.id },
        data: { updatedAt: new Date() },
        select: { balance: true },
      })

      const delta = targetBalance.sub(locked.balance)

      if (delta.eq(0)) {
        throw new Error('Balance is already at this amount.')
      }

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: targetBalance },
      })

      const isCredit = delta.gt(0)

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'ADJUST_SET',
          direction: isCredit ? 'CREDIT' : 'DEBIT',
          amount: delta.abs(),
          balanceAfter: updated.balance,
          performedById,
          note,
        },
      })
    })
  },

  /**
   * Charge the user's wallet for an order.
   * Throws WalletInsufficientFundsError if balance < amount.
   * Throws WalletIdempotencyError if idempotencyKey was already processed.
   */
  /**
   * The row that already used this key, if any. Checkout uses it to tell a
   * repeated payment from a key that belongs to someone else.
   */
  async findByIdempotencyKey(idempotencyKey: string) {
    return prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
      select: {
        type: true,
        reference: true,
        wallet: { select: { profileId: true } },
      },
    })
  },

  async charge(input: ChargeInput) {
    const { profileId, currency, amount, orderId, idempotencyKey, tx } = input

    if (amount.lte(0)) throw new Error('Charge amount must be positive')

    const apply = async (db: Prisma.TransactionClient) => {
      // The lookup uses the same transaction as the debit, so a key written
      // earlier in this transaction is visible here.
      const existing = await db.walletTransaction.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      })
      if (existing) throw new WalletIdempotencyError(idempotencyKey)

      const wallet = await db.wallet.findUnique({
        where: { profileId_currency: { profileId, currency } },
        select: { id: true, balance: true },
      })

      if (!wallet) throw new WalletNotFoundError(profileId, currency)

      // Atomic conditional debit: the UPDATE only applies when the row's
      // current balance still covers the amount. This closes the
      // read-then-write race — two concurrent charges can no longer both
      // pass a balance check and overdraw the wallet. Under READ COMMITTED
      // the second writer blocks, re-reads the post-debit balance, and
      // matches 0 rows when funds are insufficient.
      const result = await db.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })

      if (result.count === 0) {
        throw new WalletInsufficientFundsError(wallet.balance, amount, currency)
      }

      // Snapshot the post-debit balance for the ledger row.
      const updated = await db.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: { balance: true },
      })

      return db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          direction: 'DEBIT',
          amount,
          balanceAfter: updated.balance,
          reference: orderId,
          idempotencyKey,
        },
      })
    }

    if (tx) return apply(tx)
    return prisma.$transaction(apply)
  },

  /**
   * Refund a charge back to the wallet (on order cancellation).
   * Always credits the same currency that was originally charged.
   */
  async refund(input: RefundInput) {
    const { profileId, currency, amount, orderId, reason, idempotencyKey, tx } = input

    if (amount.lte(0)) throw new Error('Refund amount must be positive')

    const apply = async (db: Prisma.TransactionClient) => {
      if (idempotencyKey) {
        const existing = await db.walletTransaction.findUnique({
          where: { idempotencyKey },
          select: { id: true },
        })
        if (existing) throw new WalletIdempotencyError(idempotencyKey)
      }

      const wallet = await db.wallet.upsert({
        where: { profileId_currency: { profileId, currency } },
        update: { balance: { increment: amount } },
        create: { profileId, currency, balance: amount },
      })

      const newBalance = wallet.balance

      return db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'REFUND',
          direction: 'CREDIT',
          amount,
          balanceAfter: newBalance,
          reference: orderId,
          note: reason,
          idempotencyKey,
        },
      })
    }

    if (tx) return apply(tx)
    return prisma.$transaction(apply)
  },

  /**
   * OWNER-only: remove one ledger row. Does not modify Wallet.balance.
   */
  async deleteLedgerTransaction(profileId: string, transactionId: string): Promise<boolean> {
    const result = await prisma.walletTransaction.deleteMany({
      where: {
        id: transactionId,
        wallet: { profileId },
      },
    })
    return result.count === 1
  },

  /**
   * OWNER-only: remove all ledger rows for this profile (all currencies). Does not modify Wallet.balance.
   */
  async deleteAllLedgerTransactions(profileId: string): Promise<number> {
    const wallets = await prisma.wallet.findMany({
      where: { profileId },
      select: { id: true },
    })
    if (wallets.length === 0) return 0
    const result = await prisma.walletTransaction.deleteMany({
      where: { walletId: { in: wallets.map((w) => w.id) } },
    })
    return result.count
  },
}
