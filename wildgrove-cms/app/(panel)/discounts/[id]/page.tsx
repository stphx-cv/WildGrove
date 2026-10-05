// ══════════════════════════════════════════════════════════════════
// Edit Discount Page — /discounts/[id]
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@wildgrove/db"
import { getCategoriesWithItems } from "@/lib/admin/categories"
import { DiscountForm } from "@/components/DiscountForm"

export const metadata: Metadata = {
    title: "Edit Discount",
}

export default async function EditDiscountPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const [discount, categories] = await Promise.all([
        prisma.discount.findUnique({
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
            perUserLimit: true,
            active: true,
            applyToNone: true,
            excludedItemIds: true,
            isDraft: true,
            draftData: true,
        },
        }),
        // Cached: on a hit the page opens no connection for this half.
        getCategoriesWithItems(),
    ])

    if (!discount) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    Edit Discount
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Update &ldquo;{discount.name}&rdquo;
                </p>
            </div>
            <DiscountForm
                categories={categories}
                initialData={{
                    ...discount,
                    type: discount.type === "COUPON" ? "COUPON" : "AUTOMATIC",
                    value: Number(discount.value),
                    valueUsd: discount.valueUsd == null ? null : Number(discount.valueUsd),
                    validFrom: discount.validFrom?.toISOString() ?? null,
                    validUntil: discount.validUntil?.toISOString() ?? null,
                    isDraft: discount.isDraft,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    draftData: discount.draftData as any ?? null,
                }}
            />
        </div>
    )
}
