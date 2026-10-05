"use client"

// ══════════════════════════════════════════════════════════════════
// Reservation Reviews list — used inside the unified /reviews page.
// Manages reviews tied to a completed Reservation (the original system).
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import Link from "next/link"
import { AdminSelect } from "@/components/AdminSelect"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { LoadingState } from "@/components/LoadingState"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import { StarOutlineIcon, StarSolidIcon } from "@wildgrove/ui/icons"

interface ReviewRow {
    id: string
    rating: number
    comment: string
    photos: string[]
    approved: boolean
    hidden: boolean
    pinned: boolean
    authorDisplayName: string | null
    authorAvatarUrl: string | null
    createdAt: string
    profile: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
    }
    reservation: {
        id: string
        date: string
    }
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

function StarDisplay({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <StarSolidIcon key={i} className={`w-4 h-4 ${i < rating ? "text-wg-accent dark:text-wg-dark-accent" : "text-wg-border dark:text-wg-dark-border"}`} />
            ))}
        </div>
    )
}

function formatReviewDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

function getReviewerName(profile: ReviewRow["profile"]) {
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Unknown"
}

function ReviewerAvatarAdmin({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
    if (avatarUrl) {
        return (
            <div className="relative w-9 h-9 rounded-brand overflow-hidden shrink-0 border border-wg-border/50 dark:border-wg-dark-border">
                <FadeInImage src={avatarUrl} alt="" fill className="object-cover" sizes="36px" />
            </div>
        )
    }
    const initials = name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"
    return (
        <div
            className="w-9 h-9 rounded-brand flex items-center justify-center shrink-0 text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #3A5A40, #C17F3A)" }}
            aria-hidden="true"
        >
            {initials}
        </div>
    )
}

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

type ReviewListPayload = { reviews: ReviewRow[]; pagination: PaginationData }

export function ReservationReviewsList() {
    const [filter, setFilter] = useState("all")
    const [page, setPage] = useState(1)
    const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isTogglingHidden, setIsTogglingHidden] = useState<string | null>(null)
    const [isTogglingPin, setIsTogglingPin] = useState<string | null>(null)
    const [pinError, setPinError] = useState<string | null>(null)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (filter !== "all") params.set("approved", filter)
        return `/api/reviews?${params}`
    }, [page, filter])

    const { data: list, isLoading, mutate: mutateList } = useCmsQuery<ReviewListPayload>(listKey)

    const reviews = list?.reviews ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION

    /** Rewrites the cached page without a request. */
    const patchCached = useCallback(
        (next: (rows: ReviewRow[]) => ReviewRow[]) =>
            mutateList((current) => current && { ...current, reviews: next(current.reviews) }, { revalidate: false }),
        [mutateList],
    )

    const refreshList = useCallback(() => { void invalidateCms("/api/reviews") }, [])

    useEffect(() => { setPage(1) }, [filter])

    const toggleApproval = useCallback(async (id: string, approved: boolean) => {
        try {
            const res = await fetch(`/api/reviews/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approved }),
            })
            if (res.ok) {
                void patchCached((rows) => rows.map((r) => (r.id === id ? { ...r, approved } : r)))
            }
        } catch (error) {
            console.error("Failed to update review:", error)
        }
    }, [patchCached])

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/reviews/${deleteTarget.id}`, { method: "DELETE" })
            if (res.ok) {
                // One row fewer, and the totals with it.
                refreshList()
                setDeleteTarget(null)
            }
        } catch (error) {
            console.error("Failed to delete review:", error)
        } finally {
            setIsDeleting(false)
        }
    }, [deleteTarget, refreshList])

    const togglePin = useCallback(async (id: string, pinned: boolean) => {
        setPinError(null)
        setIsTogglingPin(id)
        try {
            const res = await fetch(`/api/reviews/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinned }),
            })
            const json = await res.json()
            if (res.ok) {
                void patchCached((rows) => rows.map((r) => (r.id === id ? { ...r, pinned } : r)))
            } else {
                setPinError(json.error ?? "Failed to update pin")
            }
        } catch (error) {
            console.error("Failed to toggle review pin:", error)
            setPinError("Failed to update pin")
        } finally {
            setIsTogglingPin(null)
        }
    }, [patchCached])

    const toggleHidden = useCallback(async (id: string, hidden: boolean) => {
        setIsTogglingHidden(id)
        try {
            const res = await fetch(`/api/reviews/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hidden }),
            })
            if (res.ok) {
                // Hiding takes the row out of this list; the totals move too.
                refreshList()
            }
        } catch (error) {
            console.error("Failed to toggle review visibility:", error)
        } finally {
            setIsTogglingHidden(null)
        }
    }, [refreshList])

    return (
        <div>
            {pinError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
                    {pinError}
                </p>
            )}

            <div className="flex justify-end mb-4">
                <AdminSelect
                    value={filter}
                    onChange={setFilter}
                    required
                    options={[
                        { label: "All", value: "all" },
                        { label: "Pending", value: "false" },
                        { label: "Approved", value: "true" },
                        { label: "Hidden", value: "hidden" },
                    ]}
                    className="w-44"
                />
            </div>

            {isLoading ? (
                <LoadingState size="section" message="Loading reservation reviews…" />
            ) : reviews.length === 0 ? (
                <div className="text-center py-16 text-wg-muted dark:text-wg-dark-muted">
                    <StarOutlineIcon className="w-12 h-12 mx-auto mb-4 opacity-40" strokeWidth={1} />
                    <p className="text-sm">No reservation reviews found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        <div
                            key={review.id}
                            className={`p-5 rounded-card border transition-colors ${review.hidden
                                    ? "bg-wg-border/10 dark:bg-wg-dark-border/10 border-wg-border/30 dark:border-wg-dark-border/30 opacity-60"
                                    : review.approved
                                        ? "bg-wg-surface dark:bg-wg-dark-raised border-wg-border/50 dark:border-wg-dark-border"
                                        : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30"
                                }`}
                        >
                                    <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-3">
                                        <ReviewerAvatarAdmin
                                            name={review.authorDisplayName ?? getReviewerName(review.profile)}
                                            avatarUrl={review.authorAvatarUrl}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                                Dining visit · {formatReviewDate(review.reservation.date)}
                                            </p>
                                            <Link
                                                href={`/reservations/${review.reservation.id}`}
                                                className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors"
                                            >
                                                View reservation
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-2">
                                        <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                                            {getReviewerName(review.profile)}
                                        </span>
                                        <span className="text-wg-border/80 dark:text-wg-dark-border" aria-hidden="true">·</span>
                                        <StarDisplay rating={review.rating} />
                                        <span className="text-wg-border/80 dark:text-wg-dark-border" aria-hidden="true">·</span>
                                        <time
                                            className="text-xs text-wg-muted dark:text-wg-dark-muted"
                                            dateTime={review.createdAt}
                                        >
                                            {formatReviewDate(review.createdAt)}
                                        </time>
                                        {review.hidden ? (
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-wg-border/40 text-wg-muted dark:bg-wg-dark-border/40 dark:text-wg-dark-muted">
                                                Hidden
                                            </span>
                                        ) : (
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${review.approved
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                }`}>
                                                {review.approved ? "Approved" : "Pending"}
                                            </span>
                                        )}
                                        {review.pinned && review.approved && !review.hidden && (
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-wg-accent/15 text-wg-accent dark:bg-wg-dark-accent/20 dark:text-wg-dark-accent">
                                                Pinned · Home
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-wg-text dark:text-wg-dark-text mb-2 italic leading-relaxed">
                                        &ldquo;{review.comment}&rdquo;
                                    </p>

                                    {review.photos?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {review.photos.map((url) => (
                                                <button key={url} onClick={() => setLightboxUrl(url)} className="block w-14 h-14 rounded-brand overflow-hidden border border-wg-border/50 dark:border-wg-dark-border hover:opacity-80 transition-opacity relative shrink-0">
                                                    <FadeInImage src={url} alt="Review photo" fill className="object-cover" sizes="56px" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {review.approved ? (
                                        <button
                                            onClick={() => toggleApproval(review.id, false)}
                                            className="text-xs font-medium px-3 py-1.5 rounded-brand border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                        >
                                            Revoke
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => toggleApproval(review.id, true)}
                                            className="text-xs font-medium px-3 py-1.5 rounded-brand bg-wg-primary dark:bg-wg-dark-primary text-white hover:bg-wg-primary/90 dark:hover:bg-wg-dark-primary/90 transition-colors"
                                        >
                                            Approve
                                        </button>
                                    )}
                                    {review.approved && !review.hidden && (
                                        <button
                                            onClick={() => togglePin(review.id, !review.pinned)}
                                            disabled={isTogglingPin === review.id}
                                            className="text-xs font-medium px-3 py-1.5 rounded-brand border border-wg-accent/50 dark:border-wg-dark-accent/50 text-wg-accent dark:text-wg-dark-accent hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10 transition-colors disabled:opacity-50"
                                        >
                                            {review.pinned ? "Unpin" : "Pin home"}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setDeleteTarget(review)}
                                        className="text-xs font-medium px-3 py-1.5 rounded-brand border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => toggleHidden(review.id, !review.hidden)}
                                        disabled={isTogglingHidden === review.id}
                                        className="text-xs font-medium px-3 py-1.5 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-border/20 dark:hover:bg-wg-dark-border/20 transition-colors disabled:opacity-50"
                                    >
                                        {review.hidden ? "Unhide" : "Hide"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="mt-6">
                    <Pagination
                        currentPage={pagination.page}
                        totalPages={pagination.totalPages}
                        onPageChange={setPage}
                    />
                </div>
            )}

            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cerrar ✕
                        </button>
                        <FadeInImage
                            src={lightboxUrl}
                            alt="Review photo"
                            width={896}
                            height={672}
                            className="w-full h-auto max-h-[90vh] object-contain rounded-card"
                        />
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete Review"
                message="Are you sure you want to permanently delete this review? This action cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={handleDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    )
}
