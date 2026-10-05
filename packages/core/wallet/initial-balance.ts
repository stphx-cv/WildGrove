// ══════════════════════════════════════════════════════════════════
// Initial test balance
//
// Every new account is credited once, with the two amounts in AppSettings, in
// the same transaction that creates its Profile (see auth/sync-profile.ts).
// That transaction is what makes it once: the Profile primary key lets only one
// of two concurrent sign ups create the row, and the credit rolls back with it.
//
// This file holds no runtime import from @wildgrove/db, so the formatting
// helpers can also be used from client components.
// ══════════════════════════════════════════════════════════════════

import type { Prisma } from "@wildgrove/db"

export type InitialBalanceCurrency = "PEN" | "USD"

/** The amounts credited to one account, as "200.00". A currency that got nothing is absent. */
export type InitialBalanceCredits = Partial<Record<InitialBalanceCurrency, string>>

export const INITIAL_BALANCE_CURRENCIES: readonly InitialBalanceCurrency[] = ["PEN", "USD"]

/** What a fresh database credits until the owner changes it in the panel. */
export const DEFAULT_INITIAL_BALANCE: Record<InitialBalanceCurrency, number> = { PEN: 200, USD: 80 }

/** Same ceiling as a wallet recharge in the panel. */
export const MAX_INITIAL_BALANCE = 99_999.99

/** A number from 0 to MAX_INITIAL_BALANCE with at most 2 decimals. */
export function isValidInitialBalanceAmount(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false
  if (value < 0 || value > MAX_INITIAL_BALANCE) return false
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
}

const CURRENCY_SYMBOL: Record<InitialBalanceCurrency, string> = { PEN: "S/", USD: "US$" }

/** `S/ 200`, `US$ 80`, `S/ 150.50`: two decimals only when the amount is not whole. */
export function formatInitialBalanceAmount(
  currency: InitialBalanceCurrency,
  amount: Prisma.Decimal | number | string,
): string {
  const value = Number(amount.toString())
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return `${CURRENCY_SYMBOL[currency]} ${text}`
}

/** The formatted amount of each credited currency, PEN first. */
export function formatInitialBalanceList(credits: InitialBalanceCredits): string[] {
  return INITIAL_BALANCE_CURRENCIES.flatMap((currency) => {
    const amount = credits[currency]
    return amount === undefined ? [] : [formatInitialBalanceAmount(currency, amount)]
  })
}

/** `S/ 200 y US$ 80` in Spanish, `S/ 200 and US$ 80` in English. */
export function joinInitialBalanceList(items: string[], locale: "en" | "es"): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items)
}

/** The two amounts as the owner set them in the panel. */
export type InitialBalanceAmounts = Record<InitialBalanceCurrency, number>

/** The amounts of an AppSettings row, or the defaults when there is no row. */
export function initialBalanceAmountsFrom(
  settings: { initialBalancePEN?: unknown; initialBalanceUSD?: unknown } | null | undefined,
): InitialBalanceAmounts {
  const read = (value: unknown, fallback: number) => {
    const n = value === null || value === undefined ? Number.NaN : Number(String(value))
    return Number.isFinite(n) ? n : fallback
  }
  return {
    PEN: read(settings?.initialBalancePEN, DEFAULT_INITIAL_BALANCE.PEN),
    USD: read(settings?.initialBalanceUSD, DEFAULT_INITIAL_BALANCE.USD),
  }
}

/** The currencies that start with a balance, as the credits they would produce. */
function creditsOf(amounts: InitialBalanceAmounts): InitialBalanceCredits {
  const credits: InitialBalanceCredits = {}
  for (const currency of INITIAL_BALANCE_CURRENCIES) {
    if (amounts[currency] > 0) credits[currency] = amounts[currency].toFixed(2)
  }
  return credits
}

/** The exact strings Sage may write for the amounts above 0: `S/ 200`, `US$ 80`. */
export function initialBalanceStrings(amounts: InitialBalanceAmounts): string[] {
  return formatInitialBalanceList(creditsOf(amounts))
}

/**
 * What Sage says about the starting balance, in one place for the system prompt
 * and for get_restaurant_info. An amount of 0 is not named, and with both at 0
 * the text says the accounts start empty.
 */
export function initialBalanceSentence(locale: "en" | "es", amounts: InitialBalanceAmounts): string {
  const es = locale === "es"
  const parts = INITIAL_BALANCE_CURRENCIES.flatMap((currency) =>
    amounts[currency] > 0
      ? [
          `${formatInitialBalanceAmount(currency, amounts[currency])} ${
            es
              ? currency === "PEN" ? "en la billetera en soles" : "en la billetera en dólares"
              : currency === "PEN" ? "in the soles wallet" : "in the dollars wallet"
          }`,
        ]
      : [],
  )
  if (parts.length === 0) {
    return es
      ? "Las cuentas nuevas empiezan sin saldo de prueba."
      : "New accounts start with no test balance."
  }
  const joined = joinInitialBalanceList(parts, locale)
  return es
    ? `Cada cuenta nueva recibe una sola vez ${joined}, como saldo de prueba para probar pedidos. No es dinero real. Se ve en «Mi billetera» y al pagar, y cuando se acaba se puede pedir más desde la página de [Contacto](/contact).`
    : `Each new account receives, once, ${joined} as test balance to try out orders. It is not real money. It shows in "My wallet" and at checkout, and when it runs out, more can be requested on the [Contact](/contact) page.`
}

export function initialBalanceKey(profileId: string, currency: InitialBalanceCurrency): string {
  return `initial-balance:${profileId}:${currency}`
}

/**
 * Creates the two wallets of a profile that was just created, with their
 * starting balance and one INITIAL_BALANCE movement per amount above 0.
 *
 * Runs only on the client of the caller's transaction. Reads the amounts here,
 * without a cache, so what is credited is what the panel said at that moment.
 */
export async function creditInitialBalance(
  tx: Prisma.TransactionClient,
  profileId: string,
): Promise<InitialBalanceCredits> {
  const settings = await tx.appSettings.findUnique({
    where: { key: "global" },
    select: { initialBalancePEN: true, initialBalanceUSD: true },
  })
  const amounts: Record<InitialBalanceCurrency, Prisma.Decimal | number> = {
    PEN: settings?.initialBalancePEN ?? DEFAULT_INITIAL_BALANCE.PEN,
    USD: settings?.initialBalanceUSD ?? DEFAULT_INITIAL_BALANCE.USD,
  }

  const credited: InitialBalanceCredits = {}
  for (const currency of INITIAL_BALANCE_CURRENCIES) {
    const amount = amounts[currency]
    const hasBalance = Number(amount.toString()) > 0

    const wallet = await tx.wallet.create({
      data: { profileId, currency, balance: hasBalance ? amount : 0 },
      select: { id: true, balance: true },
    })
    if (!hasBalance) continue

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "INITIAL_BALANCE",
        direction: "CREDIT",
        amount,
        balanceAfter: wallet.balance,
        idempotencyKey: initialBalanceKey(profileId, currency),
      },
    })
    credited[currency] = wallet.balance.toFixed(2)
  }

  return credited
}
