import { dishTagLabel } from "@wildgrove/core/dish-tag-label"

const TAG_STYLES: Record<string, string> = {
    // English
    vegan:            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    vegetarian:       "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    "gluten-free":    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    organic:          "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    spicy:            "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    seasonal:         "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "chef-special":   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "dairy-free":     "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    "nut-free":       "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    "low-carb":       "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "high-protein":   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    popular:          "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    new:              "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    "kids-menu":      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "house-special":  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    // Spanish aliases → same colors
    vegano:              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    vegetariano:         "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    "sin-gluten":        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "orgánico":          "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    organico:            "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    picante:             "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    "de-temporada":      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "especial-del-chef": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "sin-lactosa":       "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    "sin-nueces":        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    "bajo-carb":         "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "alto-proteína":     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "alto-proteina":     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    nuevo:               "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    "menú-niños":        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "menu-ninos":        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "especialidad-casa": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
}

const DEFAULT_STYLE =
    "bg-wg-border text-wg-muted dark:bg-wg-dark-border dark:text-wg-dark-muted"

interface BadgeProps {
    tag: string
    /** Hex color override from CMS (e.g. "#10b981"). Applied as inline style. */
    customColor?: string
    className?: string
    /**
     * Shows the tag as text a person reads (`sin-gluten` as "Sin gluten") instead of the
     * stored identifier in capitals. The colours still follow the identifier.
     */
    readable?: boolean
}

export function Badge({ tag, customColor, className = "", readable = false }: BadgeProps) {
    const shape = readable
        ? "inline-block px-2 py-0.5 text-xs font-medium rounded-full"
        : "inline-block px-2 py-0.5 text-[11px] font-medium rounded-full tracking-wide uppercase"
    const text = readable ? dishTagLabel(tag) : tag

    if (customColor) {
        return (
            <span
                className={`${shape} ${className}`}
                style={{
                    backgroundColor: `${customColor}26`,
                    color: customColor,
                    border: `1px solid ${customColor}40`,
                }}
            >
                {text}
            </span>
        )
    }

    const normalized = tag.toLowerCase().replace(/\s+/g, "-")
    const style = TAG_STYLES[normalized] ?? DEFAULT_STYLE

    return (
        <span className={`${shape} ${style} ${className}`}>
            {text}
        </span>
    )
}
