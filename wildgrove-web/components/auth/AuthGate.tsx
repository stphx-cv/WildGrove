"use client"

import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { ArrowRightOnRectangleIcon, KeyIcon } from "@wildgrove/ui/icons"

interface AuthGateProps {
    isAuthenticated: boolean
    children: React.ReactNode
    title?: string
    description?: string
    returnPath?: string
}

export function AuthGate({
    isAuthenticated,
    children,
    title,
    description,
    returnPath = "/",
}: AuthGateProps) {
    const t = useTranslations("auth")
    const tc = useTranslations("common")

    if (isAuthenticated) return <>{children}</>

    const displayTitle = title ?? t("signInToContinue")
    const displayDescription = description ?? t("createAccountAccess")
    const signInHref = `/portal?next=${encodeURIComponent(returnPath)}`

    return (
        <div className="flex items-center justify-center py-8">
            <div className="w-full max-w-md text-center rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card dark:shadow-glow-sm p-8 sm:p-10">
                {/* Decorative leaf icon */}
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center">
                    <KeyIcon className="w-8 h-8 text-wg-primary dark:text-wg-dark-primary" />
                </div>

                <h3 className="font-display text-xl sm:text-2xl font-bold text-wg-text dark:text-wg-dark-text mb-3">
                    {displayTitle}
                </h3>

                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-8 max-w-sm mx-auto">
                    {displayDescription}
                </p>

                <Link
                    href={signInHref}
                    className="inline-flex items-center justify-center gap-2 w-full px-7 py-4 text-base font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99] shadow-card"
                >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    {tc("signIn")}
                </Link>

                <p className="mt-4 text-sm text-wg-muted dark:text-wg-dark-muted">
                    {tc("dontHaveAccount")}{" "}
                    <Link
                        href={`${signInHref}&mode=register`}
                        className="text-wg-accent dark:text-wg-dark-accent hover:underline font-medium transition-colors"
                    >
                        {tc("createOne")}
                    </Link>
                </p>
            </div>
        </div>
    )
}
