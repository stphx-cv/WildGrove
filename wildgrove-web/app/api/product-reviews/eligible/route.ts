// ══════════════════════════════════════════════════════════════════
// Product Reviews — items the current user is eligible to review
// (purchased in a COMPLETED order and not yet reviewed by them).
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"

export async function GET() {
    const insforge = await createClient()
    const { data: { user }, error: authError } = await insforge.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    try {
        // All order items from COMPLETED orders for this user.
        const orderItems = await prisma.orderItem.findMany({
            where: { order: { profileId: user.id, status: "COMPLETED" } },
            select: {
                id: true,
                menuItemId: true,
                nameSnapshot: true,
                order: { select: { id: true, orderNumber: true, createdAt: true } },
                menuItem: {
                    select: {
                        id: true,
                        slug: true,
                        slugEs: true,
                        name: true,
                        nameEs: true,
                        imageUrl: true,
                    },
                },
            },
            orderBy: { order: { createdAt: "desc" } },
        })

        // Reviews this user has already left.
        const existing = await prisma.productReview.findMany({
            where: { profileId: user.id },
            select: { menuItemId: true },
        })
        const reviewedSet = new Set(existing.map((r) => r.menuItemId))

        // Deduplicate by menuItem — keep most recent OrderItem per product.
        const seen = new Set<string>()
        const eligible = orderItems
            .filter((oi) => !reviewedSet.has(oi.menuItemId) && oi.menuItem !== null)
            .filter((oi) => {
                if (seen.has(oi.menuItemId)) return false
                seen.add(oi.menuItemId)
                return true
            })

        return NextResponse.json({
            success: true,
            data: {
                items: eligible.map((oi) => ({
                    orderItemId: oi.id,
                    menuItemId: oi.menuItemId,
                    nameSnapshot: oi.nameSnapshot,
                    name: oi.menuItem?.name ?? oi.nameSnapshot,
                    nameEs: oi.menuItem?.nameEs ?? null,
                    slug: oi.menuItem?.slug ?? null,
                    slugEs: oi.menuItem?.slugEs ?? null,
                    imageUrl: oi.menuItem?.imageUrl ?? null,
                    orderId: oi.order.id,
                    orderNumber: oi.order.orderNumber,
                    orderDate: oi.order.createdAt,
                })),
            },
        })
    } catch (error) {
        console.error("[Product Reviews eligible] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to load eligible items" }, { status: 500 })
    }
}
