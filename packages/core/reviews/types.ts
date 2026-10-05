// ══════════════════════════════════════════════════════════════════
// Public review shapes.
//
// This type used to live in `components/reviews/PublicReviewCard.tsx`, which
// made the query layer depend on a web-app React component. It is data, so it
// belongs here; `PublicReviewCard` now imports it from @wildgrove/core.
// ══════════════════════════════════════════════════════════════════

export interface PublicReviewCardData {
    id: string
    quote: string
    name: string
    detail: string
    rating: number
    photos: string[]
    avatarUrl: string | null
    pinned?: boolean
}
