import { redirect, type Locale } from "@/i18n/routing"
import { setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { getAppSettings, readCheckoutSwitches } from "@wildgrove/core/settings"
import { WalletService } from "@wildgrove/core/wallet/WalletService"
import { AccountSidebar } from "@/components/account/AccountSidebar"
import { WalletSection } from "@/components/account/WalletSection"

const PER_PAGE = 20

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "wallet")
}

export default async function AccountWalletPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ page?: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)
    // getClaims() verifies the JWT locally (asymmetric keys) — no network
    // round-trip to InsForge. The middleware (proxy.ts) is the real auth gate.
    const insforge = await createClient()
    const { data: claimsData } = await insforge.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null

    if (!userId) {
        redirect({ href: "/portal", locale: locale as Locale })
        return null
    }
    const profileId: string = userId

    const { page: pageParam } = await searchParams
    const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1)

    const [profile, wallets, switches, settings] = await Promise.all([
        prisma.profile.findUnique({
            where: { id: profileId },
            select: { firstName: true, lastName: true, username: true, avatarUrl: true },
        }),
        // Read, never created: a wallet that does not exist yet shows as 0.
        prisma.wallet.findMany({
            where: { profileId },
            select: { currency: true, balance: true },
        }),
        readCheckoutSwitches(),
        getAppSettings(),
    ])

    // With dual currency off, only the store currency's wallet and movements.
    const { storeCurrency } = switches
    const currencies = storeCurrency ? [storeCurrency] : (["PEN", "USD"] as const)
    const balances = currencies.map((currency) => ({
        currency,
        balance: (wallets.find((w) => w.currency === currency)?.balance ?? 0).toString(),
    }))

    async function loadLedger(page: number) {
        if (storeCurrency) {
            const { transactions, total } = await WalletService.getLedger(profileId, storeCurrency, { page, perPage: PER_PAGE })
            return { total, transactions: transactions.map((t) => ({ ...t, currency: storeCurrency as string })) }
        }
        return WalletService.getMergedLedger(profileId, { page, perPage: PER_PAGE })
    }

    let ledger = await loadLedger(requestedPage)
    const totalPages = Math.max(1, Math.ceil(ledger.total / PER_PAGE))
    const page = Math.min(requestedPage, totalPages)
    if (page !== requestedPage) ledger = await loadLedger(page)

    const movements = ledger.transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        direction: tx.direction,
        amount: tx.amount.toString(),
        balanceAfter: tx.balanceAfter.toString(),
        currency: tx.currency,
        createdAt: tx.createdAt.toISOString(),
    }))

    const sidebarProfile = {
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
    }

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8 items-start">

                    <AccountSidebar activeRoute="wallet" profile={sidebarProfile} />

                    <main>
                        <WalletSection
                            balances={balances}
                            movements={movements}
                            page={page}
                            totalPages={totalPages}
                            walletEnabled={switches.walletEnabled}
                            dateFormat={settings.dateFormat}
                            timeFormat={settings.timeFormat}
                        />
                    </main>
                </div>
            </div>
        </div>
    )
}
