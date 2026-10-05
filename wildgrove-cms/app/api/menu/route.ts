// ══════════════════════════════════════════════════════════════════
// Admin Menu API — GET (list) + POST (create) /api/menu
// All queries use select (never over-fetch) + pagination
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { menuListQuerySchema, createMenuItemSchema } from "@wildgrove/core/admin-validation"
import { revalidatePublic } from "@/lib/revalidate-public"
import { readDraftFields } from "@/lib/menu-draft-fields"
import { slugify } from "@wildgrove/core/slug"

// ── GET — Paginated menu item list ──

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = menuListQuerySchema.parse(params)

        // Build dynamic where clause
        const where: Record<string, unknown> = {}
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
            ]
        }
        if (query.category) {
            where.categoryId = query.category
        }
        if (query.available !== undefined) {
            where.available = query.available === "true"
        }
        // Draft filter
        if (query.draft === "true") where.isDraft = true
        else if (query.draft === "false") where.isDraft = false

        // Parent filter:
        //   ?parent=<id>   → child drafts of that parent
        //   ?parent=null   → top-level rows only (no parent)
        //   (omitted)      → default to parent=null (top-level rows only) so child
        //                   drafts don't leak into the root admin listing.
        if (query.parent === "null" || query.parent === undefined) {
            where.parentId = null
        } else if (query.parent) {
            where.parentId = query.parent
        }

        const [items, total] = await Promise.all([
            prisma.menuItem.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    prices: true,
                    imageUrl: true,
                    tags: true,
                    tagColors: true,
                    available: true,
                    featured: true,
                    featuredOrder: true,
                    order: true,
                    categoryId: true,
                    isDraft: true,
                    parentId: true,
                    category: { select: { id: true, name: true, slug: true } },
                    createdAt: true,
                    updatedAt: true,
                    _count: { select: { drafts: true } },
                },
                orderBy: [{ isDraft: "desc" }, { order: "asc" }, { name: "asc" }],
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.menuItem.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                items: items.map(({ _count, ...item }) => ({
                    ...item,
                    draftsCount: _count.drafts,
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
        console.error("[Admin Menu GET] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch menu items" },
            { status: 500 }
        )
    }
}

// ── POST — Create new menu item ──

export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const body = await request.json()

        // ── Draft creation (lenient, bypasses strict validation) ──
        // Keeps every field the form sent, read with the same rules as a draft
        // save. The address is not taken from the form: a new draft lives at
        // its own `-draft-<timestamp>` slug, with no Spanish one.
        if (body.isDraft === true) {
            const fields = readDraftFields(body)
            const name = fields.name || "Untitled Draft"
            const slugBase = slugify(name) || "draft"
            const slug = `${slugBase}-draft-${Date.now()}`

            if (fields.categoryId) {
                const category = await prisma.menuCategory.findUnique({
                    where: { id: fields.categoryId },
                    select: { id: true },
                })
                if (!category) {
                    return NextResponse.json(
                        { success: false, error: "Category not found" },
                        { status: 400 }
                    )
                }
            }

            if (fields.sku) {
                const skuConflict = await prisma.menuItem.findFirst({
                    where: { sku: fields.sku },
                    select: { id: true },
                })
                if (skuConflict) {
                    return NextResponse.json(
                        { success: false, error: "Product code (SKU) is already in use by another item" },
                        { status: 400 }
                    )
                }
            }

            const item = await prisma.menuItem.create({
                data: {
                    name,
                    slug,
                    description: fields.description || "(Draft — incomplete)",
                    // A price for one currency only is kept; the other stays at 0.
                    prices: fields.prices ?? {
                        PEN: Number(body.prices?.PEN) || 0,
                        USD: Number(body.prices?.USD) || 0,
                    },
                    categoryId: fields.categoryId || null,
                    isDraft: true,
                    available: fields.available ?? false,
                    featured: fields.featured ?? false,
                    ...(fields.featuredOrder !== undefined && { featuredOrder: fields.featuredOrder }),
                    ...(fields.order !== undefined && { order: fields.order }),
                    tags: fields.tags ?? [],
                    imageUrl: fields.imageUrl || null,
                    images: fields.images ?? [],
                    sku: fields.sku || null,
                    nameEs: fields.nameEs || null,
                    descriptionEs: fields.descriptionEs || null,
                    tagsEs: fields.tagsEs ?? [],
                    ...(fields.tagColors !== undefined && { tagColors: fields.tagColors }),
                    ingredients: fields.ingredients ?? [],
                    ingredientsEs: fields.ingredientsEs ?? [],
                },
                select: { id: true, name: true, isDraft: true },
            })

            return NextResponse.json({ success: true, data: item }, { status: 201 })
        }

        const data = createMenuItemSchema.parse(body)

        // Verify category exists
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

        // Check SKU uniqueness
        const skuConflict = await prisma.menuItem.findFirst({
            where: { sku: data.sku },
            select: { id: true },
        })
        if (skuConflict) {
            return NextResponse.json(
                { success: false, error: "Product ID is already in use by another item" },
                { status: 400 }
            )
        }

        // Auto-generate slug from name if not provided
        const slug = data.slug || slugify(data.name)
        const slugConflict = await prisma.menuItem.findUnique({ where: { slug }, select: { id: true } })
        if (slugConflict) {
            return NextResponse.json(
                { success: false, error: "A menu item with this slug already exists" },
                { status: 409 }
            )
        }

        // Check slugEs uniqueness if provided
        if (data.slugEs) {
            const slugEsConflict = await prisma.menuItem.findUnique({ where: { slugEs: data.slugEs }, select: { id: true } })
            if (slugEsConflict) {
                return NextResponse.json(
                    { success: false, error: "A menu item with this Spanish URL already exists" },
                    { status: 409 }
                )
            }
        }

        const item = await prisma.menuItem.create({
            data: {
                name: data.name,
                slug,
                description: data.description,
                prices: data.prices,
                categoryId: data.categoryId,
                imageUrl: data.imageUrl || null,
                images: data.images,
                tags: data.tags,
                available: data.available,
                featured: data.featured,
                featuredOrder: data.featuredOrder,
                order: data.order,
                sku: data.sku,
                nameEs:        data.nameEs || null,
                descriptionEs: data.descriptionEs || null,
                tagsEs:        data.tagsEs ?? [],
                tagColors:     data.tagColors ?? {},
                slugEs:        data.slugEs || null,
                ingredients:   data.ingredients   ?? [],
                ingredientsEs: data.ingredientsEs ?? [],
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

        return NextResponse.json(
            {
                success: true,
                data: item,
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Menu POST] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create menu item" },
            { status: 500 }
        )
    }
}
