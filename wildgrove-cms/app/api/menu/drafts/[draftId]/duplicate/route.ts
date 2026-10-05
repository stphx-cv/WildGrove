// ══════════════════════════════════════════════════════════════════
// POST /api/menu/drafts/[draftId]/duplicate
// Copy a draft. Two modes:
//   sibling → new draft under the same parent (requires source has parentId)
//   orphan  → new standalone draft (parentId = null), eventually publishable
//             as a new product on its own.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { duplicateDraftSchema } from "@wildgrove/core/admin-validation"
import { slugify } from "@wildgrove/core/slug"

function suffix() {
    return randomBytes(8).toString("hex")
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ draftId: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { draftId } = await params

    try {
        const body = await request.json().catch(() => ({}))
        const input = duplicateDraftSchema.parse(body)

        const source = await prisma.menuItem.findUnique({
            where: { id: draftId },
            select: {
                id: true,
                isDraft: true,
                parentId: true,
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
                parent: { select: { slug: true, slugEs: true, available: true, featured: true } },
            },
        })

        if (!source) {
            return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
        }
        if (!source.isDraft) {
            return NextResponse.json(
                { success: false, error: "Source row is not a draft" },
                { status: 400 }
            )
        }

        if (input.mode === "sibling") {
            if (!source.parentId || !source.parent) {
                return NextResponse.json(
                    { success: false, error: "Cannot duplicate as sibling: source has no parent" },
                    { status: 400 }
                )
            }
            const sfx = suffix()
            const draft = await prisma.menuItem.create({
                data: {
                    sku: null,
                    slug: `${source.parent.slug}__draft__${sfx}`,
                    slugEs: source.parent.slugEs ? `${source.parent.slugEs}__draft__${sfx}` : null,
                    name: input.label ?? `${source.name} (copy)`,
                    nameEs: source.nameEs,
                    description: source.description,
                    descriptionEs: source.descriptionEs,
                    prices: source.prices ?? { PEN: 0, USD: 0 },
                    categoryId: source.categoryId,
                    imageUrl: source.imageUrl,
                    images: source.images,
                    tags: source.tags,
                    tagsEs: source.tagsEs,
                    tagColors: source.tagColors ?? undefined,
                    ingredients: source.ingredients,
                    ingredientsEs: source.ingredientsEs,
                    order: source.order,
                    featuredOrder: source.featuredOrder,
                    isDraft: true,
                    // A sibling starts as the parent, like a draft created from it.
                    available: source.parent.available,
                    featured: source.parent.featured,
                    parentId: source.parentId,
                },
                select: { id: true, name: true, parentId: true },
            })
            return NextResponse.json({ success: true, data: draft }, { status: 201 })
        }

        // Orphan mode: independent draft with its own slug.
        const baseName = input.label ?? `${source.name} (copy)`
        const baseSlug = slugify(baseName) || "draft"
        let slug = `${baseSlug}-draft-${Date.now()}`
        // Defensive: in the unlikely event of a collision, append a random suffix.
        if (await prisma.menuItem.findUnique({ where: { slug }, select: { id: true } })) {
            slug = `${baseSlug}-draft-${Date.now()}-${suffix()}`
        }

        const draft = await prisma.menuItem.create({
            data: {
                sku: null,
                slug,
                slugEs: null,
                name: baseName,
                nameEs: source.nameEs,
                description: source.description,
                descriptionEs: source.descriptionEs,
                prices: source.prices ?? { PEN: 0, USD: 0 },
                categoryId: source.categoryId,
                imageUrl: source.imageUrl,
                images: source.images,
                tags: source.tags,
                tagsEs: source.tagsEs,
                tagColors: source.tagColors ?? undefined,
                ingredients: source.ingredients,
                ingredientsEs: source.ingredientsEs,
                order: source.order,
                featuredOrder: source.featuredOrder,
                isDraft: true,
                available: false,
                featured: false,
                parentId: null,
            },
            select: { id: true, name: true, parentId: true },
        })
        return NextResponse.json({ success: true, data: draft }, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Menu Draft Duplicate] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to duplicate draft" },
            { status: 500 }
        )
    }
}
