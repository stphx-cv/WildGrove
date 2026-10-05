// ══════════════════════════════════════════════════════════════════
// Admin Menu Item API — GET, PUT, DELETE /api/menu/[id]
// Single item operations with cache revalidation
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateMenuItemSchema, type UpdateMenuItemInput } from "@wildgrove/core/admin-validation"
import { revalidatePublic } from "@/lib/revalidate-public"
import { readDraftFields } from "@/lib/menu-draft-fields"
import { deleteUnusedMenuImages } from "@wildgrove/core/storage-cleanup"

// ── GET — Single menu item with all fields ──

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
        const item = await prisma.menuItem.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                nameEs: true,
                description: true,
                descriptionEs: true,
                prices: true,
                imageUrl: true,
                images: true,
                tags: true,
                tagsEs: true,
                tagColors: true,
                available: true,
                featured: true,
                featuredOrder: true,
                order: true,
                categoryId: true,
                sku: true,
                slug: true,
                slugEs: true,
                isDraft: true,
                parentId: true,
                category: { select: { id: true, name: true, slug: true } },
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!item) {
            return NextResponse.json(
                { success: false, error: "Menu item not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: item,
        })
    } catch (error) {
        console.error("[Admin Menu GET/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch menu item" },
            { status: 500 }
        )
    }
}

// ── PUT — Update menu item ──

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

        // Look up the current row early — we need to know if it's a child draft
        // (parentId != null) so we can enforce slug/promotion rules.
        const existingRow = await prisma.menuItem.findUnique({
            where: { id },
            select: { id: true, parentId: true, parent: { select: { sku: true } } },
        })
        if (!existingRow) {
            return NextResponse.json({ success: false, error: "Menu item not found" }, { status: 404 })
        }
        const isChildDraft = existingRow.parentId !== null

        // Reject attempts to publish a child draft directly — must go through promote.
        if (isChildDraft && body.isDraft === false) {
            return NextResponse.json(
                { success: false, error: "Use the promote endpoint to apply this draft to its parent." },
                { status: 400 }
            )
        }

        // Child drafts inherit their parent's slug — silently drop any slug from the body.
        if (isChildDraft) {
            delete body.slug
            delete body.slugEs
        }

        const isDraftUpdate = body.isDraft === true

        // Lenient path for draft saves: accept partial/incomplete fields without strict Zod validation
        let data: UpdateMenuItemInput
        if (isDraftUpdate) {
            data = readDraftFields(body)
        } else {
            data = updateMenuItemSchema.parse(body)
        }

        // A child draft uses its parent's SKU without holding it: the column is
        // unique while both rows exist. The parent's SKU is saved as an empty SKU,
        // and promotion keeps the parent's.
        if (isChildDraft && data.sku && data.sku === existingRow.parent?.sku) {
            data = { ...data, sku: "" }
        }

        // If category is being changed, verify it exists
        if (data.categoryId) {
            const category = await prisma.menuCategory.findUnique({
                where: { id: data.categoryId },
                select: { id: true },
            })
            if (!category) {
                return NextResponse.json(
                    { success: false, error: "Category not found" },
                    { status: 400 }
                )
            }
        }

        // Check SKU uniqueness if being changed
        if (data.sku) {
            const skuConflict = await prisma.menuItem.findFirst({
                where: { sku: data.sku, NOT: { id } },
                select: { id: true },
            })
            if (skuConflict) {
                return NextResponse.json(
                    { success: false, error: "Product code (SKU) is already in use by another item" },
                    { status: 400 }
                )
            }
        }

        // Check slug uniqueness if being changed
        if (data.slug) {
            const slugConflict = await prisma.menuItem.findUnique({
                where: { slug: data.slug },
                select: { id: true },
            })
            if (slugConflict && slugConflict.id !== id) {
                return NextResponse.json(
                    { success: false, error: "A menu item with this URL already exists" },
                    { status: 409 }
                )
            }
        }

        // Check slugEs uniqueness if being changed
        if (data.slugEs) {
            const slugEsConflict = await prisma.menuItem.findFirst({
                where: { slugEs: data.slugEs, NOT: { id } },
                select: { id: true },
            })
            if (slugEsConflict) {
                return NextResponse.json(
                    { success: false, error: "A menu item with this Spanish URL already exists" },
                    { status: 409 }
                )
            }
        }

        const updated = await prisma.menuItem.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.slug !== undefined && { slug: data.slug }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.prices !== undefined && { prices: data.prices }),
                ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
                ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
                ...(data.images !== undefined && { images: data.images }),
                ...(data.tags !== undefined && { tags: data.tags }),
                ...(data.available !== undefined && { available: data.available }),
                ...(data.featured !== undefined && { featured: data.featured }),
                ...(data.featuredOrder !== undefined && { featuredOrder: data.featuredOrder }),
                ...(data.order !== undefined && { order: data.order }),
                ...(data.sku !== undefined && { sku: data.sku || null }),
                ...(data.nameEs !== undefined && { nameEs: data.nameEs || null }),
                ...(data.descriptionEs !== undefined && { descriptionEs: data.descriptionEs || null }),
                ...(data.tagsEs !== undefined && { tagsEs: data.tagsEs }),
                ...(data.tagColors !== undefined && { tagColors: data.tagColors }),
                ...(data.slugEs !== undefined && { slugEs: data.slugEs || null }),
                ...(data.ingredients   !== undefined && { ingredients:   data.ingredients }),
                ...(data.ingredientsEs !== undefined && { ingredientsEs: data.ingredientsEs }),
                // Draft fields
                ...(body.isDraft !== undefined && { isDraft: !!body.isDraft }),
            },
            select: {
                id: true,
                name: true,
                prices: true,
                available: true,
                category: { select: { name: true } },
            },
        })

        await revalidatePublic("menu")

        return NextResponse.json({
            success: true,
            data: updated,
        })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Menu PUT/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update menu item" },
            { status: 500 }
        )
    }
}

// ── DELETE — Remove menu item and its image from Storage ──

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
        // The item plus any draft children: the FK cascade deletes them, so
        // their photos are collected first.
        const item = await prisma.menuItem.findUnique({
            where: { id },
            select: { id: true, imageUrl: true, images: true },
        })

        if (!item) {
            return NextResponse.json(
                { success: false, error: "Menu item not found" },
                { status: 404 }
            )
        }

        const draftChildren = await prisma.menuItem.findMany({
            where: { parentId: id },
            select: { imageUrl: true, images: true },
        })

        await prisma.menuItem.delete({ where: { id } })

        // After the rows are gone, delete only the photos nothing else uses: a
        // draft shares its dish's photos, and chat messages keep them too.
        await deleteUnusedMenuImages([
            item.imageUrl,
            ...item.images,
            ...draftChildren.flatMap((d) => [d.imageUrl, ...d.images]),
        ])

        await revalidatePublic("menu")

        return NextResponse.json({ success: true, data: { id } })
    } catch (error) {
        console.error("[Admin Menu DELETE/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete menu item" },
            { status: 500 }
        )
    }
}
