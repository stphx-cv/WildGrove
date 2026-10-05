// ══════════════════════════════════════════════════════════════════
// Contact channel grid — column count by card count (flex, centered rows)
// 4 → 4 in one row · 5 → 3+2 · 6 → 3+3 · 7 → 4+3 · 9 → 3×3 (not 4+4+1)
// ══════════════════════════════════════════════════════════════════

/**
 * How many go on a row so no row is left an orphan: 7 wraps 4+3, never 7+1,
 * and 9 wraps 3+3+3 rather than 4+4+1. Shared with the social pill row, which
 * hit the same thing with eight networks — one rule, not two that drift.
 */
export function balancedColumnCount(count: number): number {
    return preferredDesktopColumns(count)
}

function preferredDesktopColumns(count: number): number {
    if (count <= 0) return 1
    if (count <= 4) return count
    if (count === 5 || count === 6) return 3
    if (count % 4 === 1) return 3
    return 4
}

export function getContactChannelColumnCounts(count: number): { sm: number; lg: number } {
    const lg = preferredDesktopColumns(count)
    const sm = count <= 1 ? 1 : Math.min(2, lg)
    return { sm, lg }
}

/**
 * Flex wrap + justify-center so incomplete last rows (e.g. 5 cards → 3+2) stay centered.
 */
export function contactChannelGridClass(_lgCols: number): string {
    return "flex flex-wrap justify-center items-stretch gap-3 sm:gap-4 lg:gap-6 max-w-5xl mx-auto"
}

/**
 * Card width per breakpoint. Each one subtracts the gaps **that breakpoint
 * actually uses** — gap-3 (0.75rem), sm:gap-4 (1rem), lg:gap-6 (1.5rem) — and
 * divides by the columns wanted there. Getting that wrong does not misalign the
 * row by a few pixels: the cards overflow their container and flex-wrap drops
 * them to one per row. The sm width was missing entirely, which is why two
 * columns collapsed to one on tablets.
 */
export function contactChannelCardWidthClass(_smCols: number, lgCols: number): string {
    const lgWidth: Record<number, string> = {
        1: "lg:w-full lg:max-w-md",
        2: "lg:w-[calc((100%-1.5rem)/2)]",
        3: "lg:w-[calc((100%-3rem)/3)]",
        4: "lg:w-[calc((100%-4.5rem)/4)]",
    }
    const lg = lgWidth[lgCols] ?? lgWidth[3]
    return [
        "w-full min-w-0",
        "min-[440px]:w-[calc((100%-0.75rem)/2)]",
        "sm:w-[calc((100%-1rem)/2)]",
        lg,
    ].join(" ")
}
