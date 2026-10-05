"use client"

import { startTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"

export default function AccountError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const t = useTranslations("account")

    const router = useRouter()

    // reset() alone only re-renders what the browser already has, and the
    // error came from the server. Ask the server again, then clear it.
    const retry = () => {
        startTransition(() => {
            router.refresh()
            reset()
        })
    }

    useEffect(() => {
        console.error("[account]", error.digest ?? error.message)
    }, [error])

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20 px-4">
            <div className="max-w-md mx-auto text-center rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-8 sm:p-10">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-2">
                    {t("dbBusyTitle")}
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-6">
                    {t("dbBusyBody")}
                </p>
                <button
                    type="button"
                    onClick={retry}
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
