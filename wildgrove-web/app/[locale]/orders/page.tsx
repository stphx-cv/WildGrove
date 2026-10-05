import { redirect, type Locale } from "@/i18n/routing"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { pageMetadata } from "@/i18n/messages"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { AccountSidebar } from "@/components/account/AccountSidebar"
import { OrdersList } from "@/components/orders/OrdersList"
import { ReviewableItemsSection } from "@/components/product-reviews/ReviewableItemsSection"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    // Synchronous on purpose — see i18n/messages.ts: an awaited lookup here
    // lets the HTML shell win the race and pushes <title> out of <head>.
    return pageMetadata(locale, "orders")
}

export default async function OrdersPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations({ locale, namespace: "orders" })

    // getClaims() verifies the JWT locally (asymmetric keys) — no network
    // round-trip to InsForge. The middleware (proxy.ts) is the real auth gate.
    const insforge = await createClient()
    const { data: claimsData } = await insforge.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null

    if (!userId) {
        redirect({ href: "/portal", locale: locale as Locale })
        return null
    }

    const [profile, ordersData, totalOrders] = await Promise.all([
        prisma.profile.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, username: true, avatarUrl: true },
        }),
        prisma.order.findMany({
            where: { profileId: userId, hiddenByUser: false },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
                id: true,
                orderNumber: true,
                status: true,
                fulfillment: true,
                currency: true,
                total: true,
                createdAt: true,
                documentType: true,
                documentSeries: true,
                documentNumber: true,
                items: {
                    select: { nameSnapshot: true, quantity: true },
                    take: 3,
                },
            },
        }),
        prisma.order.count({
            where: { profileId: userId, hiddenByUser: false },
        }),
    ])

    const sidebarProfile = {
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
    }

    // Serialize Decimal fields for client components
    const serializedOrders = ordersData.map((o) => ({
        ...o,
        total: String(o.total),
        createdAt: o.createdAt.toISOString(),
        documentType: o.documentType,
        documentSeries: o.documentSeries ?? null,
        documentNumber: o.documentNumber ?? null,
    }))

    return (
        <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8 items-start">

                    {/* Sidebar */}
                    <AccountSidebar activeRoute="orders" profile={sidebarProfile} />

                    {/* Main content */}
                    <main>
                        {/* Page header */}
                        <div className="mb-6">
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text">
                                {t("title")}
                            </h1>
                            {totalOrders > 0 && (
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                                    {t("totalCount", { count: totalOrders })}
                                </p>
                            )}
                        </div>

                        <ReviewableItemsSection userId={userId} locale={locale} />

                        <OrdersList
                            profileId={userId}
                            initialOrders={serializedOrders}
                            initialTotal={totalOrders}
                            locale={locale}
                        />
                    </main>
                </div>
            </div>
        </div>
    )
}
