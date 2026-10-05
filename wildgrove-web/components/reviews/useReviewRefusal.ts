"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"

const MAX_PHOTOS = /^Maximum (\d+) photos allowed$/

/**
 * The review endpoints answer in English. This turns a refusal into a message
 * in the page's language: the known ones by their code or text, anything else
 * as the generic message.
 */
export function useReviewRefusal() {
    const t = useTranslations("reviewErrors")

    return useCallback((body: { error?: unknown; code?: unknown } | null | undefined): string => {
        if (body?.code === "REVIEWS_DISABLED") return t("disabled")

        const error = typeof body?.error === "string" ? body.error : ""
        const max = MAX_PHOTOS.exec(error)
        if (max) return t("tooManyPhotos", { max: Number(max[1]) })

        switch (error) {
            case "Not authenticated": return t("loginRequired")
            case "This reservation already has a review":
            case "You have already reviewed this product": return t("alreadyReviewed")
            case "Only completed reservations can be reviewed": return t("reservationNotCompleted")
            case "Only completed orders can be reviewed": return t("orderNotCompleted")
            case "Photos must be uploaded through the review form": return t("photosNotUploaded")
            default: return t("generic")
        }
    }, [t])
}
