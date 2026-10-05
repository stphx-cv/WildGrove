// ══════════════════════════════════════════════════════════════════
// Admin segment loading — shown during navigations between sections.
// One visual for the whole panel: components/LoadingState.tsx.
// ══════════════════════════════════════════════════════════════════
import { LoadingState } from "@/components/LoadingState"

export default function AdminLoading() {
    return <LoadingState size="page" message="Loading…" />
}
