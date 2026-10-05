// Shared menu types for public menu UI (data comes from Prisma / admin CMS).

export interface MenuItemData {
    id: string
    slug: string
    slugEs?: string | null
    name: string
    nameEs?: string | null
    description: string
    descriptionEs?: string | null
    prices?: Partial<Record<"PEN" | "USD", number>>
    tags: string[]
    tagsEs?: string[]
    tagColors?: Record<string, string>
    imageUrl: string
    available: boolean
    categoryId?: string
}

export interface MenuCategoryData {
    id: string
    name: string
    nameEs?: string | null
    slug: string
    icon?: string
    order: number
    items: MenuItemData[]
}
