// ══════════════════════════════════════════════════════════════════
// Admin Categories [id] API — GET / PATCH / DELETE
// /api/categories/[id]
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { revalidatePublic } from "@/lib/revalidate-public"
import { prisma } from "@wildgrove/db"
import { Prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { CATEGORIES_CACHE_TAG } from "@/lib/cache-tags"
import { updateCategorySchema } from "@wildgrove/core/admin-validation"

// ── GET — Single category ──

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const category = await prisma.menuCategory.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                nameEs: true,
                slug: true,
                slugEs: true,
                icon: true,
                order: true,
                isDraft: true,
                draftData: true,
                _count: { select: { items: true } },
            },
        })

        if (!category) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: { ...category, itemCount: category._count.items, _count: undefined },
        })
    } catch (error) {
        console.error("[Admin Categories GET/:id] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch category" }, { status: 500 })
    }
}

// ── PATCH — Update category ──

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

        // ── Draft-data-only save (don't touch published content) ──
        if (body.saveDraftData === true) {
            const exists = await prisma.menuCategory.findUnique({ where: { id }, select: { id: true } })
            if (!exists) {
                return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
            }
            await prisma.menuCategory.update({
                where: { id },
                data: { draftData: body.draftData ?? null },
            })
            await revalidatePublic(CATEGORIES_CACHE_TAG, "menu")
            return NextResponse.json({ success: true, data: { id } })
        }

        const clearDraft = body.clearDraft === true
        const isDraftUpdate = typeof body.isDraft === "boolean"

        // For drafts, accept partial data without full validation
        const isLenient = body.isDraft === true

        const data = isLenient
            ? {
                  name: typeof body.name === "string" ? body.name : undefined,
                  nameEs: body.nameEs === undefined ? undefined : (body.nameEs || null),
                  slug: typeof body.slug === "string" && body.slug.length > 0 ? body.slug : undefined,
                  slugEs: body.slugEs === undefined ? undefined : (body.slugEs || null),
                  icon: typeof body.icon === "string" ? body.icon : undefined,
                  order: typeof body.order === "number" ? body.order : undefined,
              }
            : updateCategorySchema.parse(body)

        // Check category exists
        const existing = await prisma.menuCategory.findUnique({
            where: { id },
            select: { id: true, slug: true },
        })
        if (!existing) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
        }

        // If slug is changing, check uniqueness
        if (data.slug && data.slug !== existing.slug) {
            const slugConflict = await prisma.menuCategory.findUnique({
                where: { slug: data.slug },
                select: { id: true },
            })
            if (slugConflict && slugConflict.id !== id) {
                return NextResponse.json(
                    { success: false, error: "A category with this slug already exists" },
                    { status: 409 }
                )
            }
        }

        // Auto-generate slug from new name if name is changing but slug is not provided
        let newSlug = data.slug
        if (!isLenient && data.name && !data.slug) {
            const generated = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
            if (generated !== existing.slug) {
                const conflict = await prisma.menuCategory.findUnique({
                    where: { slug: generated },
                    select: { id: true },
                })
                if (!conflict) newSlug = generated
            }
        }

        const updated = await prisma.menuCategory.update({
            where: { id },
            data: {
                ...(data.name   !== undefined && { name: data.name }),
                ...(data.nameEs !== undefined && { nameEs: data.nameEs }),
                ...(newSlug     !== undefined && { slug: newSlug }),
                ...(data.slugEs !== undefined && { slugEs: data.slugEs }),
                ...(data.icon   !== undefined && { icon: data.icon }),
                ...(data.order  !== undefined && { order: data.order }),
                ...(isDraftUpdate && { isDraft: !!body.isDraft }),
                ...(body.draftData !== undefined && !clearDraft && { draftData: body.draftData }),
                ...(clearDraft && { draftData: Prisma.JsonNull }),
            },
            select: { id: true, name: true, nameEs: true, slug: true, slugEs: true, icon: true, order: true, isDraft: true },
        })

        await revalidatePublic(CATEGORIES_CACHE_TAG, "menu")

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Categories PATCH/:id] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 })
    }
}

// ── DELETE — Remove category (only if it has no items) ──

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const category = await prisma.menuCategory.findUnique({
            where: { id },
            select: { id: true, _count: { select: { items: true } } },
        })

        if (!category) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
        }

        if (category._count.items > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot delete: this category has ${category._count.items} item${category._count.items === 1 ? "" : "s"}. Move or delete them first.`,
                },
                { status: 409 }
            )
        }

        await prisma.menuCategory.delete({ where: { id } })
        await revalidatePublic(CATEGORIES_CACHE_TAG, "menu")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Admin Categories DELETE/:id] Error:", error)
        return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
    }
}
