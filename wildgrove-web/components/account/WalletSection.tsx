import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { WalletIcon } from "@wildgrove/ui/icons"
import { formatPrice } from "@wildgrove/core/currency"
import { formatAppDate, formatAppTime } from "@wildgrove/core/app-datetime-format"

export interface WalletBalanceView {
  currency: string
  balance: string
}

export interface WalletMovementView {
  id: string
  type: string
  direction: "CREDIT" | "DEBIT"
  amount: string
  balanceAfter: string
  currency: string
  createdAt: string
}

interface WalletSectionProps {
  balances: WalletBalanceView[]
  movements: WalletMovementView[]
  page: number
  totalPages: number
  walletEnabled: boolean
  dateFormat: string
  timeFormat: string
}

export function WalletSection({
  balances,
  movements,
  page,
  totalPages,
  walletEnabled,
  dateFormat,
  timeFormat,
}: WalletSectionProps) {
  const t = useTranslations("wallet")
  const tCheckout = useTranslations("checkout")

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text">
          {t("title")}
        </h1>
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">{t("subtitle")}</p>
      </div>

      {!walletEnabled && (
        <p
          role="status"
          className="mb-4 rounded-brand border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface px-4 py-3 text-sm text-wg-muted dark:text-wg-dark-muted"
        >
          {tCheckout("payment.walletDisabled")}
        </p>
      )}

      <div className={`grid grid-cols-1 gap-4 mb-3 ${balances.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {balances.map((wallet) => (
          <div
            key={wallet.currency}
            className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-5"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-wg-muted dark:text-wg-dark-muted">
              <WalletIcon className="w-4 h-4 shrink-0" />
              {t(wallet.currency === "USD" ? "usdWallet" : "penWallet")}
            </div>
            <p className="mt-3 text-xs text-wg-muted dark:text-wg-dark-muted">{t("balance")}</p>
            <p className="font-display text-3xl font-bold text-wg-text dark:text-wg-dark-text tabular-nums">
              {formatPrice(Number(wallet.balance), wallet.currency)}
            </p>
          </div>
        ))}
      </div>

      <p className="mb-8 text-xs text-wg-muted dark:text-wg-dark-muted">{t("testNote")}</p>

      <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-3">
        {t("transactions")}
      </h2>

      <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
        {movements.length === 0 ? (
          <p className="py-12 text-center text-sm text-wg-muted dark:text-wg-dark-muted">
            {t("noTransactions")}
          </p>
        ) : (
          <ul className="divide-y divide-wg-border/30 dark:divide-wg-dark-border">
            {movements.map((movement) => {
              const date = new Date(movement.createdAt)
              const isCredit = movement.direction === "CREDIT"
              return (
                <li key={movement.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                      {t(`type.${movement.type}`)}
                    </p>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                      {formatAppDate(date, dateFormat)} · {formatAppTime(date, timeFormat)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        isCredit
                          ? "text-wg-primary dark:text-wg-dark-primary"
                          : "text-wg-text dark:text-wg-dark-text"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatPrice(Number(movement.amount), movement.currency)}
                    </p>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5 tabular-nums">
                      {t("balance")}: {formatPrice(Number(movement.balanceAfter), movement.currency)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label={t("transactions")}>
          {page > 1 ? (
            <Link
              href={{ pathname: "/account/wallet", query: { page: page - 1 } }}
              className="font-medium text-wg-accent dark:text-wg-dark-accent hover:underline"
            >
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-wg-muted dark:text-wg-dark-muted">{t("pageOf", { page, pages: totalPages })}</span>
          {page < totalPages ? (
            <Link
              href={{ pathname: "/account/wallet", query: { page: page + 1 } }}
              className="font-medium text-wg-accent dark:text-wg-dark-accent hover:underline"
            >
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  )
}
