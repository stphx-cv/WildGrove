// ══════════════════════════════════════════════════════════════════
// Admin Delivery Zones API — GET (list) + POST (create)
// /api/delivery-zones
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { deliveryZoneListQuerySchema, createDeliveryZoneSchema } from "@wildgrove/core/admin-validation"
import { Prisma } from "@wildgrove/db"

// ── GET — Paginated zone list ──

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = deliveryZoneListQuerySchema.parse(params)

        const where: Prisma.DeliveryZoneWhereInput = {}
        if (query.search) {
            where.name = { contains: query.search, mode: "insensitive" }
        }
        if (query.type) where.type = query.type
        if (query.active !== undefined) where.active = query.active === "true"

        const skip = (query.page - 1) * query.limit

        const [items, total] = await Promise.all([
            prisma.deliveryZone.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    fee: true,
                    feeUsd: true,
                    minOrder: true,
                    minOrderUsd: true,
                    estimatedMinutes: true,
                    active: true,
                    priority: true,
                    country: true,
                    region: true,
                    province: true,
                    district: true,
                    centerLat: true,
                    centerLng: true,
                    radiusMeters: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: [{ priority: "desc" }, { name: "asc" }],
                skip,
                take: query.limit,
            }),
            prisma.deliveryZone.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                items,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                },
            },
        })
    } catch (error) {
        console.error("[GET /api/delivery-zones]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch delivery zones" }, { status: 500 })
    }
}

// ── POST — Create zone ──

export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const body = await request.json()
        const data = createDeliveryZoneSchema.parse(body)

        const zone = await prisma.deliveryZone.create({
            data: {
                name: data.name,
                type: data.type,
                fee: new Prisma.Decimal(data.fee),
                feeUsd: new Prisma.Decimal(data.feeUsd),
                minOrder: new Prisma.Decimal(data.minOrder ?? 0),
                minOrderUsd: new Prisma.Decimal(data.minOrderUsd ?? 0),
                estimatedMinutes: data.estimatedMinutes ?? 45,
                active: data.active ?? true,
                priority: data.priority ?? 0,
                // AREA
                country: data.country ?? null,
                region: data.region ?? null,
                province: data.province ?? null,
                district: data.district ?? null,
                // POLYGON / RADIUS
                centerLat: data.centerLat != null ? new Prisma.Decimal(data.centerLat) : null,
                centerLng: data.centerLng != null ? new Prisma.Decimal(data.centerLng) : null,
                radiusMeters: data.radiusMeters ?? null,
                polygon: data.polygon ?? Prisma.JsonNull,
            },
            select: { id: true, name: true },
        })

        return NextResponse.json({ success: true, data: zone }, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json({ success: false, error: "Validation failed", details: error }, { status: 422 })
        }
        console.error("[POST /api/delivery-zones]", error)
        return NextResponse.json({ success: false, error: "Failed to create delivery zone" }, { status: 500 })
    }
}
