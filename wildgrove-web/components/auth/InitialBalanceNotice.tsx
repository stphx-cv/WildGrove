import { useLocale, useTranslations } from "next-intl"
import {
  formatInitialBalanceList,
  joinInitialBalanceList,
  type InitialBalanceCredits,
} from "@wildgrove/core/wallet/initial-balance"

/** What a new account was credited with, as a sentence. Nothing when it got nothing. */
export function InitialBalanceNotice({
  credits,
  className = "",
}: {
  credits: InitialBalanceCredits | null
  className?: string
}) {
  const t = useTranslations("auth")
  const locale = useLocale()

  const amounts = credits ? formatInitialBalanceList(credits) : []
  if (amounts.length === 0) return null

  return (
    <p role="status" className={className}>
      {t("initialBalanceNotice", {
        amounts: joinInitialBalanceList(amounts, locale === "es" ? "es" : "en"),
      })}
    </p>
  )
}
