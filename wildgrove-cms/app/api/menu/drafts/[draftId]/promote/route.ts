// ══════════════════════════════════════════════════════════════════
// POST /api/menu/drafts/[draftId]/promote
// Apply a draft's content onto its parent, then delete the draft.
// Slug + slugEs are preserved on the parent (URLs do not change).
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { getMenuItemPublishBlockedReason } from "@wildgrove/core/admin-validation"
import { revalidatePublic } from "@/lib/revalidate-public"

// Drafts are born as "Name (draft)" and duplicates as "Name (copy)" so they can
// be told apart in the panel's draft list. Those labels never reach the dish:
// a name left untouched publishes as the parent's own name.
const DRAFT_LABEL_SUFFIX = /(?:\s\((?:draft|copy)\))+$/

function publishedName(draftName: string): string {
    const stripped = draftName.replace(DRAFT_LABEL_SUFFIX, "").trim()
    return stripped || draftName
}

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ draftId: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { draftId } = await params

    try {
        const draft = await prisma.menuItem.findUnique({
            where: { id: draftId },
            select: {
                id: true,
                isDraft: true,
                parentId: true,
                sku: true,
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
                available: true,
                featured: true,
                featuredOrder: true,
                order: true,
            },
        })

        if (!draft) {
            return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
        }
        if (!draft.isDraft || !draft.parentId) {
            return NextResponse.json(
                { success: false, error: "Only child drafts can be promoted" },
                { status: 400 }
            )
        }

        // Validate the draft satisfies the publish schema before mutating the parent.
        const blockingReason = getMenuItemPublishBlockedReason(true, {
            name: draft.name,
            description: draft.description,
            prices: draft.prices,
            categoryId: draft.categoryId,
            sku: draft.sku ?? undefined,
            tags: draft.tags,
            available: draft.available,
            featured: draft.featured,
            featuredOrder: draft.featuredOrder,
            order: draft.order,
            imageUrl: draft.imageUrl ?? undefined,
            images: draft.images,
            nameEs: draft.nameEs ?? undefined,
            descriptionEs: draft.descriptionEs ?? undefined,
            tagsEs: draft.tagsEs,
            tagColors: draft.tagColors ?? undefined,
            ingredients: draft.ingredients,
            ingredientsEs: draft.ingredientsEs,
        })
        if (blockingReason) {
            return NextResponse.json(
                { success: false, error: blockingReason },
                { status: 400 }
            )
        }

        // SKU uniqueness check (excludes both parent and the draft itself).
        if (draft.sku) {
            const conflict = await prisma.menuItem.findFirst({
                where: {
                    sku: draft.sku,
                    NOT: [{ id: draft.id }, { id: draft.parentId }],
                },
                select: { id: true },
            })
            if (conflict) {
                return NextResponse.json(
                    { success: false, error: "Product code (SKU) is already in use by another item" },
                    { status: 400 }
                )
            }
        }

        const parentId = draft.parentId

        await prisma.$transaction(async (tx) => {
            // The draft goes first: it may hold the SKU the parent is about to
            // take, and the column is unique. Its content is already read above.
            await tx.menuItem.delete({ where: { id: draft.id } })
            await tx.menuItem.update({
                where: { id: parentId },
                data: {
                    // Copy everything EXCEPT slug, slugEs, id, parentId, createdAt.
                    // An empty SKU on a child draft means "the parent's": keep it.
                    ...(draft.sku && { sku: draft.sku }),
                    name: publishedName(draft.name),
                    nameEs: draft.nameEs,
                    description: draft.description,
                    descriptionEs: draft.descriptionEs,
                    prices: draft.prices ?? { PEN: 0, USD: 0 },
                    categoryId: draft.categoryId,
                    imageUrl: draft.imageUrl,
                    images: draft.images,
                    tags: draft.tags,
                    tagsEs: draft.tagsEs,
                    tagColors: draft.tagColors ?? undefined,
                    ingredients: draft.ingredients,
                    ingredientsEs: draft.ingredientsEs,
                    available: draft.available,
                    featured: draft.featured,
                    featuredOrder: draft.featuredOrder,
                    order: draft.order,
                    isDraft: false,
                },
            })
        })

        await revalidatePublic("menu")
        console.log(`[Menu Draft Promote] draft=${draft.id} → parent=${parentId}`)

        return NextResponse.json({ success: true, data: { id: parentId } })
    } catch (error) {
        console.error("[Admin Menu Draft Promote] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to promote draft" },
            { status: 500 }
        )
    }
}
