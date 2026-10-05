
import { Spinner } from "@wildgrove/ui/icons"// ══════════════════════════════════════════════════════════════════
// LoadingState — the one loading visual in the CMS.
//
// The spinner and label `DataTable` already used, extracted so every route
// boundary, pane and grid shows the same thing.
// There are no skeletons and no pulsing placeholders anywhere else; if a
// section needs to say it is loading, it renders this.
//
// No "use client": it holds no state, so it renders in a `loading.tsx`
// boundary and inside a client component alike.
// ══════════════════════════════════════════════════════════════════

export type LoadingStateSize = "page" | "section" | "inline"

/** Spinner size, gap under it and vertical breathing room, per size. */
const SIZES: Record<LoadingStateSize, { spinner: string; wrapper: string }> = {
    page: { spinner: "w-8 h-8 mb-3", wrapper: "flex flex-col items-center justify-center py-24" },
    section: { spinner: "w-6 h-6 mb-2.5", wrapper: "flex flex-col items-center justify-center py-12" },
    inline: { spinner: "w-5 h-5 mx-auto mb-2", wrapper: "text-center" },
}

export function LoadingState({
    message = "Loading…",
    size = "section",
    className = "",
}: {
    /** What is being loaded, e.g. "Loading menu item…". */
    message?: string
    /** `page` for route boundaries, `section` for panes and grids, `inline` for table bodies. */
    size?: LoadingStateSize
    className?: string
}) {
    const { spinner, wrapper } = SIZES[size]

    return (
        <div
            className={`${wrapper} text-sm text-wg-muted dark:text-wg-dark-muted ${className}`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <Spinner className={`${spinner} animate-spin`} aria-hidden />
            <span>{message}</span>
        </div>
    )
}

export default LoadingState
