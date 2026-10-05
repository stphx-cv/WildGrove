// ══════════════════════════════════════════════════════════════════
// Deleting the files a deleted row leaves behind.
//
// Addresses are shared: a draft and its duplicates point at the dish's photos,
// and a chat message keeps the photo of every dish it showed. So a file goes
// only when nothing else still points at it, checked after the rows are gone.
// A failure is logged and never fails the request that deleted the row.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "@wildgrove/db"
import { createServiceClient } from "./clients/admin"
import { storageKeysInBucket } from "./storage-urls"

/** The storage API deletes at most 1000 keys per call. */
const REMOVE_BATCH = 1000

async function removeKeys(bucket: string, keys: string[]): Promise<void> {
    const storage = createServiceClient().storage.from(bucket)
    for (let i = 0; i < keys.length; i += REMOVE_BATCH) {
        const { data, error } = await storage.remove(keys.slice(i, i + REMOVE_BATCH))
        if (error) throw error

        const results = (data as { results?: { key?: string; status?: string }[] } | null)?.results ?? []
        const failed = results.filter((r) => r.status !== "deleted")
        if (failed.length > 0) console.error(`[storage-cleanup] ${failed.length} file(s) not deleted from ${bucket}`)
    }
}

/**
 * Deletes the `menu-images` files behind `urls` that no dish or draft uses
 * (main image or gallery) and no chat message mentions.
 */
export async function deleteUnusedMenuImages(urls: Iterable<string | null | undefined>): Promise<void> {
    try {
        const candidates = storageKeysInBucket(urls, "menu-images")
        if (candidates.size === 0) return

        const items = await prisma.menuItem.findMany({ select: { imageUrl: true, images: true } })
        const used = storageKeysInBucket(items.flatMap((i) => [i.imageUrl, ...i.images]), "menu-images")

        const unused: string[] = []
        for (const key of candidates) {
            if (used.has(key)) continue
            const inChat = await prisma.chatMessage.findFirst({
                where: { OR: [{ content: { contains: key } }, { content: { contains: encodeURI(key) } }] },
                select: { id: true },
            })
            if (!inChat) unused.push(key)
        }

        if (unused.length > 0) await removeKeys("menu-images", unused)
    } catch (err) {
        console.error("[storage-cleanup] Menu image cleanup failed:", err)
    }
}

/** Deletes the `review-photos` files behind `urls` that no review or dish review uses. */
export async function deleteUnusedReviewPhotos(urls: Iterable<string | null | undefined>): Promise<void> {
    try {
        const candidates = storageKeysInBucket(urls, "review-photos")
        if (candidates.size === 0) return

        const [reviews, productReviews] = await Promise.all([
            prisma.review.findMany({ where: { photos: { isEmpty: false } }, select: { photos: true } }),
            prisma.productReview.findMany({ where: { photos: { isEmpty: false } }, select: { photos: true } }),
        ])
        const used = storageKeysInBucket([...reviews, ...productReviews].flatMap((r) => r.photos), "review-photos")

        const unused = [...candidates].filter((key) => !used.has(key))
        if (unused.length > 0) await removeKeys("review-photos", unused)
    } catch (err) {
        console.error("[storage-cleanup] Review photo cleanup failed:", err)
    }
}
