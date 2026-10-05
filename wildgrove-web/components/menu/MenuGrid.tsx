"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { MenuCard } from "@/components/menu/MenuCard"
import type { MenuCategoryData } from "@wildgrove/core/data/menu-seed"
import type { ActiveMenuDiscount } from "@wildgrove/core/menu-discounts"
import { ClocheIcon, DessertsIcon, DrinksIcon, MainsIcon, StartersIcon } from "@wildgrove/ui/icons"

interface MenuGridProps {
    categories: MenuCategoryData[]
    locale: string
    discounts?: ActiveMenuDiscount[]
    ratings?: Record<string, { average: number; count: number }>
}

function MenuEmptyState() {
    const t = useTranslations("menu")

    const PREVIEW_CATEGORIES = [
        {
            icon: <StartersIcon className="w-7 h-7" />,
            label: t("catStarters"),
            description: t("catStartersDesc"),
        },
        {
            icon: <MainsIcon className="w-7 h-7" />,
            label: t("catMains"),
            description: t("catMainsDesc"),
        },
        {
            icon: <DessertsIcon className="w-7 h-7" />,
            label: t("catDesserts"),
            description: t("catDessertsDesc"),
        },
        {
            icon: <DrinksIcon className="w-7 h-7" />,
            label: t("catDrinks"),
            description: t("catDrinksDesc"),
        },
    ]

    return (
        <div>
            {/* Coming soon banner */}
            <div className="max-w-2xl mx-auto mb-14 rounded-card border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface px-8 py-10 text-center" data-animate="">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[18px] bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary mb-5 mx-auto">
                    <ClocheIcon className="w-9 h-9" />
                </div>
                <p className="text-wg-accent dark:text-wg-dark-accent text-xs font-semibold uppercase tracking-[0.15em] mb-2">
                    {t("emptySubtitle")}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-3">
                    {t("emptyTitle")}
                </h2>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted leading-relaxed max-w-md mx-auto mb-6">
                    {t("emptyDescription")}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/reservations"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-brand bg-wg-primary hover:bg-wg-primary/90 dark:bg-wg-dark-primary dark:hover:bg-wg-dark-primary/90 text-white text-sm font-medium transition-colors shadow-card"
                    >
                        {t("emptyReserve")}
                    </Link>
                    <Link
                        href="/contact"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-border/30 dark:hover:bg-wg-dark-border/30 text-sm font-medium transition-colors"
                    >
                        {t("emptyContact")}
                    </Link>
                </div>
            </div>

            {/* Category previews */}
            <div className="mb-8">
                <p className="text-center text-xs text-wg-muted dark:text-wg-dark-muted uppercase tracking-[0.15em] font-medium mb-6">
                    {t("expectTitle")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {PREVIEW_CATEGORIES.map((cat, index) => (
                        <div
                            key={cat.label}
                            className="p-5 rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-center opacity-70"
                            data-animate=""
                            style={{ transitionDelay: `${index * 80}ms` }}
                        >
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/10 text-wg-primary dark:text-wg-dark-primary mb-3">
                                {cat.icon}
                            </div>
                            <h3 className="font-display text-base font-semibold text-wg-text dark:text-wg-dark-text mb-1">
                                {cat.label}
                            </h3>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                {cat.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quote */}
            <div className="text-center mt-12 mb-4" data-animate="">
                <p className="font-display text-xl italic text-wg-muted dark:text-wg-dark-muted">
                    &ldquo;{t("quote")}&rdquo;
                </p>
            </div>

        </div>
    )
}

function CategoryTabs({
    categories,
    locale,
    activeCategory,
    onSelect,
}: {
    categories: MenuCategoryData[]
    locale: string
    activeCategory: string
    onSelect: (slug: string) => void
}) {
    const t = useTranslations("menu")
    const scrollerRef = useRef<HTMLElement>(null)
    const [overflow, setOverflow] = useState({ left: false, right: false })

    const updateOverflow = useCallback(() => {
        const el = scrollerRef.current
        if (!el) return
        const { scrollLeft, clientWidth, scrollWidth } = el
        setOverflow({
            left: scrollLeft > 1,
            right: scrollLeft + clientWidth < scrollWidth - 1,
        })
    }, [])

    useEffect(() => {
        const el = scrollerRef.current
        if (!el) return

        updateOverflow()
        const frame = requestAnimationFrame(updateOverflow)
        el.addEventListener("scroll", updateOverflow, { passive: true })
        window.addEventListener("resize", updateOverflow)
        const observer = new ResizeObserver(updateOverflow)
        observer.observe(el)

        return () => {
            cancelAnimationFrame(frame)
            el.removeEventListener("scroll", updateOverflow)
            window.removeEventListener("resize", updateOverflow)
            observer.disconnect()
        }
    }, [updateOverflow, categories.length])

    useEffect(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const tab = scroller.querySelector(`[data-slug="${CSS.escape(activeCategory)}"]`)
        if (!(tab instanceof HTMLElement)) return

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const left = tab.offsetLeft - (scroller.clientWidth - tab.offsetWidth) / 2
        scroller.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" })
    }, [activeCategory])

    return (
        <div className="relative mb-10 min-w-0">
            {overflow.left && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-brand bg-gradient-to-r from-wg-bg dark:from-wg-dark-bg to-transparent"
                />
            )}
            {overflow.right && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-brand bg-gradient-to-l from-wg-bg dark:from-wg-dark-bg to-transparent"
                />
            )}
            <nav
                ref={scrollerRef}
                role="tablist"
                aria-label={t("categoriesNav")}
                className="flex w-max max-w-full min-w-0 mx-auto gap-1 p-1 overflow-x-auto overscroll-x-contain touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-brand bg-wg-border/30 dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border"
            >
                {categories.map((cat) => {
                    const selected = activeCategory === cat.slug
                    const label = locale === "es" && cat.nameEs ? cat.nameEs : cat.name
                    return (
                        <button
                            key={cat.slug}
                            type="button"
                            role="tab"
                            data-slug={cat.slug}
                            aria-selected={selected}
                            onClick={() => onSelect(cat.slug)}
                            className={`shrink-0 whitespace-nowrap px-4 sm:px-5 py-2 text-sm font-medium rounded-[0.5rem] transition-all duration-200 ${
                                selected
                                    ? "bg-wg-primary text-white dark:bg-wg-dark-primary shadow-card"
                                    : "text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text hover:bg-wg-border/40 dark:hover:bg-wg-dark-border"
                            }`}
                        >
                            {label}
                        </button>
                    )
                })}
            </nav>
        </div>
    )
}

export function MenuGrid({ categories, locale, discounts = [], ratings = {} }: MenuGridProps) {
    const [activeCategory, setActiveCategory] = useState(categories[0]?.slug ?? "")

    if (categories.length === 0) {
        return <MenuEmptyState />
    }

    const activeCat = categories.find((c) => c.slug === activeCategory) ?? categories[0]

    return (
        <div>
            <CategoryTabs
                categories={categories}
                locale={locale}
                activeCategory={activeCat.slug}
                onSelect={setActiveCategory}
            />

            {/* Menu items grid */}
            <div className={
                (activeCat?.items.length ?? 0) === 1
                    ? "grid grid-cols-1 max-w-xl mx-auto gap-6"
                    : (activeCat?.items.length ?? 0) === 2
                        ? "grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-6"
                        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            }>
                {activeCat?.items.map((item) => (
                    <MenuCard
                        key={item.id}
                        item={item}
                        locale={locale}
                        discounts={discounts}
                        rating={ratings[item.id]}
                    />
                ))}
            </div>
        </div>
    )
}
