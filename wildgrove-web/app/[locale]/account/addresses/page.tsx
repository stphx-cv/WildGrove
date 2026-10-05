import { redirect, type Locale } from "@/i18n/routing"
import { setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { AccountSidebar } from "@/components/account/AccountSidebar"
import { AddressesSection } from "@/components/addresses/AddressesSection"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "addresses")
}

export default async function AccountAddressesPage({
    params,
}: {
    params: Promise<{ locale: string }>
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

    const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, username: true, avatarUrl: true },
    })

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

                    <AccountSidebar activeRoute="addresses" profile={sidebarProfile} />

                    <main>
                        <AddressesSection />
                    </main>
                </div>
            </div>
        </div>
    )
}
