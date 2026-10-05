// ══════════════════════════════════════════════════════════════════
// The folder of a user's review photos.
//
// The review forms upload each photo under a folder of its author, and the
// shop only discards photos in the folder of whoever asks, so nobody can
// discard someone else's upload. The folder is a hash of the account id, so a
// public photo address does not show the id itself. It runs the same in the
// browser and on the server.
// ══════════════════════════════════════════════════════════════════

/** The folder, inside `review-photos`, that a user's photos are uploaded to. */
export async function reviewPhotoFolder(userId: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`review-photos:${userId}`),
  )
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)
}
