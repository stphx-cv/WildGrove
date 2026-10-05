import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { notFound } from "next/navigation"
import { unstable_cache } from "next/cache"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/routing"
import { prisma } from "@wildgrove/db"
import { Badge } from "@wildgrove/ui/Badge"
import { ShareButton } from "@/components/menu/ShareButton"
import { ProductGallery } from "@/components/menu/ProductGallery"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { MenuProductPricePanel } from "@/components/menu/MenuProductPricePanel"
import { RelatedDishPricePill } from "@/components/menu/RelatedDishPricePill"
import { SetAlternateLocale } from "@/components/layout/SetAlternateLocale"
import { getPathname, routing, type Locale } from "@wildgrove/core/i18n/routing"
import { DEFAULT_CURRENCY } from "@wildgrove/core/currency"
import { getAppSettings } from "@wildgrove/core/settings"
import { computeDiscountedPrice, displayCartUnitPrices, getDiscountForItem } from "@wildgrove/core/menu-discounts"
import { loadActiveAutomaticDiscounts } from "@wildgrove/core/cart/active-automatic-discounts"
import { onSaleMenuItemWhere, publishedMenuItemWhere } from "@wildgrove/core/menu-visibility"
import { getProductRatingAggregate, getProductReviews } from "@wildgrove/core/product-reviews/queries"
import { ProductReviewsSection } from "@/components/product-reviews/ProductReviewsSection"
import { safeJsonLd } from "@wildgrove/core/seo/json-ld"
import { siteUrl } from "@wildgrove/core/urls"
import { RatingPill } from "@/components/product-reviews/RatingPill"
import type { Metadata } from "next"
import { ChevronRightIcon, StarSolidIcon } from "@wildgrove/ui/icons"

// ── Data fetching ──

const getMenuItemBySlug = unstable_cache(
    async (slug: string, locale: string) => {
        // For ES locale: try slugEs first, then fall back to the EN slug
        // A draft, or a dish in a draft category, is not on the storefront: 404.
        const item = await prisma.menuItem.findFirst({
            where: {
                AND: [
                    publishedMenuItemWhere,
                    locale === "es" ? { OR: [{ slugEs: slug }, { slug }] } : { slug },
                ],
            },
            include: { category: { select: { id: true, name: true, nameEs: true, slug: true } } },
        })
        if (!item) return null
        return {
            id: item.id,
            slug: item.slug,
            slugEs: item.slugEs ?? null,
            name: item.name,
            nameEs: item.nameEs ?? null,
            description: item.description,
            descriptionEs: item.descriptionEs ?? null,
            prices: (item.prices ?? {}) as { PEN?: number; USD?: number },
            imageUrl: item.imageUrl ?? "",
            images: item.images,
            tags: item.tags,
            tagsEs: item.tagsEs ?? [],
            tagColors: (item.tagColors ?? {}) as Record<string, string>,
            available: item.available,
            categoryId: item.categoryId,
            categoryName: item.category?.name ?? "",
            categoryNameEs: item.category?.nameEs ?? null,
            categorySlug: item.category?.slug ?? "",
        }
    },
    ["menu-item"],
    { tags: ["menu"], revalidate: 300 }
)

const getRelatedItems = unstable_cache(
    async (categoryId: string, excludeId: string) => {
        const items = await prisma.menuItem.findMany({
            where: {
                AND: [onSaleMenuItemWhere, { categoryId, id: { not: excludeId } }],
            },
            select: {
                id: true,
                slug: true,
                slugEs: true,
                name: true,
                nameEs: true,
                prices: true,
                imageUrl: true,
                tags: true,
                tagsEs: true,
            },
            orderBy: { order: "asc" },
            take: 3,
        })
        return items.map((item) => ({
            ...item,
            prices: (item.prices ?? {}) as { PEN?: number; USD?: number },
            imageUrl: item.imageUrl ?? "",
            tagsEs: item.tagsEs ?? [],
        }))
    },
    ["related-items"],
    { tags: ["menu"], revalidate: 300 }
)

// This page is statically rendered (no per-request dynamic APIs): all data is
// read through unstable_cache (tags "menu" / "discounts") and the layout no
// longer reads auth cookies (they are resolved client-side). That makes the
// route prefetchable for near-instant navigation. New CMS items not in
// generateStaticParams are rendered on-demand and cached (dynamicParams default).
// CMS saves ping /api/revalidate; 300s is the fallback if that hop fails.
export const revalidate = 300

// ── Static params for SSG ──

export async function generateStaticParams() {
    const items = await prisma.menuItem.findMany({
        where: onSaleMenuItemWhere,
        select: { slug: true, slugEs: true },
    })
    const params: { slug: string }[] = []
    for (const item of items) {
        params.push({ slug: item.slug })
        if (item.slugEs) params.push({ slug: item.slugEs })
    }
    return params
}

// ── Metadata ──

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
    const { slug, locale } = await params
    const item = await getMenuItemBySlug(slug, locale)
    if (!item) {
        const tNotFound = await getTranslations({ locale, namespace: "notFound" })
        return { title: tNotFound("metaTitle"), description: tNotFound("metaDescription") }
    }

    const isEs = locale === "es"
    const displayName        = isEs && item.nameEs        ? item.nameEs        : item.name
    const displayDescription = isEs && item.descriptionEs ? item.descriptionEs : item.description

    const baseUrl = siteUrl()
    const localeKey = locale as Locale
    const slugFor = (l: Locale): string => (l === "es" && item.slugEs ? item.slugEs : item.slug)
    const localizedUrl = (l: Locale): string =>
        `${baseUrl}${getPathname({ locale: l, href: { pathname: "/menu/[slug]", params: { slug: slugFor(l) } } })}`

    return {
        title: displayName,
        description: displayDescription,
        alternates: {
            canonical: localizedUrl(localeKey),
            languages: Object.fromEntries(routing.locales.map((l) => [l, localizedUrl(l)])),
        },
        openGraph: {
            title: `${displayName} | Wild Grove`,
            description: displayDescription,
            type: "article",
            url: localizedUrl(localeKey),
            images: item.imageUrl?.trim()
                ? [{ url: item.imageUrl.trim(), width: 800, height: 600, alt: displayName }]
                : [],
        },
        twitter: {
            card: "summary_large_image",
            title: `${displayName} | Wild Grove`,
            description: displayDescription,
            images: item.imageUrl?.trim() ? [item.imageUrl.trim()] : [],
        },
    }
}

// ── Page ──

export default async function MenuProductPage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>
}) {
    const { locale, slug } = await params
    setRequestLocale(locale)
    const t = await getTranslations("menuProduct")

    const item = await getMenuItemBySlug(slug, locale)
    if (!item) notFound()

    const [relatedItems, discounts, settings, ratingAggregate, topReviewsForSchema] = await Promise.all([
        getRelatedItems(item.categoryId ?? "", item.id),
        loadActiveAutomaticDiscounts(),
        getAppSettings(),
        getProductRatingAggregate(item.id),
        getProductReviews(item.id, 1, 5),
    ])
    const discount = getDiscountForItem({ id: item.id, categoryId: item.categoryId }, discounts)
    const galleryAutoPlayInterval = settings.galleryAutoPlayInterval ?? 5

    // Resolve locale-specific display values
    const isEs = locale === "es"
    const displayName        = isEs && item.nameEs        ? item.nameEs        : item.name
    const displayDescription = isEs && item.descriptionEs ? item.descriptionEs : item.description
    const displayTags        = isEs && item.tagsEs?.length ? item.tagsEs       : item.tags
    const displayCategory    = isEs && item.categoryNameEs ? item.categoryNameEs : item.categoryName

    const galleryImageUrls = [
        ...new Set(
            [item.imageUrl, ...item.images]
                .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
                .map((u) => u.trim()),
        ),
    ]
    const hasGallery = galleryImageUrls.length > 0

    // JSON-LD structured data uses the store's only currency when dual currency
    // is off, and the default currency otherwise. Search-engine crawlers never
    // send the wg_currency cookie, so this matches what they see, and keeping
    // the page cookie-free lets it render statically / prefetchable. The price
    // the user actually sees is resolved client-side in the price panel. A dish
    // without a price in that currency carries no offer.
    const structuredCurrency = settings.storeCurrency ?? DEFAULT_CURRENCY
    const structuredPrice = (item.prices as Record<string, number | undefined> | null)?.[structuredCurrency]
    const structuredOfferPrice =
        typeof structuredPrice !== "number"
            ? null
            : discount
                ? computeDiscountedPrice(structuredPrice, discount, structuredCurrency)
                : structuredPrice

    const cartUnitPricesForSnapshot = discount
        ? displayCartUnitPrices(item.prices as Record<string, number>, discount)
        : null

    // JSON-LD structured data
    const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "MenuItem",
        name: displayName,
        description: displayDescription,
        offers: structuredOfferPrice === null ? undefined : {
            "@type": "Offer",
            price: structuredOfferPrice.toFixed(2),
            priceCurrency: structuredCurrency,
            availability: item.available
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
        },
        image: item.imageUrl?.trim() || undefined,
    }
    if (ratingAggregate.count > 0) {
        jsonLd.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: ratingAggregate.average.toFixed(1),
            ratingCount: ratingAggregate.count,
            bestRating: "5",
            worstRating: "1",
        }
        jsonLd.review = topReviewsForSchema.reviews.map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            author: { "@type": "Person", name: r.authorName },
            reviewBody: r.comment,
            datePublished: r.createdAt,
        }))
    }

    const enSlug = item.slug
    const esSlug = item.slugEs ?? item.slug

    return (
        <>
            <SetAlternateLocale urls={{ en: `/menu/${enSlug}`, es: `/menu/${esSlug}` }} />
            <ScrollAnimator />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
            />

            <div className="pt-6 pb-16 px-4 sm:px-6 lg:px-10">
                <div className="max-w-6xl mx-auto">

                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-1.5 text-xs text-wg-muted dark:text-wg-dark-muted py-6 mb-2" aria-label={t("breadcrumbLabel")}>
                        <Link href="/menu" className="hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors">
                            {t("breadcrumbMenu")}
                        </Link>
                        <ChevronRightIcon className="w-3 h-3 opacity-50" strokeWidth={2} />
                        <span className="opacity-60">{displayCategory}</span>
                        <ChevronRightIcon className="w-3 h-3 opacity-50" strokeWidth={2} />
                        <span className="text-wg-text dark:text-wg-dark-text font-medium truncate">{displayName}</span>
                    </nav>

                    {/* ── Product layout ── */}
                    <div
                        className={`grid grid-cols-1 gap-8 lg:gap-14 items-start${hasGallery ? " lg:grid-cols-[3fr_2fr]" : ""}`}
                        data-animate=""
                    >

                        {/* LEFT — Image gallery (only when the item has real images) */}
                        {hasGallery && (
                            <ProductGallery
                                images={galleryImageUrls}
                                alt={displayName}
                                categoryName={displayCategory}
                                available={item.available}
                                autoPlayInterval={galleryAutoPlayInterval}
                            />
                        )}

                        {/* RIGHT — Details */}
                        <div className="flex flex-col gap-0 lg:pt-2">

                            {/* Category label */}
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-wg-accent dark:text-wg-dark-accent mb-3">
                                {displayCategory}
                            </p>

                            {/* Title + Share */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <h1 className="font-display text-4xl sm:text-5xl font-bold text-wg-text dark:text-wg-dark-text leading-tight">
                                    {displayName}
                                </h1>
                                <ShareButton title={displayName} description={displayDescription} />
                            </div>

                            {/* Aggregate rating pill */}
                            {ratingAggregate.count > 0 && (
                                <a
                                    href="#reviews"
                                    className="inline-flex items-center gap-1 mb-4 hover:opacity-80 transition-opacity"
                                >
                                    <RatingPill average={ratingAggregate.average} count={ratingAggregate.count} />
                                </a>
                            )}

                            {/* Decorative rule */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-px flex-1 bg-wg-border dark:bg-wg-dark-border" />
                                <StarSolidIcon className="w-3 h-3 text-wg-accent/50 dark:text-wg-dark-accent/50 shrink-0" />
                                <div className="h-px flex-1 bg-wg-border dark:bg-wg-dark-border" />
                            </div>

                            {/* Description */}
                            <p className="text-base text-wg-muted dark:text-wg-dark-muted leading-relaxed mb-6">
                                {displayDescription}
                            </p>

                            {/* Tags */}
                            {displayTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {displayTags.map((tag) => (
                                        <Badge key={tag} tag={tag} readable customColor={item.tagColors?.[tag]} />
                                    ))}
                                </div>
                            )}

                            <MenuProductPricePanel
                                prices={item.prices}
                                discount={discount}
                                locale={locale}
                                reserveTableLabel={t("reserveTable")}
                                perServingLabel={t("perServing")}
                                cartSnapshot={{
                                    id: item.id,
                                    name: item.name,
                                    nameEs: item.nameEs,
                                    imageUrl: item.imageUrl?.trim() || null,
                                    prices: item.prices as Record<string, number>,
                                    available: item.available,
                                    ...(cartUnitPricesForSnapshot
                                        ? {
                                              displayUnitPricePEN: cartUnitPricesForSnapshot.unitPricePEN,
                                              displayUnitPriceUSD: cartUnitPricesForSnapshot.unitPriceUSD,
                                          }
                                        : {}),
                                }}
                            />
                        </div>
                    </div>

                    {/* ── Product Reviews ── */}
                    <ProductReviewsSection menuItemId={item.id} locale={locale} />

                    {/* ── Related dishes ── */}
                    {relatedItems.length > 0 && (
                        <section className="mt-20 pt-10 border-t border-wg-border/40 dark:border-wg-dark-border" data-animate="">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                                    {t("relatedTitle")}
                                </h2>
                                <Link
                                    href="/menu"
                                    className="text-sm text-wg-accent dark:text-wg-dark-accent hover:opacity-80 transition-opacity font-medium"
                                >
                                    {t("breadcrumbMenu")}
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {relatedItems.map((related) => {
                                    const rIsEs = locale === "es"
                                    const rName     = rIsEs && related.nameEs     ? related.nameEs     : related.name
                                    const rTags     = rIsEs && related.tagsEs?.length ? related.tagsEs   : related.tags
                                    const rHref     = rIsEs && related.slugEs     ? `/menu/${related.slugEs}` : `/menu/${related.slug}`
                                    const rHasImage = Boolean(related.imageUrl?.trim())
                                    const rDiscount = getDiscountForItem({ id: related.id, categoryId: item.categoryId }, discounts)
                                    return (
                                        <Link key={related.id} href={rHref} className="group block">
                                            <div className="bg-wg-surface dark:bg-wg-dark-raised rounded-card overflow-hidden border border-wg-border/50 dark:border-wg-dark-border group-hover:-translate-y-1 group-hover:shadow-elevated dark:group-hover:shadow-glow-md transition-all duration-300">
                                                {rHasImage ? (
                                                    <div className="relative h-44 overflow-hidden">
                                                        <FadeInImage
                                                            src={related.imageUrl}
                                                            alt={rName}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                            sizes="(max-width: 768px) 100vw, 33vw"
                                                        />
                                                        <RelatedDishPricePill
                                                            prices={related.prices}
                                                            discount={rDiscount}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="px-4 pt-4 flex justify-end">
                                                        <RelatedDishPricePill
                                                            prices={related.prices}
                                                            discount={rDiscount}
                                                            placement="inline"
                                                        />
                                                    </div>
                                                )}
                                                <div className="p-4">
                                                    <h3 className="font-display text-base font-semibold text-wg-text dark:text-wg-dark-text leading-snug mb-2 group-hover:text-wg-accent dark:group-hover:text-wg-dark-accent transition-colors">
                                                        {rName}
                                                    </h3>
                                                    {rTags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {rTags.map((tag) => (
                                                                <Badge key={tag} tag={tag} readable />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </>
    )
}
