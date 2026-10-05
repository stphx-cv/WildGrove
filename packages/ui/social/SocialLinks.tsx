import type { ResolvedSocialLink } from "@wildgrove/core/social-links"
import { balancedColumnCount } from "@wildgrove/core/contact-channel-layout"
import { SocialIcon } from "./SocialIcon"

/** A resolved network plus the caller's translated accessible label. */
export type SocialLinkView = ResolvedSocialLink & { ariaLabel: string }

/**
 * Every active network, in the catalog order `resolveSocialLinks` returns, so
 * eight of them read the same in the footer, the drawer and the contact page.
 * The list wraps and stays centred, which is what keeps a long row tidy.
 *
 * Labels arrive already translated: <MobileNav> is a client component, and a
 * formatter function cannot cross that boundary.
 */
interface SocialLinksProps {
    links: SocialLinkView[]
    /** "icon" = glyph buttons · "pill" = glyph with the handle beside it. */
    variant?: "icon" | "pill"
    /**
     * Owner's choice: a pill shows the network name alone, centred, and the
     * button is only something to press. It also keeps the handle out of the
     * icon variant's tooltip, which would otherwise leak what was hidden.
     */
    hideHandles?: boolean
    size?: "sm" | "md"
    className?: string
    onNavigate?: () => void
}

const ICON_SIZE = {
    sm: { box: "w-9 h-9", glyph: "w-4 h-4" },
    md: { box: "w-11 h-11", glyph: "w-5 h-5" },
} as const

/**
 * Desktop width per pill, each subtracting the `gap-3` (0.75rem) between its own
 * columns. Content-sized pills wrapped 7+1 with eight networks; an explicit
 * width makes the rows the balanced ones `balancedColumnCount` picks.
 */
const PILL_LG_WIDTH: Record<number, string> = {
    1: "lg:w-full",
    2: "lg:w-[calc((100%-0.75rem)/2)]",
    3: "lg:w-[calc((100%-1.5rem)/3)]",
    4: "lg:w-[calc((100%-2.25rem)/4)]",
}

export function SocialLinks({
    links,
    variant = "icon",
    hideHandles = false,
    size = "md",
    className = "",
    onNavigate,
}: SocialLinksProps) {
    if (links.length === 0) return null

    const lgColumns = balancedColumnCount(links.length)

    if (variant === "pill") {
        return (
            // One per row on a phone: the handles have wildly different lengths,
            // and a centred wrap of unequal pills reads as a ragged pile. Wider
            // up, equal widths in balanced rows, still centred so an incomplete
            // last row (7 → 4+3) sits in the middle rather than hugging the left.
            <ul
                className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 ${className}`}
            >
                {links.map((link) => (
                    <li
                        key={link.id}
                        // max-w keeps three pills from stretching to a third of the
                        // container each; justify-center then centres the short row.
                        className={`w-full sm:w-[calc((100%-0.75rem)/2)] sm:max-w-64 ${PILL_LG_WIDTH[lgColumns] ?? PILL_LG_WIDTH[4]}`}
                    >
                        <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={onNavigate}
                            aria-label={link.ariaLabel}
                            className={`group flex w-full items-center gap-2.5 min-h-11 py-2 rounded-brand ${hideHandles ? "justify-center px-3" : "pl-3 pr-4"} border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised transition-all duration-200 hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C17F3A] dark:focus-visible:outline-wg-dark-accent`}
                        >
                            <span className="w-8 h-8 flex-shrink-0 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/15 flex items-center justify-center text-wg-accent dark:text-wg-dark-accent">
                                <SocialIcon platform={link.id} className="w-4 h-4" />
                            </span>
                            {hideHandles ? (
                                <span className="min-w-0 text-sm font-medium text-wg-text dark:text-wg-dark-text group-hover:text-wg-primary dark:group-hover:text-wg-dark-primary transition-colors truncate">
                                    {link.label}
                                </span>
                            ) : (
                                <span className="min-w-0">
                                    <span className="block text-[0.65rem] font-medium uppercase tracking-[0.14em] text-wg-muted dark:text-wg-dark-muted">
                                        {link.label}
                                    </span>
                                    <span className="block text-sm font-medium text-wg-text dark:text-wg-dark-text group-hover:text-wg-primary dark:group-hover:text-wg-dark-primary transition-colors truncate">
                                        {link.display}
                                    </span>
                                </span>
                            )}
                        </a>
                    </li>
                ))}
            </ul>
        )
    }

    const { box, glyph } = ICON_SIZE[size]

    return (
        <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
            {links.map((link) => (
                <li key={link.id}>
                    <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onNavigate}
                        aria-label={link.ariaLabel}
                        title={hideHandles ? link.label : link.display}
                        className={`${box} flex items-center justify-center rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:text-wg-primary dark:hover:text-wg-dark-primary hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C17F3A] dark:focus-visible:outline-wg-dark-accent`}
                    >
                        <SocialIcon platform={link.id} className={glyph} />
                    </a>
                </li>
            ))}
        </ul>
    )
}
