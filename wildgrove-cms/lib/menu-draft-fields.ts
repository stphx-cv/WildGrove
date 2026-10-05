// ══════════════════════════════════════════════════════════════════
// The fields a draft save keeps from the menu form, read leniently: a draft
// can be incomplete, so a field that is missing or not valid yet is left out
// instead of failing the save. Shared by the draft update
// (PUT /api/menu/[id]) and the new-dish draft (POST /api/menu).
// ══════════════════════════════════════════════════════════════════

import type { UpdateMenuItemInput } from "@wildgrove/core/admin-validation"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped request body
export function readDraftFields(body: any): UpdateMenuItemInput {
    const pen = body.prices?.PEN !== undefined ? Number(body.prices.PEN) : NaN
    const usd = body.prices?.USD !== undefined ? Number(body.prices.USD) : NaN
    return {
        ...(typeof body.name === "string" && body.name && { name: body.name }),
        ...(typeof body.slug === "string" && /^[a-z0-9-]{2,}$/.test(body.slug) && { slug: body.slug }),
        ...(typeof body.description === "string" && body.description && { description: body.description }),
        ...(isFinite(pen) && pen > 0 && isFinite(usd) && usd > 0 && { prices: { PEN: pen, USD: usd } }),
        ...(typeof body.categoryId === "string" && body.categoryId && { categoryId: body.categoryId }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(Array.isArray(body.images) && { images: body.images }),
        ...(Array.isArray(body.tags) && { tags: body.tags }),
        ...(typeof body.available === "boolean" && { available: body.available }),
        ...(typeof body.featured === "boolean" && { featured: body.featured }),
        ...(Number.isInteger(body.featuredOrder) && { featuredOrder: body.featuredOrder }),
        ...(Number.isInteger(body.order) && { order: body.order }),
        ...(typeof body.sku === "string" && /^[A-Z0-9-]{2,30}$/.test(body.sku) && { sku: body.sku }),
        ...(typeof body.nameEs === "string" && body.nameEs.trim() && { nameEs: body.nameEs }),
        ...(typeof body.descriptionEs === "string" && body.descriptionEs.trim() && { descriptionEs: body.descriptionEs }),
        ...(Array.isArray(body.tagsEs) && { tagsEs: body.tagsEs }),
        ...(body.tagColors && typeof body.tagColors === "object" && !Array.isArray(body.tagColors) && { tagColors: body.tagColors as Record<string, string> }),
        ...(typeof body.slugEs === "string" && /^[a-z0-9-]{2,}$/.test(body.slugEs) && { slugEs: body.slugEs }),
        ...(Array.isArray(body.ingredients) && { ingredients: body.ingredients }),
        ...(Array.isArray(body.ingredientsEs) && { ingredientsEs: body.ingredientsEs }),
    }
}
