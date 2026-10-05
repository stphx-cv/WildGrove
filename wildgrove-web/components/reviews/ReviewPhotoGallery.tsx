"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { ChevronLeftMidIcon, ChevronRightMidIcon, CloseIcon, ExpandIcon } from "@wildgrove/ui/icons"
import { useTranslations } from "next-intl"

/** Slightly springy — noticeable growth without feeling sluggish */
const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Both of these are browser state, not component state, so they are read with
 * useSyncExternalStore: it gives the server and the first client render the
 * same answer and then subscribes, instead of setting state from an effect.
 */
function subscribeReduceMotion(onChange: () => void) {
    const mq = window.matchMedia(REDUCE_MOTION_QUERY)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
}

/** The portal needs a document, so it waits for the client. Never changes after. */
const subscribeNothing = () => () => {}

const EASE_EXPAND = "cubic-bezier(0.22, 1, 0.36, 1)"
const OPEN_MS = 300
const CLOSE_MS = 260
const BACKDROP_IN_MS = 280
const BACKDROP_OUT_MS = 520

interface ReviewPhotoGalleryProps {
    photos: string[]
    reviewerLabel: string
    className?: string
}

type LightboxPhase = "closed" | "entering" | "open" | "leaving"

interface SnapRect {
    left: number
    top: number
    width: number
    height: number
    borderRadius: number
}

function rectFromElement(el: HTMLElement): SnapRect {
    const r = el.getBoundingClientRect()
    return {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        borderRadius: 16,
    }
}

function getExpandedRect(): SnapRect {
    const pad = 24
    const width = Math.min(window.innerWidth * 0.68, 460, window.innerWidth - pad * 2)
    const height = Math.min(window.innerHeight * 0.5, 360, window.innerHeight - pad * 2)
    return {
        left: (window.innerWidth - width) / 2,
        top: (window.innerHeight - height) / 2,
        width,
        height,
        borderRadius: 18,
    }
}

function snapStyle(rect: SnapRect, animate: boolean): CSSProperties {
    return {
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: rect.borderRadius,
        transition: animate
            ? `left ${OPEN_MS}ms ${EASE_EXPAND}, top ${OPEN_MS}ms ${EASE_EXPAND}, width ${OPEN_MS}ms ${EASE_EXPAND}, height ${OPEN_MS}ms ${EASE_EXPAND}, border-radius ${OPEN_MS}ms ${EASE_EXPAND}, box-shadow ${OPEN_MS}ms ${EASE_EXPAND}`
            : "none",
        zIndex: 101,
        overflow: "hidden",
        boxShadow: animate
            ? "0 24px 80px rgba(0,0,0,0.45)"
            : "0 8px 24px rgba(0,0,0,0.2)",
    }
}

export function ReviewPhotoGallery({ photos, reviewerLabel, className }: ReviewPhotoGalleryProps) {
    const t = useTranslations("common")
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const [phase, setPhase] = useState<LightboxPhase>("closed")
    const [snapRect, setSnapRect] = useState<SnapRect | null>(null)
    const [animateSnap, setAnimateSnap] = useState(false)
    const [imageFade, setImageFade] = useState(false)
    const [backdropVisible, setBackdropVisible] = useState(false)
    const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false)
    const reduceMotion = useSyncExternalStore(
        subscribeReduceMotion,
        () => window.matchMedia(REDUCE_MOTION_QUERY).matches,
        () => false,
    )
    const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearCloseTimer = useCallback(() => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
        }
    }, [])

    // A close animation in flight must not outlive the component
    useEffect(() => clearCloseTimer, [clearCloseTimer])

    const openAt = useCallback(
        (index: number, thumbEl: HTMLButtonElement | null) => {
            clearCloseTimer()
            const origin = thumbEl ? rectFromElement(thumbEl) : getExpandedRect()

            setActiveIndex(index)
            setSnapRect(origin)
            setAnimateSnap(false)
            setBackdropVisible(false)
            setPhase("entering")

            if (reduceMotion) {
                setSnapRect(getExpandedRect())
                setPhase("open")
                setAnimateSnap(false)
                setBackdropVisible(true)
                return
            }

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimateSnap(true)
                    setSnapRect(getExpandedRect())
                    setPhase("open")
                    setBackdropVisible(true)
                })
            })
        },
        [clearCloseTimer, reduceMotion],
    )

    const close = useCallback(() => {
        if (phase === "closed" || phase === "leaving") return
        clearCloseTimer()

        if (reduceMotion || activeIndex === null) {
            setBackdropVisible(false)
            setPhase("closed")
            setActiveIndex(null)
            setSnapRect(null)
            setAnimateSnap(false)
            return
        }

        const thumbEl = thumbRefs.current[activeIndex]
        const collapseTo = thumbEl ? rectFromElement(thumbEl) : snapRect

        setBackdropVisible(false)
        setPhase("leaving")
        setAnimateSnap(true)
        if (collapseTo) setSnapRect(collapseTo)

        closeTimer.current = setTimeout(() => {
            setActiveIndex(null)
            setPhase("closed")
            setSnapRect(null)
            setAnimateSnap(false)
            closeTimer.current = null
        }, Math.max(CLOSE_MS, BACKDROP_OUT_MS))
    }, [activeIndex, clearCloseTimer, phase, reduceMotion, snapRect])

    useEffect(() => {
        if (phase === "open" || phase === "entering" || phase === "leaving") {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [phase])

    useEffect(() => {
        if (activeIndex === null) return

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                close()
                return
            }
            if (photos.length <= 1) return
            if (e.key === "ArrowLeft") {
                setImageFade(true)
                setActiveIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length))
            }
            if (e.key === "ArrowRight") {
                setImageFade(true)
                setActiveIndex((i) => (i === null ? null : (i + 1) % photos.length))
            }
        }

        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [activeIndex, close, photos.length])

    useEffect(() => {
        if (!imageFade) return
        const id = requestAnimationFrame(() => setImageFade(false))
        return () => cancelAnimationFrame(id)
    }, [activeIndex, imageFade])

    if (photos.length === 0) return null

    const activeUrl = activeIndex !== null ? photos[activeIndex] : null
    const photoAlt = t("reviewPhotoAlt", { name: reviewerLabel })
    const isLightboxVisible = phase !== "closed" && activeUrl !== null && snapRect !== null
    const isExpanded = phase === "open"
    const showChrome = isExpanded && !imageFade
    const backdropTransitionMs = backdropVisible ? BACKDROP_IN_MS : BACKDROP_OUT_MS

    const goTo = (next: number) => {
        setImageFade(true)
        setActiveIndex(next)
    }

    const lightbox =
        isLightboxVisible && mounted
            ? createPortal(
                  <>
                      <div
                          role="presentation"
                          className="fixed inset-0 z-[100]"
                          onClick={close}
                          style={{
                              transition: `opacity ${backdropTransitionMs}ms ${EASE_EXPAND}, backdrop-filter ${backdropTransitionMs}ms ${EASE_EXPAND}, background-color ${backdropTransitionMs}ms ${EASE_EXPAND}`,
                              opacity: backdropVisible ? 1 : 0,
                              backgroundColor: backdropVisible ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0)",
                              backdropFilter: backdropVisible ? "blur(16px)" : "blur(0px)",
                              WebkitBackdropFilter: backdropVisible ? "blur(16px)" : "blur(0px)",
                          }}
                      />

                      <div
                          role="dialog"
                          aria-modal="true"
                          aria-label={t("reviewPhotoPreview")}
                          className="fixed inset-0 z-[100] pointer-events-none"
                      >
                          <div
                              className="pointer-events-auto ring-1 ring-white/10"
                              style={snapStyle(snapRect, animateSnap && (phase === "open" || phase === "leaving"))}
                              onClick={(e) => e.stopPropagation()}
                          >
                              <Image
                                  key={activeUrl}
                                  src={activeUrl}
                                  alt={photoAlt}
                                  fill
                                  className="object-cover"
                                  style={{
                                      transition: `opacity 200ms ${EASE_EXPAND}`,
                                      opacity: imageFade ? 0 : 1,
                                  }}
                                  sizes="100vw"
                                  priority
                              />
                          </div>

                          <button
                              type="button"
                              onClick={close}
                              className="pointer-events-auto absolute top-4 right-4 sm:top-6 sm:right-6 z-[102] flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 backdrop-blur-md hover:bg-white/20 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"
                              style={{
                                  transition: `opacity ${OPEN_MS}ms ${EASE_EXPAND}, transform 200ms ${EASE_EXPAND}`,
                                  opacity: showChrome ? 1 : 0,
                                  transform: showChrome ? "scale(1)" : "scale(0.85)",
                              }}
                              aria-label={t("closePhotoPreview")}
                          >
                              <CloseIcon className="h-5 w-5" strokeWidth={2} />
                          </button>

                          {photos.length > 1 && (
                              <>
                                  <div
                                      className="pointer-events-none absolute inset-0 z-[102] flex items-center justify-between px-2 sm:px-6"
                                      style={{
                                          transition: `opacity ${OPEN_MS}ms ${EASE_EXPAND}`,
                                          opacity: showChrome ? 1 : 0,
                                      }}
                                  >
                                      <NavButton
                                          direction="prev"
                                          label={t("previousPhoto")}
                                          onClick={() =>
                                              goTo(
                                                  activeIndex === null
                                                      ? 0
                                                      : (activeIndex - 1 + photos.length) % photos.length,
                                              )
                                          }
                                      />
                                      <NavButton
                                          direction="next"
                                          label={t("nextPhoto")}
                                          onClick={() =>
                                              goTo(
                                                  activeIndex === null
                                                      ? 0
                                                      : (activeIndex + 1) % photos.length,
                                              )
                                          }
                                      />
                                  </div>

                                  {activeIndex !== null && (
                                      <p
                                          className="pointer-events-none absolute bottom-6 left-1/2 z-[102] -translate-x-1/2 text-xs font-medium tracking-wide text-white/55"
                                          style={{
                                              transition: `opacity ${OPEN_MS}ms ${EASE_EXPAND}`,
                                              opacity: showChrome ? 1 : 0,
                                          }}
                                      >
                                          {t("photoCounter", { current: activeIndex + 1, total: photos.length })}
                                      </p>
                                  )}
                              </>
                          )}
                      </div>
                  </>,
                  document.body,
              )
            : null

    return (
        <>
            <div className={className ?? "flex flex-wrap gap-2"}>
                {photos.map((url, index) => {
                    const isActiveThumb = activeIndex === index && phase !== "closed"
                    return (
                        <button
                            key={url}
                            ref={(el) => {
                                thumbRefs.current[index] = el
                            }}
                            type="button"
                            onClick={(e) => openAt(index, e.currentTarget)}
                            className={[
                                "group relative h-[4.25rem] w-[4.25rem] sm:h-20 sm:w-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-wg-border/45 dark:border-wg-dark-border/70 bg-wg-bg/50 dark:bg-wg-dark-bg/40 shadow-card transition-[transform,box-shadow,border-color,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.05] hover:border-wg-accent/35 hover:shadow-elevated dark:hover:border-wg-dark-accent/40 dark:hover:shadow-glow-sm active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent/50 dark:focus-visible:ring-wg-dark-accent/50 motion-reduce:transition-none motion-reduce:hover:scale-100",
                                isActiveThumb ? "opacity-0" : "opacity-100",
                            ].join(" ")}
                            aria-label={t("viewReviewPhoto")}
                        >
                            <FadeInImage
                                src={url}
                                alt={photoAlt}
                                fill
                                className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 motion-reduce:group-hover:scale-100"
                                sizes="(max-width: 640px) 68px, 80px"
                            />
                            <span
                                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                aria-hidden="true"
                            />
                            <span
                                className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-[opacity,transform] duration-300 group-hover:opacity-100 group-hover:scale-100 scale-90"
                                aria-hidden="true"
                            >
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-wg-primary shadow-sm dark:bg-white/15 dark:text-wg-dark-text dark:backdrop-blur-sm">
                                    <ExpandIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>
            {lightbox}
        </>
    )
}

function NavButton({
    direction,
    label,
    onClick,
}: {
    direction: "prev" | "next"
    label: string
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="pointer-events-auto hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/85 backdrop-blur-md transition-[transform,background-color] duration-200 hover:bg-white/15 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            aria-label={label}
        >
            {direction === "prev"
                ? <ChevronLeftMidIcon className="h-5 w-5" strokeWidth={2} />
                : <ChevronRightMidIcon className="h-5 w-5" strokeWidth={2} />
            }
        </button>
    )
}

