// ══════════════════════════════════════════════════════════════════
// Review photo addresses.
//
// A review photo is an object this project uploaded to its own storage, and
// the address it is stored under is the one the storage client builds:
//
//   <InsForge URL>/api/storage/buckets/<bucket>/objects/<key>
//
// Anything else is refused. The panel paints these with next/image, which only
// loads hosts listed in `images.remotePatterns`, so an address on another host
// throws while the moderation list renders and takes the whole screen with it.
// ══════════════════════════════════════════════════════════════════

import { getInsforgeUrl } from "../insforge/env"
import { parseStorageObjectUrl } from "../storage-urls"

/** The buckets review photos live in (see components/reviews/ReviewPhotoUploader). */
const REVIEW_PHOTO_BUCKETS = new Set(["review-photos"])

const OBJECT_PATH = /^\/api\/storage\/buckets\/([^/]+)\/objects\/(.+)$/

/**
 * Whether an address points at a review photo in this project's storage.
 *
 * Returns false when the storage URL cannot be read from the environment:
 * nothing can be verified then, and an address that cannot be verified is not
 * stored.
 */
export function isStoredReviewPhotoUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false

  let storage: URL
  let candidate: URL
  try {
    storage = new URL(getInsforgeUrl())
    candidate = new URL(value)
  } catch {
    return false
  }

  if (candidate.origin !== storage.origin) return false
  if (candidate.username || candidate.password) return false
  if (candidate.search || candidate.hash) return false

  const match = OBJECT_PATH.exec(candidate.pathname)
  if (!match) return false

  let bucket: string
  try {
    bucket = decodeURIComponent(match[1])
  } catch {
    return false
  }
  return REVIEW_PHOTO_BUCKETS.has(bucket)
}

/** A plain file name, as the review forms create them: no slashes, no `..`. */
const FILE_NAME = /^[\w-]+(\.[\w-]+)*$/

/**
 * Whether an address is a review photo inside `folder`, the folder of one user
 * (see photo-folder.ts). The review endpoints accept a new photo only from the
 * author's folder, and the discard endpoint only deletes from the requester's.
 */
export function isReviewPhotoInFolder(value: unknown, folder: string): value is string {
  if (!isStoredReviewPhotoUrl(value)) return false
  const key = parseStorageObjectUrl(value)?.key
  const prefix = `${folder}/`
  return !!key && key.startsWith(prefix) && FILE_NAME.test(key.slice(prefix.length))
}

/** Message shown when an address is refused, shared by both review endpoints. */
export const REVIEW_PHOTO_URL_MESSAGE = "Photos must be uploaded through the review form"
