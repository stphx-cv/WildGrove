"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { ExclamationTriangleIcon } from "@wildgrove/ui/icons"

/**
 * Shown when /account cannot load the Profile row because Postgres rejected
 * the connection (InsForge nano P2037). Soft-fail instead of a bare 500.
 */
export function AccountDbUnavailable() {
    const t = useTranslations("account")

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20 px-4">
            <div className="max-w-md mx-auto text-center rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-8 sm:p-10">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center">
                    <ExclamationTriangleIcon className="w-7 h-7 text-amber-700 dark:text-amber-400" />
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                    {t("dbBusyTitle")}
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-6">
                    {t("dbBusyBody")}
                </p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full px-5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all"
                >
                    {t("dbBusyRetry")}
                </button>
                <p className="mt-4">
                    <Link
                        href="/"
                        className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors"
                    >
                        {t("backToHome")}
                    </Link>
                </p>
            </div>
        </div>
    )
}
