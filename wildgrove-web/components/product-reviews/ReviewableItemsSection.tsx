// ══════════════════════════════════════════════════════════════════
// Account page — shows items the user can review (COMPLETED + not yet
// reviewed). Server component; uses ReviewableItemCard for the form.
// ══════════════════════════════════════════════════════════════════

import { getTranslations } from "next-intl/server"
import { prisma } from "@wildgrove/db"
import { getAppSettings } from "@wildgrove/core/settings"
import { ReviewableItemCard } from "./ReviewableItemCard"

interface ReviewableItemsSectionProps {
    userId: string
    locale: string
}

export async function ReviewableItemsSection({ userId, locale }: ReviewableItemsSectionProps) {
    const settings = await getAppSettings()
    if (!settings.reviewsEnabled) return null

    const t = await getTranslations("productReviews")

    // Pull recent OrderItems from COMPLETED orders + the user's existing product reviews.
    const [orderItems, existing] = await Promise.all([
        prisma.orderItem.findMany({
            where: { order: { profileId: userId, status: "COMPLETED" } },
            select: {
                id: true,
                menuItemId: true,
                nameSnapshot: true,
                order: { select: { orderNumber: true, createdAt: true } },
                menuItem: {
                    select: {
                        id: true, name: true, nameEs: true, imageUrl: true, slug: true, slugEs: true,
                    },
                },
            },
            orderBy: { order: { createdAt: "desc" } },
            take: 50,
        }),
        prisma.productReview.findMany({
            where: { profileId: userId },
            select: { menuItemId: true },
        }),
    ])

    const reviewedSet = new Set(existing.map((r) => r.menuItemId))
    const seen = new Set<string>()
    const eligible = orderItems.filter((oi) => {
        if (reviewedSet.has(oi.menuItemId)) return false
        if (seen.has(oi.menuItemId)) return false
        seen.add(oi.menuItemId)
        return true
    })

    if (eligible.length === 0) return null

    return (
        <section id="reviewable" className="mb-10">
            <header className="mb-4">
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-wg-text dark:text-wg-dark-text">
                    {t("reviewableSectionTitle")}
                </h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    {t("reviewableSectionSubtitle")}
                </p>
            </header>

            <div className="flex flex-col gap-3">
                {eligible.map((oi) => {
                    const displayName = locale === "es" && oi.menuItem?.nameEs
                        ? oi.menuItem.nameEs
                        : oi.menuItem?.name ?? oi.nameSnapshot
                    return (
                        <ReviewableItemCard
                            key={oi.id}
                            orderItemId={oi.id}
                            menuItemId={oi.menuItemId}
                            name={displayName}
                            imageUrl={oi.menuItem?.imageUrl ?? null}
                            orderNumber={oi.order.orderNumber}
                            orderDate={oi.order.createdAt}
                            maxPhotos={settings.reviewPhotoLimit}
                        />
                    )
                })}
            </div>
        </section>
    )
}
