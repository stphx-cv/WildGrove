// ══════════════════════════════════════════════════════════════════
// Review Photos — DELETE (discard photos a review never kept)
//
// The review forms upload their photos right before sending the review. When
// the review is refused, or its request fails, the form sends the addresses it
// just uploaded here. Only review photo addresses in the requester's own folder
// are read, so nobody can discard someone else's upload, and only the files no
// review uses are deleted, so an address that did end up in a review stays.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { isReviewPhotoInFolder } from "@wildgrove/core/reviews/photo-urls"
import { reviewPhotoFolder } from "@wildgrove/core/reviews/photo-folder"
import { deleteUnusedReviewPhotos } from "@wildgrove/core/storage-cleanup"

/** A form uploads at most this many photos for one review. */
const MAX_PHOTOS = 10

export async function DELETE(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user }, error: authError } = await insforge.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const folder = await reviewPhotoFolder(user.id)
    const body = await request.json().catch(() => null)
    const submitted: unknown[] = Array.isArray(body?.photos) ? body.photos : []
    const photos = submitted.filter((p) => isReviewPhotoInFolder(p, folder)).slice(0, MAX_PHOTOS)

    await deleteUnusedReviewPhotos(photos)
    return NextResponse.json({ success: true })
}
