"use client"

// ══════════════════════════════════════════════════════════════════
// ProductGallery — Interactive image gallery for the product page
// • Cross-fade transition between images
// • Prev/next arrow buttons (only when 2+ images)
// • Touch/swipe support on mobile
// • Auto-play with configurable interval (0 = disabled)
// • Pause/play button when auto-play is active
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslations } from "next-intl"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { ChevronLeftIcon, ChevronRightIcon, PauseSolidIcon, PlaySolidIcon } from "@wildgrove/ui/icons"

interface ProductGalleryProps {
    images: string[]
    alt: string
    categoryName: string
    available: boolean
    /** Seconds between automatic slide changes. 0 = disabled. */
    autoPlayInterval?: number
}

export function ProductGallery({ images, alt, categoryName, available, autoPlayInterval = 0 }: ProductGalleryProps) {
    const t = useTranslations("menu")
    const [activeIndex, setActiveIndex]   = useState(0)
    const [prevIndex, setPrevIndex]       = useState<number | null>(null)
    const [animKey, setAnimKey]           = useState(0)
    const [isHovered, setIsHovered]       = useState(false)
    const [isPaused, setIsPaused]         = useState(false)
    const touchStartX                     = useRef<number | null>(null)

    const hasMultiple   = images.length >= 2
    const autoPlayOn    = hasMultiple && autoPlayInterval > 0
    const autoPlayRunning = autoPlayOn && !isPaused && !isHovered

    // ── Navigate to a specific index with cross-fade ───────────────
    const goTo = useCallback((index: number) => {
        setActiveIndex(prev => {
            const next = (index + images.length) % images.length
            if (next === prev) return prev
            setPrevIndex(prev)
            setAnimKey(k => k + 1)
            return next
        })
    }, [images.length])

    const goPrev = useCallback(() => {
        setActiveIndex(prev => {
            const next = (prev - 1 + images.length) % images.length
            setPrevIndex(prev)
            setAnimKey(k => k + 1)
            return next
        })
    }, [images.length])

    const goNext = useCallback(() => {
        setActiveIndex(prev => {
            const next = (prev + 1) % images.length
            setPrevIndex(prev)
            setAnimKey(k => k + 1)
            return next
        })
    }, [images.length])

    // ── Auto-play ──────────────────────────────────────────────────
    useEffect(() => {
        if (!autoPlayRunning) return
        const timer = setInterval(goNext, autoPlayInterval! * 1000)
        return () => clearInterval(timer)
    }, [autoPlayRunning, autoPlayInterval, goNext])

    // ── Touch / swipe ──────────────────────────────────────────────
    function handleTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0].clientX
    }
    function handleTouchEnd(e: React.TouchEvent) {
        if (touchStartX.current === null || !hasMultiple) return
        const delta = touchStartX.current - e.changedTouches[0].clientX
        if (Math.abs(delta) > 40) {
            if (delta > 0) goNext()
            else goPrev()
        }
        touchStartX.current = null
    }

    const activeImage = images[activeIndex] ?? images[0]
    const prevImage   = prevIndex !== null ? images[prevIndex] : null

    if (images.length === 0) return null

    return (
        <div className="flex flex-col gap-3">
            {/* ── Main image ── */}
            <div
                className="relative aspect-[4/3] lg:aspect-[16/11] rounded-card overflow-hidden shadow-elevated dark:shadow-glow-md"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Base layer — previous image (stays visible while new one fades in) */}
                {prevImage && (
                    <FadeInImage
                        key={`prev-${prevIndex}`}
                        src={prevImage}
                        alt={alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 60vw"
                    />
                )}

                {/* Active layer — fades in on top */}
                <div
                    key={animKey}
                    className="absolute inset-0"
                    style={{ animation: animKey > 0 ? "galleryFadeIn 0.45s ease forwards" : undefined }}
                >
                    <FadeInImage
                        src={activeImage}
                        alt={alt}
                        fill
                        className="object-cover"
                        priority={animKey === 0}
                        sizes="(max-width: 1024px) 100vw, 60vw"
                    />
                </div>

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                {/* Category pill */}
                <span className="absolute bottom-4 left-4 text-[11px] font-semibold uppercase tracking-widest text-white/90 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                    {categoryName}
                </span>

                {/* Image counter */}
                {hasMultiple && (
                    <span className="absolute top-3 right-3 text-[11px] font-semibold text-white/80 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                        {activeIndex + 1} / {images.length}
                    </span>
                )}

                {/* Pause / play button (auto-play only) */}
                {autoPlayOn && (
                    <button
                        type="button"
                        onClick={() => setIsPaused(p => !p)}
                        aria-label={isPaused ? "Resume auto-play" : "Pause auto-play"}
                        className="absolute bottom-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                    >
                        {isPaused ? (
                            /* Play icon */
                            <PlaySolidIcon className="w-3.5 h-3.5 translate-x-px" />
                        ) : (
                            /* Pause icon */
                            <PauseSolidIcon className="w-3.5 h-3.5" />
                        )}
                    </button>
                )}

                {/* Prev / Next arrows */}
                {hasMultiple && (
                    <>
                        <button
                            type="button"
                            onClick={goPrev}
                            aria-label={t("previousImage")}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                            <ChevronLeftIcon className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            aria-label={t("nextImage")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                            <ChevronRightIcon className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                    </>
                )}

                {/* Unavailable overlay */}
                {!available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                        <span className="bg-wg-dark-bg/90 text-white text-sm font-semibold px-5 py-2.5 rounded-brand uppercase tracking-widest border border-white/10">
                            {t("unavailable")}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Thumbnail strip ── */}
            {hasMultiple && (
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {images.map((img, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goTo(i)}
                            aria-label={t("viewImage", { number: i + 1 })}
                            className={`relative flex-shrink-0 w-[72px] h-[54px] rounded-brand overflow-hidden border-2 transition-all duration-200 ${
                                i === activeIndex
                                    ? "border-wg-accent dark:border-wg-dark-accent shadow-card"
                                    : "border-transparent opacity-50 hover:opacity-80 hover:border-wg-border/60 dark:hover:border-wg-dark-border"
                            }`}
                        >
                            <FadeInImage
                                src={img}
                                alt={`${alt} ${i + 1}`}
                                fill
                                className="object-cover"
                                sizes="72px"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
