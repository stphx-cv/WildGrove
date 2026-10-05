"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { createClient } from "@wildgrove/core/clients/client"
import { reviewPhotoFolder } from "@wildgrove/core/reviews/photo-folder"
import { ArrowUpTrayIcon, CloseIcon, PlusIcon } from "@wildgrove/ui/icons"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * A photo in a review form. `file` is set while the photo only exists in this
 * browser, and `url` is then its local preview; without it, `url` is the
 * stored address. Nothing is uploaded until the review is sent.
 */
export type ReviewPhoto = { url: string; file?: File }

/** Stored addresses as form photos, for a form that edits an existing review. */
export function storedReviewPhotos(urls: string[]): ReviewPhoto[] {
    return urls.map((url) => ({ url }))
}

/**
 * Asks the shop to delete photos this form uploaded for a review that was not
 * saved. The server deletes only the ones in this user's folder that no review
 * uses, so it is safe to call when the outcome of the review is unknown. Sent with `keepalive` so it still
 * leaves if the page is closing.
 */
export function discardReviewPhotos(urls: string[]): void {
    if (urls.length === 0) return
    fetch("/api/review-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: urls }),
        keepalive: true,
    }).catch(() => {})
}

/**
 * Uploads the photos chosen in this browser, into the folder of the signed-in
 * user, and returns the stored address of every photo, in order, plus the ones
 * this call uploaded. If an upload fails, the files already uploaded by this
 * call are discarded and the error is thrown.
 */
export async function uploadReviewPhotos(photos: ReviewPhoto[]): Promise<{ urls: string[]; uploaded: string[] }> {
    if (photos.every((photo) => !photo.file)) return { urls: photos.map((photo) => photo.url), uploaded: [] }

    const client = createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new Error("Not signed in")
    const folder = await reviewPhotoFolder(user.id)

    const storage = client.storage.from("review-photos")
    const urls: string[] = []
    const uploaded: string[] = []
    try {
        for (const photo of photos) {
            if (!photo.file) {
                urls.push(photo.url)
                continue
            }
            const ext = photo.file.name.split(".").pop() ?? "jpg"
            const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const { error } = await storage.upload(path, photo.file)
            if (error) throw error
            const { data } = storage.getPublicUrl(path)
            if (!data?.publicUrl) throw new Error("Missing public URL")
            uploaded.push(data.publicUrl)
            urls.push(data.publicUrl)
        }
    } catch (err) {
        discardReviewPhotos(uploaded)
        throw err
    }
    return { urls, uploaded }
}

interface ReviewPhotoUploaderProps {
    photos: ReviewPhoto[]
    onChange: (photos: ReviewPhoto[]) => void
    maxPhotos: number
    disabled?: boolean
    /** Given to the add-photos button, so a label can point at it. */
    id?: string
    /** The id of the visible label; the add-photos button is named by it and its own text. */
    labelledBy?: string
}

export function ReviewPhotoUploader({ photos, onChange, maxPhotos, disabled, id, labelledBy }: ReviewPhotoUploaderProps) {
    const t = useTranslations("reviewPhotos")
    const addLabelledBy = labelledBy && id ? `${labelledBy} ${id}` : undefined
    const inputRef = useRef<HTMLInputElement>(null)
    const [error, setError] = useState("")

    // Local previews are released when the form goes away.
    const photosRef = useRef(photos)
    useEffect(() => {
        photosRef.current = photos
    }, [photos])
    useEffect(() => () => {
        for (const p of photosRef.current) if (p.file) URL.revokeObjectURL(p.url)
    }, [])

    function handleFiles(files: FileList) {
        setError("")
        const remaining = maxPhotos - photos.length
        if (remaining <= 0) return

        const chosen = Array.from(files).slice(0, remaining)
        for (const file of chosen) {
            if (!ALLOWED_TYPES.includes(file.type)) {
                setError(t("errorType"))
                return
            }
            if (file.size > MAX_FILE_SIZE) {
                setError(t("errorSize"))
                return
            }
        }

        onChange([...photos, ...chosen.map((file) => ({ url: URL.createObjectURL(file), file }))])
    }

    function removePhoto(photo: ReviewPhoto) {
        if (photo.file) URL.revokeObjectURL(photo.url)
        onChange(photos.filter((p) => p !== photo))
    }

    const canAdd = photos.length < maxPhotos && !disabled

    return (
        <div>
            {/* Photo grid */}
            {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {photos.map((photo) => (
                        <div key={photo.url} className="relative w-20 h-20 rounded-brand overflow-hidden border border-wg-border dark:border-wg-dark-border group">
                            <FadeInImage src={photo.url} alt={t("photoAlt")} fill className="object-cover" sizes="80px" />
                            <button
                                type="button"
                                onClick={() => removePhoto(photo)}
                                disabled={disabled}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                aria-label={t("remove")}
                            >
                                <CloseIcon className="w-5 h-5 text-white" strokeWidth={2} />
                            </button>
                        </div>
                    ))}

                    {/* Add more slot */}
                    {canAdd && (
                        <button
                            type="button"
                            id={id}
                            aria-labelledby={addLabelledBy}
                            aria-label={t("addMore")}
                            onClick={() => inputRef.current?.click()}
                            className="w-20 h-20 rounded-brand border-2 border-dashed border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}

            {/* Initial add button (no photos yet) */}
            {photos.length === 0 && (
                <button
                    type="button"
                    id={id}
                    aria-labelledby={addLabelledBy}
                    onClick={() => inputRef.current?.click()}
                    disabled={!canAdd}
                    className="flex items-center gap-2 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    {t("add", { max: maxPhotos })}
                </button>
            )}

            {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files)
                    // Choosing the same file again after removing it fires a change.
                    e.target.value = ""
                }}
            />
        </div>
    )
}
