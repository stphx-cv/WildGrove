/**
 * Localized category label for menu UI (chat cards, admin previews, etc.).
 * Prefer DB `nameEs` when locale is Spanish; otherwise map known slugs; fallback to English `name`.
 */

const LABELS_BY_SLUG: Record<string, { en: string; es: string }> = {
  starters: { en: "Starters", es: "Entrantes" },
  mains: { en: "Mains", es: "Principales" },
  desserts: { en: "Desserts", es: "Postres" },
  drinks: { en: "Drinks", es: "Bebidas" },
  breakfast: { en: "Breakfast", es: "Desayunos" },
  lunch: { en: "Lunch", es: "Almuerzo" },
  dinner: { en: "Dinner", es: "Cena" },
  bowls: { en: "Bowls", es: "Bowls" },
  sandwiches: { en: "Sandwiches & Wraps", es: "Sándwiches y wraps" },
}

/** Slug variants that should use another row in LABELS_BY_SLUG */
const SLUG_ALIASES: Record<string, string> = {
  main: "mains",
}

export function resolveMenuCategoryDisplay(opts: {
  locale: string
  category: string
  categoryEs?: string | null
  categorySlug?: string | null
}): string {
  const { locale, category, categoryEs, categorySlug } = opts

  if (locale === "es" && typeof categoryEs === "string" && categoryEs.trim()) {
    return categoryEs.trim()
  }

  const raw = categorySlug?.toLowerCase().trim()
  const slug = raw ? (SLUG_ALIASES[raw] ?? raw) : ""
  if (slug) {
    const row = LABELS_BY_SLUG[slug]
    if (row) {
      return locale === "es" ? row.es : row.en
    }
  }

  return category
}
