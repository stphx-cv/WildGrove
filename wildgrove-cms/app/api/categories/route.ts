// ══════════════════════════════════════════════════════════════════
// Admin Categories API — GET (list) + POST (create) /api/categories
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { CATEGORIES_CACHE_TAG } from "@/lib/cache-tags"
import { getCategories } from "@/lib/admin/categories"
import { revalidatePublic } from "@/lib/revalidate-public"
import { createCategorySchema } from "@wildgrove/core/admin-validation"
import { slugify } from "@wildgrove/core/slug"

// ── GET — List categories with item count ──

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const categories = await getCategories(request.nextUrl.searchParams.get("draft"))

        return NextResponse.json({
            success: true,
            data: categories.map((cat) => ({
                ...cat,
                itemCount: cat._count.items,
                _count: undefined,
            })),
        })
    } catch (error) {
        console.error("[Admin Categories GET] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch categories" },
            { status: 500 }
        )
    }
}

// ── POST — Create new category ──

export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const body = await request.json()

        // ── Draft creation (lenient, bypasses strict validation) ──
        if (body.isDraft === true) {
            const name = (body.name as string)?.trim() || "Untitled Draft"
            const slugBase =
                (body.slug as string)?.trim() ||
                slugify(name) ||
                "category"
            const slug = `${slugBase}-draft-${Date.now()}`

            const category = await prisma.menuCategory.create({
                data: {
                    name,
                    nameEs: (body.nameEs as string) || null,
                    slug,
                    slugEs: null,
                    icon: (body.icon as string) || "default",
                    order: typeof body.order === "number" ? body.order : 0,
                    isDraft: true,
                    draftData: body.draftData ?? null,
                },
                select: { id: true, name: true, isDraft: true },
            })

            await revalidatePublic(CATEGORIES_CACHE_TAG, "menu")
            return NextResponse.json({ success: true, data: category }, { status: 201 })
        }

        const data = createCategorySchema.parse(body)

        // Auto-generate slug from name if not provided
        const slug = data.slug ?? slugify(data.name)

        // Check for unique slug
        const existing = await prisma.menuCategory.findUnique({
            where: { slug },
            select: { id: true },
        })
        if (existing) {
            return NextResponse.json(
                { success: false, error: "A category with this slug already exists" },
                { status: 409 }
            )
        }

        const category = await prisma.menuCategory.create({
            data: {
                name: data.name,
                nameEs: data.nameEs ?? null,
                slug,
                slugEs: data.slugEs ?? null,
                icon: data.icon ?? "default",
                order: data.order,
            },
            select: { id: true, name: true, nameEs: true, slug: true, slugEs: true, icon: true, order: true },
        })

        await revalidatePublic(CATEGORIES_CACHE_TAG, "menu")

        return NextResponse.json(
            { success: true, data: category },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Categories POST] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create category" },
            { status: 500 }
        )
    }
}
