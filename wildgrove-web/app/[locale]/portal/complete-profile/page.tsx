import { getTranslations, setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { redirect, type Locale } from "@/i18n/routing"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { CompleteProfileForm } from "@/components/auth/CompleteProfileForm"
import { InitialBalanceNotice } from "@/components/auth/InitialBalanceNotice"
import type { InitialBalanceCredits } from "@wildgrove/core/wallet/initial-balance"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "completeProfile")
}

export default async function CompleteProfilePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("completeProfile")

    // getClaims() verifies the JWT locally (asymmetric keys) — no network
    // round-trip to InsForge. The middleware (proxy.ts) is the real auth gate.
    const insforge = await createClient()
    const { data: claimsData } = await insforge.auth.getClaims()
    const claims = claimsData?.claims
    const userId = typeof claims?.sub === "string" ? claims.sub : null

    const localeKey = locale as Locale
    if (!userId) {
        redirect({ href: "/portal", locale: localeKey })
        return null
    }

    const [profile, initialMovements] = await Promise.all([
        prisma.profile.findUnique({
            where: { id: userId },
            select: { username: true, firstName: true, lastName: true, avatarUrl: true },
        }),
        // What this account was credited when it was created, if anything.
        prisma.walletTransaction.findMany({
            where: { type: "INITIAL_BALANCE", wallet: { profileId: userId } },
            select: { amount: true, wallet: { select: { currency: true } } },
        }),
    ])
    const initialBalance: InitialBalanceCredits = {}
    for (const movement of initialMovements) {
        const currency = movement.wallet.currency
        if (currency === "PEN" || currency === "USD") initialBalance[currency] = movement.amount.toFixed(2)
    }

    // Already completed setup -- send to home
    if (profile?.username) {
        redirect({ href: "/", locale: localeKey })
        return null
    }

    const meta = (claims?.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
    const firstName = profile?.firstName ?? meta.full_name?.split(" ")[0] ?? ""
    const lastName = profile?.lastName ?? meta.full_name?.split(" ").slice(1).join(" ") ?? ""
    const avatarUrl = profile?.avatarUrl ?? meta.avatar_url ?? null

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg flex items-start justify-center px-4 py-12 pt-20 sm:pt-24">
            <div className="w-full max-w-md">

                {/* Card */}
                <div className="p-6 sm:p-8 rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card animate-fade-up">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-1">
                        {t("heading")}
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-7">
                        {t("description")}
                    </p>

                    <InitialBalanceNotice
                        credits={initialBalance}
                        className="text-sm text-wg-text dark:text-wg-dark-text rounded-brand border border-wg-border/60 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised px-4 py-3 mb-7"
                    />

                    <CompleteProfileForm
                        firstName={firstName}
                        lastName={lastName}
                        email={typeof claims?.email === "string" ? claims.email : ""}
                        avatarUrl={avatarUrl}
                    />
                </div>

                {/* Step indicator */}
                <p className="text-center text-xs text-wg-muted/60 dark:text-wg-dark-muted/60 mt-6">
                    {t("stepIndicator")}
                </p>
            </div>
        </div>
    )
}
