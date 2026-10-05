// ══════════════════════════════════════════════════════════════════
// Product review invite — fired when an order transitions to COMPLETED.
//
// Behavior: sends an email listing the products in the order that the
// customer has NOT yet reviewed. If every product has already been
// reviewed (or the order has no customer email), nothing is sent.
// Fire-and-forget — should never throw to its caller.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "@wildgrove/db"
import {
    productReviewInviteHtml,
    sendOrderEmail,
} from "../email"

type LocaleCode = "en" | "es"

function pickLocale(raw: string | null | undefined): LocaleCode {
    return raw === "es" ? "es" : "en"
}

export async function maybeSendProductReviewInvite(orderId: string): Promise<void> {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                orderNumber: true,
                profileId: true,
                locale: true,
                customerName: true,
                profile: { select: { email: true, firstName: true } },
                items: {
                    select: {
                        id: true,
                        menuItemId: true,
                        nameSnapshot: true,
                        menuItem: { select: { name: true, nameEs: true, imageUrl: true } },
                    },
                },
            },
        })
        if (!order) return
        const recipient = order.profile?.email?.trim()
        if (!recipient) return
        if (order.items.length === 0) return

        // Filter out products the user has already reviewed
        const alreadyReviewed = await prisma.productReview.findMany({
            where: {
                profileId: order.profileId,
                menuItemId: { in: order.items.map((i) => i.menuItemId) },
            },
            select: { menuItemId: true },
        })
        const reviewedSet = new Set(alreadyReviewed.map((r) => r.menuItemId))

        // Deduplicate items by menuItemId so we don't list "2× X" twice.
        const seen = new Set<string>()
        const pending = order.items.filter((i) => {
            if (reviewedSet.has(i.menuItemId)) return false
            if (seen.has(i.menuItemId)) return false
            seen.add(i.menuItemId)
            return true
        })
        if (pending.length === 0) return

        const locale = pickLocale(order.locale)
        const isEs = locale === "es"

        const items = pending.map((i) => ({
            name: (isEs && i.menuItem?.nameEs) ? i.menuItem.nameEs : (i.menuItem?.name ?? i.nameSnapshot),
            imageUrl: i.menuItem?.imageUrl ?? null,
        }))

        const html = productReviewInviteHtml(
            {
                orderNumber: order.orderNumber,
                customerName: order.customerName ?? order.profile?.firstName ?? "",
                items,
            },
            locale,
        )

        const subject = isEs
            ? `¿Qué tal estuvo tu pedido #${order.orderNumber}?`
            : `How was your order #${order.orderNumber}?`

        await sendOrderEmail(recipient, subject, html)
    } catch (error) {
        // Never block the caller — this is a best-effort invite.
        console.error("[maybeSendProductReviewInvite] failed for order", orderId, error)
    }
}
