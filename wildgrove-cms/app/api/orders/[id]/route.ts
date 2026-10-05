// ══════════════════════════════════════════════════════════════════
// Admin Order Detail API — GET + PATCH /api/orders/[id]
// GET: full order detail (items, events, billing doc, delivery)
// PATCH: status transition OR add staff note OR set estimatedReadyAt
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { orderErrorResponse } from "@/lib/order-error-response"
import { updateOrderSchema } from "@wildgrove/core/admin-validation"
import { OrderService } from "@wildgrove/core/orders/OrderService"
import { OrderStatus } from "@wildgrove/db"

// ── GET ──

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                fulfillment: true,
                currency: true,
                subtotal: true,
                discountTotal: true,
                deliveryFee: true,
                total: true,
                paymentMethod: true,
                paidAt: true,
                scheduledFor: true,
                estimatedReadyAt: true,
                deliveryAddress: true,
                deliveryAddressDetail: true,
                deliveryLat: true,
                deliveryLng: true,
                deliveryZoneId: true,
                deliveryZoneName: true,
                customerPhone: true,
                customerName: true,
                notes: true,
                cancelReason: true,
                locale: true,
                hiddenByUser: true,
                hiddenByAdmin: true,
                createdAt: true,
                updatedAt: true,
                // Billing document
                documentType: true,
                documentSeries: true,
                documentNumber: true,
                buyerDni: true,
                fiscalRuc: true,
                fiscalLegalName: true,
                fiscalAddress: true,
                // Relations
                profile: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phoneCountryCode: true,
                        phoneNumber: true,
                        avatarUrl: true,
                    },
                },
                items: {
                    select: {
                        id: true,
                        nameSnapshot: true,
                        quantity: true,
                        unitPrice: true,
                        lineTotal: true,
                        notes: true,
                        menuItem: { select: { id: true, slug: true } },
                    },
                },
                appliedDiscounts: {
                    select: {
                        amount: true,
                        codeUsed: true,
                        discount: { select: { name: true } },
                    },
                },
                events: {
                    select: {
                        id: true,
                        type: true,
                        message: true,
                        actorId: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: order })
    } catch (error) {
        console.error("[admin/orders/[id] GET]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch order" }, { status: 500 })
    }
}

// ── PATCH ──

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const parsed = updateOrderSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            )
        }

        const { status, note, estimatedReadyAt, hiddenByAdmin } = parsed.data

        // A note on an order that is not there fails on its foreign key, so
        // the order is looked up before any write.
        const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } })
        if (!exists) {
            return NextResponse.json(
                { success: false, error: "Order not found", code: "NOT_FOUND" },
                { status: 404 }
            )
        }

        // Status transition
        if (status) {
            await OrderService.transition(id, status as OrderStatus, auth.userId)
        }

        // Staff note
        if (note) {
            await OrderService.addNote(id, note, auth.userId)
        }

        // Update estimatedReadyAt
        if (estimatedReadyAt !== undefined) {
            await prisma.order.update({
                where: { id },
                data: { estimatedReadyAt: estimatedReadyAt ? new Date(estimatedReadyAt) : null },
            })
        }

        // Hide / unhide from the CMS queue (does not affect the customer)
        if (hiddenByAdmin !== undefined) {
            await prisma.order.update({
                where: { id },
                data: { hiddenByAdmin },
            })
        }

        // Return updated order
        const updated = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                estimatedReadyAt: true,
                hiddenByAdmin: true,
                updatedAt: true,
                events: {
                    select: { id: true, type: true, message: true, actorId: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                },
            },
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        console.error("[admin/orders/[id] PATCH]", error)
        return orderErrorResponse(error, "Failed to update order")
    }
}
