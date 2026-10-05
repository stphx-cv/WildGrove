import type { CSSProperties } from "react"
import type { PublicReviewCardData } from "@wildgrove/core/reviews/types"
import { ReviewPhotoGallery } from "@/components/reviews/ReviewPhotoGallery"
import { ReviewerAvatar } from "@/components/reviews/ReviewerAvatar"
import { RatingStars } from "@/components/product-reviews/RatingStars"
import { PinSolidIcon } from "@wildgrove/ui/icons"

export type { PublicReviewCardData } from "@wildgrove/core/reviews/types"

interface PublicReviewCardProps {
    review: PublicReviewCardData
    pinnedLabel?: string
    className?: string
    style?: CSSProperties
}

export function PublicReviewCard({ review, pinnedLabel, className, style }: PublicReviewCardProps) {
    const isPinned = Boolean(review.pinned)

    return (
        <article
            className={[
                "group relative flex w-full max-w-[20rem] mx-auto flex-col items-center text-center",
                "px-6 py-7 sm:px-7 sm:py-8",
                "rounded-[1.75rem]",
                "border transition-all duration-300",
                "bg-wg-surface/90 dark:bg-wg-dark-raised/95",
                "backdrop-blur-sm",
                "border-wg-border/40 dark:border-wg-dark-border/80",
                "shadow-card dark:shadow-glow-sm",
                "hover:border-wg-accent/45 dark:hover:border-wg-dark-accent/55",
                "hover:shadow-elevated dark:hover:shadow-glow-md",
                "hover:-translate-y-0.5",
                isPinned
                    ? "border-wg-accent/55 dark:border-wg-dark-accent/65 ring-1 ring-wg-accent/20 dark:ring-wg-dark-accent/25"
                    : "",
                className ?? "",
            ].join(" ")}
            style={style}
        >
            {/* Soft inner glow — breaks the flat rectangle feel */}
            <div
                className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(193,127,58,0.09),transparent_65%)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(212,148,74,0.12),transparent_65%)]"
                aria-hidden="true"
            />

            {/* Top accent line */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[3px] rounded-full bg-gradient-to-r from-transparent via-wg-accent to-transparent dark:via-wg-dark-accent opacity-70"
                aria-hidden="true"
            />

            {/* Decorative quote mark */}
            <span
                className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 font-display text-[4.5rem] sm:text-[5rem] leading-none text-wg-accent/10 dark:text-wg-dark-accent/15 select-none"
                aria-hidden="true"
            >
                &ldquo;
            </span>

            {isPinned && pinnedLabel && (
                <span className="relative z-10 mb-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1 rounded-full bg-wg-accent/12 text-wg-accent dark:bg-wg-dark-accent/18 dark:text-wg-dark-accent">
                    <PinIcon className="w-3 h-3" />
                    {pinnedLabel}
                </span>
            )}

            <div className={`relative z-10 ${isPinned && pinnedLabel ? "" : "mt-2"}`}>
                <ReviewerAvatar
                    name={review.name}
                    avatarUrl={review.avatarUrl}
                    size="lg"
                    shape="circle"
                    className="mx-auto"
                />
            </div>

            <RatingStars
                value={review.rating}
                size="lg"
                className="relative z-10 justify-center mt-4 mb-4"
            />

            <blockquote className="relative z-10 font-display text-base sm:text-[1.0625rem] leading-relaxed text-wg-text dark:text-wg-dark-text italic px-1">
                <span className="text-wg-accent/70 dark:text-wg-dark-accent/80 not-italic" aria-hidden="true">
                    &ldquo;
                </span>
                {review.quote}
                <span className="text-wg-accent/70 dark:text-wg-dark-accent/80 not-italic" aria-hidden="true">
                    &rdquo;
                </span>
            </blockquote>

            {review.photos.length > 0 && (
                <ReviewPhotoGallery
                    photos={review.photos}
                    reviewerLabel={review.name}
                    className="relative z-10 flex flex-wrap justify-center gap-2 mt-5"
                />
            )}

            <footer className="relative z-10 mt-6 pt-5 w-full border-t border-wg-border/35 dark:border-wg-dark-border/50">
                <p className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text tracking-wide">
                    {review.name}
                </p>
                {review.detail && (
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">{review.detail}</p>
                )}
            </footer>
        </article>
    )
}

function PinIcon({ className }: { className?: string }) {
    return (
        <PinSolidIcon className={className} />
    )
}
