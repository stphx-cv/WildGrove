"use client"

import { useId, useState } from "react"
import { useTranslations } from "next-intl"
import { StarRatingInput } from "./StarRatingInput"
import { ReviewPhotoUploader, discardReviewPhotos, uploadReviewPhotos, type ReviewPhoto } from "./ReviewPhotoUploader"
import { Textarea } from "@wildgrove/ui/Textarea"
import { useReviewRefusal } from "./useReviewRefusal"
import { CheckCircleIcon } from "@wildgrove/ui/icons"

interface ReviewFormProps {
    reservationId: string
    onSuccess?: () => void
    maxPhotos?: number
}

export function ReviewForm({ reservationId, onSuccess, maxPhotos = 0 }: ReviewFormProps) {
    const t = useTranslations("reviews")
    const tPhotos = useTranslations("reviewPhotos")
    const tErrors = useTranslations("reviewErrors")
    const refusal = useReviewRefusal()
    const fieldId = useId()
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState("")
    const [photos, setPhotos] = useState<ReviewPhoto[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (rating === 0 || comment.length < 10) return

        setSubmitting(true)
        setError("")

        // The photos are uploaded now, right before the review. If the review
        // is not saved, the ones uploaded here are discarded.
        setUploading(true)
        const upload = await uploadReviewPhotos(photos).catch(() => null)
        setUploading(false)
        if (!upload) {
            setError(tPhotos("errorUpload"))
            setSubmitting(false)
            return
        }
        const { urls: photoUrls, uploaded } = upload

        try {
            const res = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservationId, rating, comment, photos: photoUrls }),
            })
            const json = await res.json()

            if (json.success) {
                setSuccess(true)
                onSuccess?.()
            } else {
                discardReviewPhotos(uploaded)
                setError(refusal(json))
            }
        } catch {
            discardReviewPhotos(uploaded)
            setError(tErrors("network"))
        } finally {
            setSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className="p-6 rounded-card bg-wg-primary/10 dark:bg-wg-dark-primary/15 border border-wg-primary/20 dark:border-wg-dark-primary/20 text-center">
                <CheckCircleIcon className="w-10 h-10 text-wg-primary dark:text-wg-dark-primary mx-auto mb-3" />
                <p className="text-sm text-wg-text dark:text-wg-dark-text font-medium">
                    {t("successMessage")}
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="p-6 rounded-card bg-wg-bg dark:bg-wg-dark-bg border border-wg-border/50 dark:border-wg-dark-border">
            <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-4">
                {t("formTitle")}
            </h3>

            {/* Rating */}
            <div className="mb-4">
                <label id={`${fieldId}-rating-label`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("ratingLabel")}
                </label>
                <StarRatingInput value={rating} onChange={setRating} disabled={submitting} labelledBy={`${fieldId}-rating-label`} />
            </div>

            {/* Comment */}
            <div className="mb-4">
                <label htmlFor={`${fieldId}-comment`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                    {t("commentLabel")}
                </label>
                <Textarea
                    id={`${fieldId}-comment`}
                    maxHeight={280}
                    value={comment}
                    onChange={setComment}
                    placeholder={t("commentPlaceholder")}
                    disabled={submitting}
                    minRows={4}
                    className="px-4 py-3 rounded-brand bg-wg-surface dark:bg-wg-dark-raised border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text text-sm placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-primary/30 dark:focus:ring-wg-dark-primary/30 transition-colors disabled:opacity-50"
                />
            </div>

            {/* Photos */}
            {maxPhotos > 0 && (
                <div className="mb-4">
                    <label id={`${fieldId}-photos-label`} htmlFor={`${fieldId}-photos`} className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">
                        {t("photosLabel")}{" "}
                        <span className="text-wg-muted dark:text-wg-dark-muted font-normal text-xs">({t("photosOptional")})</span>
                    </label>
                    <ReviewPhotoUploader
                        id={`${fieldId}-photos`}
                        labelledBy={`${fieldId}-photos-label`}
                        photos={photos}
                        onChange={setPhotos}
                        maxPhotos={maxPhotos}
                        disabled={submitting}
                    />
                </div>
            )}

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            )}

            <button
                type="submit"
                disabled={submitting || rating === 0 || comment.length < 10}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-brand bg-wg-primary hover:bg-wg-primary/90 dark:bg-wg-dark-primary dark:hover:bg-wg-dark-primary/90 text-white text-sm font-medium transition-colors shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {uploading ? tPhotos("uploading") : submitting ? t("submitting") : t("submitButton")}
            </button>
        </form>
    )
}
