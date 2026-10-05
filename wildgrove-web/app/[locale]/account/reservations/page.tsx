import { redirect, type Locale } from "@/i18n/routing"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { getAppSettings } from "@wildgrove/core/settings"
import { AccountSidebar } from "@/components/account/AccountSidebar"
import { ReservationHistory } from "@/components/history/ReservationHistory"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "reservationHistory")
}

export default async function AccountReservationsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations({ locale, namespace: "reservationHistory" })

    // getClaims() verifies the JWT locally (asymmetric keys) — no network
    // round-trip to InsForge. The middleware (proxy.ts) is the real auth gate.
    const insforge = await createClient()
    const { data: claimsData } = await insforge.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null

    if (!userId) {
        redirect({ href: "/portal", locale: locale as Locale })
        return null
    }

    const [profile, settings] = await Promise.all([
        prisma.profile.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, username: true, avatarUrl: true },
        }),
        getAppSettings(),
    ])

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

                    <AccountSidebar activeRoute="reservations" profile={sidebarProfile} />

                    <main>
                        <div className="mb-6">
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text">
                                {t("title")}
                            </h1>
                        </div>

                        <ReservationHistory
                            schedule={{
                                advanceNoticeMs: settings.advanceReservationMs,
                                timeSlotIncrement: settings.timeSlotIncrement,
                                operatingDays: settings.operatingDays,
                                openingTime: settings.openingTime,
                                closingTime: settings.closingTime,
                                maxDaysAhead: settings.maxDaysAhead,
                                closedTimeRanges: settings.closedTimeRanges,
                                maxPartySize: settings.maxPartySize,
                                largeGroupWarningFrom: settings.largeGroupWarningFrom,
                            }}
                        />
                    </main>
                </div>
            </div>
        </div>
    )
}
