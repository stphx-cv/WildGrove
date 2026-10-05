// ══════════════════════════════════════════════════════════════════
// HeroOverlay | The green layer over every hero photo
// One place for the home hero, the page heroes (carta, reservas, nosotros,
// contacto) and the sign-in page, so the five cannot drift apart. It is
// lighter in the middle, where the food is, and darker at the edges, where
// the text sits. The values keep the title and the description of every hero
// at 4.5:1 or more against the lightest part of its photo.
// ══════════════════════════════════════════════════════════════════

type HeroOverlayProps = {
    /**
     * `down` runs top to bottom. `side` does the same below `lg` and runs left to
     * right from `lg` up, where the sign-in page puts its photo beside the form.
     */
    direction?: "down" | "side"
}

export function HeroOverlay({ direction = "down" }: HeroOverlayProps) {
    return (
        <div
            aria-hidden="true"
            className={
                direction === "side"
                    ? "absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-[#0E1A12]/75 via-[#1E3A25]/66 to-[#0E1A12]/85"
                    : "absolute inset-0 bg-gradient-to-b from-[#0E1A12]/75 via-[#1E3A25]/66 to-[#0E1A12]/85"
            }
        />
    )
}
