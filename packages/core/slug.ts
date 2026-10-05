// A URL slug from a display name: lowercase ASCII, accents stripped to their base letter
// ("Ají de gallina" -> "aji-de-gallina"), anything else collapsed into single hyphens.
// Pure, so forms and API routes share it.

export function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
}
