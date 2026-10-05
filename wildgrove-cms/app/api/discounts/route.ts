// ══════════════════════════════════════════════════════════════════
// Admin Discounts API — GET (list) + POST (create) /api/discounts
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { revalidatePublic } from "@/lib/revalidate-public"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { discountListQuerySchema, createDiscountSchema } from "@wildgrove/core/admin-validation"

// ── GET — Paginated discount list ──

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = discountListQuerySchema.parse(params)

        const where: Record<string, unknown> = {}
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
            ]
        }
        if (query.type) where.type = query.type
        if (query.active !== undefined) where.active = query.active === "true"

        // Draft filter
        if (params.draft === "true") where.isDraft = true
        else if (params.draft === "false") where.isDraft = false

        const [items, total] = await Promise.all([
            prisma.discount.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    type: true,
                    valueType: true,
                    value: true,
                    valueUsd: true,
                    code: true,
                    validFrom: true,
                    validUntil: true,
                    usageLimit: true,
                    usageCount: true,
                    active: true,
                    isDraft: true,
                    createdAt: true,
                },
                orderBy: [{ isDraft: "desc" }, { active: "desc" }, { createdAt: "desc" }],
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.discount.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                items: items.map((item) => ({
                    ...item,
                    value: Number(item.value),
                    valueUsd: item.valueUsd == null ? null : Number(item.valueUsd),
                })),
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                },
            },
        })
    } catch (error) {
        console.error("[Admin Discounts GET] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch discounts" },
            { status: 500 }
        )
    }
}

// ── POST — Create new discount ──

export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const body = await request.json()

        // ── Draft creation (lenient) ──
        if (body.isDraft === true) {
            // Same reading as a draft update: a number that is not above 0 is left out, not stored.
            const draftValue = Number(body.value)
            const draftValueUsd = body.valueUsd != null && body.valueUsd !== "" ? Number(body.valueUsd) : NaN
            const name = (body.name as string) || "Untitled Draft"
            const discount = await prisma.discount.create({
                data: {
                    name,
                    type: (body.type as "COUPON" | "AUTOMATIC") || "AUTOMATIC",
                    valueType: (body.valueType as "PERCENTAGE" | "FIXED_AMOUNT") || "PERCENTAGE",
                    value: Number.isFinite(draftValue) && draftValue > 0 ? draftValue : 0,
                    valueUsd: Number.isFinite(draftValueUsd) && draftValueUsd > 0 ? draftValueUsd : null,
                    isDraft: true,
                    active: false,
                    draftData: body.draftData ?? null,
                    daysOfWeek: [],
                },
                select: { id: true, name: true, isDraft: true },
            })
            return NextResponse.json({ success: true, data: discount }, { status: 201 })
        }

        const data = createDiscountSchema.parse(body)

        // Check for unique coupon code
        if (data.code) {
            const existing = await prisma.discount.findUnique({
                where: { code: data.code },
                select: { id: true },
            })
            if (existing) {
                return NextResponse.json(
                    { success: false, error: "A discount with this code already exists" },
                    { status: 409 }
                )
            }
        }

        const discount = await prisma.discount.create({
            data: {
                name: data.name,
                description: data.description,
                type: data.type,
                valueType: data.valueType,
                value: data.value,
                valueUsd: data.valueType === "FIXED_AMOUNT" ? (data.valueUsd ?? null) : null,
                code: data.code ?? null,
                categoryId: data.categoryId ?? null,
                categoryIds: data.categoryIds ?? [],
                menuItemId: data.menuItemId ?? null,
                validFrom: data.validFrom ? new Date(data.validFrom) : null,
                validUntil: data.validUntil ? new Date(data.validUntil) : null,
                usageLimit: data.usageLimit ?? null,
                perUserLimit: data.perUserLimit ?? null,
                active: data.active,
                applyToNone: data.applyToNone,
                excludedItemIds: data.excludedItemIds ?? [],
            },
            select: {
                id: true,
                name: true,
                type: true,
                code: true,
                active: true,
            },
        })

        // A newly created active AUTOMATIC discount can affect menu prices —
        // drop the cached discount set so the menu reflects it immediately.
        await revalidatePublic("discounts")

        return NextResponse.json(
            { success: true, data: discount },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Discounts POST] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create discount" },
            { status: 500 }
        )
    }
}
