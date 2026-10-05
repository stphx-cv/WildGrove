// ══════════════════════════════════════════════════════════════════
// Admin Delivery Zone API — GET + PATCH + DELETE
// /api/delivery-zones/[id]
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateDeliveryZoneSchema } from "@wildgrove/core/admin-validation"
import { Prisma } from "@wildgrove/db"

type RouteContext = { params: Promise<{ id: string }> }

// ── GET — Zone detail ──

export async function GET(_request: NextRequest, { params }: RouteContext) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const zone = await prisma.deliveryZone.findUnique({
            where: { id },
        })

        if (!zone) {
            return NextResponse.json({ success: false, error: "Zone not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: zone })
    } catch (error) {
        console.error("[GET /api/delivery-zones/[id]]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch zone" }, { status: 500 })
    }
}

// ── PATCH — Update zone ──

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const data = updateDeliveryZoneSchema.parse(body)

        const existing = await prisma.deliveryZone.findUnique({ where: { id }, select: { id: true } })
        if (!existing) {
            return NextResponse.json({ success: false, error: "Zone not found" }, { status: 404 })
        }

        const updateData: Prisma.DeliveryZoneUpdateInput = {}

        if (data.name !== undefined) updateData.name = data.name
        if (data.type !== undefined) updateData.type = data.type
        if (data.fee !== undefined) updateData.fee = new Prisma.Decimal(data.fee)
        if (data.feeUsd !== undefined) updateData.feeUsd = new Prisma.Decimal(data.feeUsd)
        if (data.minOrder !== undefined) updateData.minOrder = new Prisma.Decimal(data.minOrder)
        if (data.minOrderUsd !== undefined) updateData.minOrderUsd = new Prisma.Decimal(data.minOrderUsd)
        if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes
        if (data.active !== undefined) updateData.active = data.active
        if (data.priority !== undefined) updateData.priority = data.priority
        if (data.country !== undefined) updateData.country = data.country ?? null
        if (data.region !== undefined) updateData.region = data.region ?? null
        if (data.province !== undefined) updateData.province = data.province ?? null
        if (data.district !== undefined) updateData.district = data.district ?? null
        if (data.centerLat !== undefined) updateData.centerLat = data.centerLat != null ? new Prisma.Decimal(data.centerLat) : null
        if (data.centerLng !== undefined) updateData.centerLng = data.centerLng != null ? new Prisma.Decimal(data.centerLng) : null
        if (data.radiusMeters !== undefined) updateData.radiusMeters = data.radiusMeters ?? null
        if (data.polygon !== undefined) updateData.polygon = data.polygon ?? Prisma.JsonNull

        const zone = await prisma.deliveryZone.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true },
        })

        return NextResponse.json({ success: true, data: zone })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json({ success: false, error: "Validation failed", details: error }, { status: 422 })
        }
        console.error("[PATCH /api/delivery-zones/[id]]", error)
        return NextResponse.json({ success: false, error: "Failed to update delivery zone" }, { status: 500 })
    }
}

// ── DELETE — Delete zone ──

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const existing = await prisma.deliveryZone.findUnique({ where: { id }, select: { id: true } })
        if (!existing) {
            return NextResponse.json({ success: false, error: "Zone not found" }, { status: 404 })
        }

        await prisma.deliveryZone.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[DELETE /api/delivery-zones/[id]]", error)
        return NextResponse.json({ success: false, error: "Failed to delete delivery zone" }, { status: 500 })
    }
}
