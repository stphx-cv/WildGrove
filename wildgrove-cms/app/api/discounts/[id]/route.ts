// ══════════════════════════════════════════════════════════════════
// Admin Discount Item API — GET, PUT, DELETE /api/discounts/[id]
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { revalidatePublic } from "@/lib/revalidate-public"
import { prisma } from "@wildgrove/db"
import { Prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateDiscountSchema, type UpdateDiscountInput } from "@wildgrove/core/admin-validation"

// ── GET — Single discount with recent applications ──

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
        const discount = await prisma.discount.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                valueType: true,
                value: true,
                valueUsd: true,
                code: true,
                categoryId: true,
                categoryIds: true,
                menuItemId: true,
                validFrom: true,
                validUntil: true,
                usageLimit: true,
                usageCount: true,
                perUserLimit: true,
                active: true,
                applyToNone: true,
                excludedItemIds: true,
                isDraft: true,
                draftData: true,
                createdAt: true,
                updatedAt: true,
                applications: {
                    select: {
                        id: true,
                        profileId: true,
                        reservationId: true,
                        appliedAt: true,
                    },
                    orderBy: { appliedAt: "desc" },
                    take: 10,
                },
            },
        })

        if (!discount) {
            return NextResponse.json(
                { success: false, error: "Discount not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                ...discount,
                value: Number(discount.value),
                valueUsd: discount.valueUsd == null ? null : Number(discount.valueUsd),
            },
        })
    } catch (error) {
        console.error("[Admin Discounts GET/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch discount" },
            { status: 500 }
        )
    }
}

// ── PUT — Update discount ──

export async function PUT(
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

        // ── Draft-data-only save ──
        if (body.saveDraftData === true) {
            const exists = await prisma.discount.findUnique({ where: { id }, select: { id: true } })
            if (!exists) {
                return NextResponse.json({ success: false, error: "Discount not found" }, { status: 404 })
            }
            await prisma.discount.update({
                where: { id },
                data: { draftData: body.draftData ?? null },
            })
            return NextResponse.json({ success: true, data: { id } })
        }

        const clearDraft = body.clearDraft === true
        const isDraftUpdate = body.isDraft === true

        // Lenient path for draft saves: accept partial/incomplete fields without strict Zod validation
        let data: UpdateDiscountInput
        if (isDraftUpdate) {
            const val = body.value !== undefined ? Number(body.value) : NaN
            const valUsd = body.valueUsd !== undefined && body.valueUsd !== null && body.valueUsd !== ""
                ? Number(body.valueUsd)
                : NaN
            data = {
                ...(typeof body.name === "string" && body.name && { name: body.name }),
                ...(typeof body.description === "string" && { description: body.description }),
                ...((body.type === "COUPON" || body.type === "AUTOMATIC") && { type: body.type }),
                ...((body.valueType === "PERCENTAGE" || body.valueType === "FIXED_AMOUNT") && { valueType: body.valueType }),
                ...(isFinite(val) && val > 0 && { value: val }),
                ...(isFinite(valUsd) && valUsd > 0 && { valueUsd: valUsd }),
                ...(body.valueUsd === null && { valueUsd: null }),
                ...(typeof body.code === "string" && body.code.trim() && { code: body.code.toUpperCase() }),
                ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
                ...(Array.isArray(body.categoryIds) && { categoryIds: body.categoryIds }),
                ...(body.menuItemId !== undefined && { menuItemId: body.menuItemId }),
                ...(typeof body.validFrom === "string" && body.validFrom && { validFrom: body.validFrom }),
                ...(typeof body.validUntil === "string" && body.validUntil && { validUntil: body.validUntil }),
                ...(Number.isInteger(body.usageLimit) && body.usageLimit > 0 && { usageLimit: body.usageLimit }),
                ...(Number.isInteger(body.perUserLimit) && body.perUserLimit > 0 && { perUserLimit: body.perUserLimit }),
                ...(typeof body.active === "boolean" && { active: body.active }),
                ...(typeof body.applyToNone === "boolean" && { applyToNone: body.applyToNone }),
                ...(Array.isArray(body.excludedItemIds) && { excludedItemIds: body.excludedItemIds }),
            }
        } else {
            data = updateDiscountSchema.parse(body)
        }

        const existing = await prisma.discount.findUnique({
            where: { id },
            select: { id: true, isDraft: true, value: true, valueUsd: true, valueType: true },
        })
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Discount not found" },
                { status: 404 }
            )
        }

        // Publishing a draft goes live with whatever value it holds, so that value has to be
        // one the create form would accept even when this request does not send it.
        if (existing.isDraft && body.isDraft === false) {
            const value = data.value ?? Number(existing.value)
            const valueType = data.valueType ?? existing.valueType
            const valueUsd = data.valueUsd !== undefined ? data.valueUsd : existing.valueUsd == null ? null : Number(existing.valueUsd)
            const problem =
                !(value > 0) ? "Value must be positive"
                : valueType === "PERCENTAGE" && value > 100 ? "Percentage cannot exceed 100"
                : valueType === "FIXED_AMOUNT" && !(valueUsd != null && valueUsd > 0) ? "USD amount is required"
                : null
            if (problem) {
                return NextResponse.json({ success: false, error: problem }, { status: 400 })
            }
        }

        // If code is being changed, check uniqueness
        if (data.code) {
            const codeConflict = await prisma.discount.findFirst({
                where: { code: data.code, NOT: { id } },
                select: { id: true },
            })
            if (codeConflict) {
                return NextResponse.json(
                    { success: false, error: "A discount with this code already exists" },
                    { status: 409 }
                )
            }
        }

        const updated = await prisma.discount.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.type !== undefined && { type: data.type }),
                ...(data.valueType !== undefined && { valueType: data.valueType }),
                ...(data.value !== undefined && { value: data.value }),
                ...(data.valueUsd !== undefined && { valueUsd: data.valueUsd }),
                ...(data.code !== undefined && { code: data.code ?? null }),
                ...(data.categoryId !== undefined && { categoryId: data.categoryId ?? null }),
                ...(data.categoryIds !== undefined && { categoryIds: data.categoryIds }),
                ...(data.menuItemId !== undefined && { menuItemId: data.menuItemId ?? null }),
                ...(data.validFrom !== undefined && { validFrom: data.validFrom ? new Date(data.validFrom) : null }),
                ...(data.validUntil !== undefined && { validUntil: data.validUntil ? new Date(data.validUntil) : null }),
                ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit ?? null }),
                ...(data.perUserLimit !== undefined && { perUserLimit: data.perUserLimit ?? null }),
                ...(data.active !== undefined && { active: data.active }),
                ...(data.applyToNone !== undefined && { applyToNone: data.applyToNone }),
                ...(data.excludedItemIds !== undefined && { excludedItemIds: data.excludedItemIds }),
                // Draft fields
                ...(body.isDraft !== undefined && { isDraft: !!body.isDraft }),
                ...(body.draftData !== undefined && !clearDraft && { draftData: body.draftData }),
                ...(clearDraft && { draftData: Prisma.JsonNull }),
            },
            select: { id: true, name: true, active: true },
        })

        // Updating an AUTOMATIC discount (value, active flag, dates…) can change
        // menu prices — drop the cached discount set so the change is reflected.
        await revalidatePublic("discounts")

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Discounts PUT/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update discount" },
            { status: 500 }
        )
    }
}

// ── DELETE — Hard delete discount ──

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const existing = await prisma.discount.findUnique({
            where: { id },
            select: { id: true, _count: { select: { applications: true } } },
        })
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Discount not found" },
                { status: 404 }
            )
        }

        // Delete related applications first, then the discount
        await prisma.$transaction([
            prisma.discountApplication.deleteMany({ where: { discountId: id } }),
            prisma.discount.delete({ where: { id } }),
        ])

        // Removing a discount can change menu prices — drop the cached set.
        await revalidatePublic("discounts")

        return NextResponse.json({ success: true, data: { id } })
    } catch (error) {
        console.error("[Admin Discounts DELETE/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete discount" },
            { status: 500 }
        )
    }
}
