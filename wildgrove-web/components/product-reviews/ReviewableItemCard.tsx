"use client"

import { useState } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { useTranslations } from "next-intl"
import { ProductReviewForm } from "./ProductReviewForm"
import { PhotoIcon, StarSolidIcon } from "@wildgrove/ui/icons"

interface ReviewableItemCardProps {
    orderItemId: string
    menuItemId: string
    name: string
    imageUrl: string | null
    orderNumber: number
    orderDate: string | Date
    maxPhotos: number
}

export function ReviewableItemCard({
    orderItemId,
    menuItemId,
    name,
    imageUrl,
    orderNumber,
    orderDate,
    maxPhotos,
}: ReviewableItemCardProps) {
    const t = useTranslations("productReviews")
    const [open, setOpen] = useState(false)
    const [hidden, setHidden] = useState(false)

    if (hidden) return null

    return (
        <div className="rounded-card bg-wg-surface dark:bg-wg-dark-raised border border-wg-border/50 dark:border-wg-dark-border overflow-hidden">
            <div className="flex items-center gap-4 p-4">
                <div className="relative w-16 h-16 rounded-brand overflow-hidden bg-wg-bg dark:bg-wg-dark-bg flex-shrink-0 border border-wg-border/50 dark:border-wg-dark-border">
                    {imageUrl ? (
                        <FadeInImage src={imageUrl} alt={name} fill className="object-cover" sizes="64px" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <PhotoIcon className="w-6 h-6 text-wg-muted/40 dark:text-wg-dark-muted/40" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">{name}</p>
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                        #{orderNumber} ·{" "}
                        {new Date(orderDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                </div>

                {!open && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-brand text-xs font-medium bg-wg-primary hover:bg-wg-primary/90 dark:bg-wg-dark-primary dark:hover:bg-wg-dark-primary/90 text-white transition-colors shadow-card"
                    >
                        <StarSolidIcon className="w-3.5 h-3.5" />
                        {t("rateThisDish")}
                    </button>
                )}
            </div>

            {open && (
                <div className="border-t border-wg-border/50 dark:border-wg-dark-border p-4 sm:p-6 bg-wg-bg dark:bg-wg-dark-bg">
                    <ProductReviewForm
                        menuItemId={menuItemId}
                        orderItemId={orderItemId}
                        productName={name}
                        maxPhotos={maxPhotos}
                        onSuccess={() => setTimeout(() => setHidden(true), 2200)}
                        onCancel={() => setOpen(false)}
                    />
                </div>
            )}
        </div>
    )
}
