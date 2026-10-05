import { unstable_cache } from "next/cache"
import { prisma } from "@wildgrove/db"
import { SectionWrapper } from "@/components/ui/SectionWrapper"
import { getTranslations } from "next-intl/server"
import { FeaturedDishCard, type FeaturedDishCardDish } from "@/components/sections/FeaturedDishCard"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"
import { onSaleMenuItemWhere } from "@wildgrove/core/menu-visibility"
import { getProductRatings } from "@wildgrove/core/product-reviews/queries"

const getFeaturedDishes = unstable_cache(
    async () => {
        return prisma.menuItem.findMany({
            where: { AND: [onSaleMenuItemWhere, { featured: true }] },
            select: {
                id: true,
                slug: true,
                slugEs: true,
                name: true,
                nameEs: true,
                description: true,
                descriptionEs: true,
                prices: true,
                imageUrl: true,
                tags: true,
                tagsEs: true,
                tagColors: true,
                categoryId: true,
            },
            orderBy: { featuredOrder: "asc" },
        })
    },
    ["featured-dishes"],
    { tags: ["menu"], revalidate: 300 }
)

export async function FeaturedDishes({ locale }: { locale: string }) {
    const [dishes, discounts, ratingRows] = await Promise.all([
        getFeaturedDishes(),
        loadActiveAutomaticDiscounts(),
        getProductRatings(),
    ])

    const ratings: Record<string, { average: number; count: number }> = {}
    for (const row of ratingRows) {
        ratings[row.menuItemId] = { average: row.average, count: row.count }
    }
    const t = await getTranslations("featured")

    if (dishes.length === 0) return null

    return (
        <SectionWrapper className="-mt-2 bg-wg-surface dark:bg-wg-dark-bg">
            {/* Section header */}
            <div className="text-center mb-12">
                <p className="text-wg-accent dark:text-wg-dark-accent text-sm font-medium uppercase tracking-[0.15em] mb-3">
                    {t("subtitle")}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-wg-text dark:text-wg-dark-text">
                    {t("title")}
                </h2>
            </div>

            {/* Dish cards grid */}
            <div className={
                dishes.length === 1
                    ? "grid grid-cols-1 max-w-xl mx-auto gap-6"
                    : dishes.length === 2
                        ? "grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-6 lg:gap-8"
                        : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
            }>
                {dishes.map((dish, index) => {
                    const cardDish: FeaturedDishCardDish = {
                        id: dish.id,
                        slug: dish.slug,
                        slugEs: dish.slugEs,
                        name: dish.name,
                        nameEs: dish.nameEs,
                        description: dish.description,
                        descriptionEs: dish.descriptionEs,
                        prices: (dish.prices ?? {}) as { PEN?: number; USD?: number },
                        imageUrl: dish.imageUrl,
                        tags: dish.tags,
                        tagsEs: dish.tagsEs,
                        tagColors: dish.tagColors,
                        categoryId: dish.categoryId ?? "",
                    }
                    return (
                        <FeaturedDishCard
                            key={dish.id}
                            dish={cardDish}
                            locale={locale}
                            discounts={discounts}
                            rating={ratings[dish.id]}
                            index={index}
                            dishesCount={dishes.length}
                        />
                    )
                })}
            </div>
        </SectionWrapper>
    )
}
