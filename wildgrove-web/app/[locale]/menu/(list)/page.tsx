import { PageHero } from "@/components/ui/PageHero"
import { unstable_cache } from "next/cache"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { MenuGrid } from "@/components/menu/MenuGrid"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { prisma } from "@wildgrove/db"
import type { MenuCategoryData } from "@wildgrove/core/data/menu-seed"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import { getProductRatings } from "@wildgrove/core/product-reviews/queries"
import type { Locale } from "@/i18n/routing"

// Same ISR window as the home: the Data Cache tags are also dropped when the
// CMS pings /api/revalidate. The TTL is the fallback if that hop fails.
export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "menu" })
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: buildAlternates("/menu", locale),
    }
}

const getMenuCategories = unstable_cache(
    async (): Promise<MenuCategoryData[]> => {
        const categories = await prisma.menuCategory.findMany({
            where: { isDraft: false },
            orderBy: { order: "asc" },
            include: {
                items: {
                    where: { available: true, isDraft: false },
                    orderBy: [{ order: "asc" }, { name: "asc" }],
                },
            },
        })

        return categories
            .filter((cat) => cat.items.length > 0)
            .map((cat) => ({
                id: cat.id,
                name: cat.name,
                nameEs: cat.nameEs ?? null,
                slug: cat.slug,
                icon: cat.icon,
                order: cat.order,
                items: cat.items.map((item) => ({
                    id: item.id,
                    categoryId: cat.id,
                    slug: item.slug,
                    slugEs: item.slugEs ?? null,
                    name: item.name,
                    nameEs: item.nameEs ?? null,
                    description: item.description,
                    descriptionEs: item.descriptionEs ?? null,
                    prices: (item.prices ?? {}) as { PEN?: number; USD?: number },
                    tags: item.tags,
                    tagsEs: item.tagsEs ?? [],
                    tagColors: (item.tagColors ?? {}) as Record<string, string>,
                    imageUrl: item.imageUrl ?? "",
                    available: item.available,
                })),
            }))
    },
    ["menu-page"],
    { tags: ["menu"], revalidate: 300 }
)

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("menu")
    const [categories, discounts, ratingRows] = await Promise.all([
        getMenuCategories(),
        loadActiveAutomaticDiscounts(),
        getProductRatings(),
    ])

    // Build a plain object for the client boundary
    const ratings: Record<string, { average: number; count: number }> = {}
    for (const row of ratingRows) {
        ratings[row.menuItemId] = { average: row.average, count: row.count }
    }

    return (
        <>
            <ScrollAnimator />

            {/* -- Hero ------------------------------------------------- */}
            <PageHero
                imageSrc="/webp/home-dishes.webp"
                imageAlt={t("imageAlt")}
                subtitle={t("heroSubtitle")}
                title={t("heroTitle")}
            />

            {/* -- Menu Content ----------------------------------------- */}
            <div className="py-16">
                <div className="content-wrapper">
                    <MenuGrid categories={categories} locale={locale} discounts={discounts} ratings={ratings} />
                </div>
            </div>
        </>
    )
}
