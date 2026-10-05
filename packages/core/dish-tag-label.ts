// A dish tag is stored as an identifier (`sin-gluten`, `gluten-free`), and the
// dietary filter of Sage, the tag colours and the agent surface read it as
// written. This turns it into the text a person reads, without touching the
// stored value.

/** English compounds that keep their hyphen: `gluten-free`, `plant-based`, `high-protein`. */
const KEEPS_HYPHEN = /^(high|low)-|-(free|based)$/i

/** Spanish tags whose words do not read right with the hyphens simply turned into spaces. */
const SPANISH_LABELS: Record<string, string> = {
    "alto-proteína": "Alto en proteína",
    "alto-proteina": "Alto en proteína",
    "bajo-carb": "Bajo en carbohidratos",
    "menú-niños": "Menú para niños",
    "menu-ninos": "Menú para niños",
    "especialidad-casa": "Especialidad de la casa",
}

export function dishTagLabel(tag: string): string {
    const trimmed = tag.trim()
    if (!trimmed) return trimmed
    const key = trimmed.toLowerCase().replace(/\s+/g, "-")
    const known = SPANISH_LABELS[key]
    if (known) return known
    const words = KEEPS_HYPHEN.test(key) ? trimmed.replace(/_+/g, " ") : trimmed.replace(/[-_]+/g, " ")
    return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}
