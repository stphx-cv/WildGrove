// ══════════════════════════════════════════════════════════════════
// POST /api/menu/[id]/drafts
// Clone a published MenuItem into a new draft row referencing it as parent.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { createDraftFromParentSchema } from "@wildgrove/core/admin-validation"

function draftSlugSuffix() {
    // 16 random hex chars — opaque, unique, and never shown to users.
    return randomBytes(8).toString("hex")
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await request.json().catch(() => ({}))
        const input = createDraftFromParentSchema.parse(body ?? {})

        const parent = await prisma.menuItem.findUnique({
            where: { id },
            select: {
                id: true,
                sku: true,
                slug: true,
                slugEs: true,
                name: true,
                nameEs: true,
                description: true,
                descriptionEs: true,
                prices: true,
                categoryId: true,
                imageUrl: true,
                images: true,
                tags: true,
                tagsEs: true,
                tagColors: true,
                ingredients: true,
                ingredientsEs: true,
                order: true,
                featuredOrder: true,
                available: true,
                featured: true,
                isDraft: true,
                parentId: true,
            },
        })

        if (!parent) {
            return NextResponse.json({ success: false, error: "Menu item not found" }, { status: 404 })
        }
        if (parent.isDraft) {
            return NextResponse.json(
                { success: false, error: "Cannot create a draft from another draft" },
                { status: 400 }
            )
        }
        if (parent.parentId) {
            return NextResponse.json(
                { success: false, error: "Parent is itself a draft" },
                { status: 400 }
            )
        }
        if (!parent.slug) {
            return NextResponse.json(
                { success: false, error: "Parent has no slug — cannot derive a draft slug" },
                { status: 500 }
            )
        }

        const suffix = draftSlugSuffix()
        const draftSlug = `${parent.slug}__draft__${suffix}`
        const draftSlugEs = parent.slugEs ? `${parent.slugEs}__draft__${suffix}` : null

        // The draft starts as its parent: same visibility and featured flag, so
        // promoting it untouched leaves the dish as it was. It holds no SKU of its
        // own: the column is unique, and an empty SKU on a child draft means
        // "the parent's" (see the PUT and the promote routes).
        const draft = await prisma.menuItem.create({
            data: {
                sku: null,
                slug: draftSlug,
                slugEs: draftSlugEs,
                name: input.label ?? `${parent.name} (draft)`,
                nameEs: parent.nameEs,
                description: parent.description,
                descriptionEs: parent.descriptionEs,
                prices: parent.prices ?? { PEN: 0, USD: 0 },
                categoryId: parent.categoryId,
                imageUrl: parent.imageUrl,
                images: parent.images,
                tags: parent.tags,
                tagsEs: parent.tagsEs,
                tagColors: parent.tagColors ?? undefined,
                ingredients: parent.ingredients,
                ingredientsEs: parent.ingredientsEs,
                order: parent.order,
                featuredOrder: parent.featuredOrder,
                isDraft: true,
                available: parent.available,
                featured: parent.featured,
                parentId: parent.id,
            },
            select: { id: true, name: true, slug: true, parentId: true },
        })

        return NextResponse.json({ success: true, data: draft }, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Menu Drafts POST] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create draft" },
            { status: 500 }
        )
    }
}
