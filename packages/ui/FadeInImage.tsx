"use client"

// ══════════════════════════════════════════════════════════════════
// FadeInImage — next/image with a smooth first-load reveal
// • An image that is still downloading is held invisible and fades in
//   when it finishes, instead of popping into place
// • Already-cached images render instantly (no fade, no flash)
// • `priority` images are never faded — they are LCP candidates and an
//   entrance animation delays the measured LCP (see globals.css)
// • The reveal is applied by the ref callback (client-only, before paint),
//   so server markup keeps images visible for no-JS visitors
// ══════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react"
import Image, { type ImageProps } from "next/image"

/** idle = no reveal classes (SSR, cached, priority) · pending = hidden · revealed = fading in */
type RevealPhase = "idle" | "pending" | "revealed"

export function FadeInImage({ alt, className, onLoad, onError, priority, ...props }: ImageProps) {
    const [phase, setPhase] = useState<RevealPhase>("idle")

    // Runs on mount in the browser only, before the first paint: an image that
    // is already decoded (browser / Next cache) is left alone, one that still
    // has to download is hidden until its load event.
    const measureOnMount = useCallback((img: HTMLImageElement | null) => {
        if (!img || priority) return
        if (!img.complete) setPhase("pending")
    }, [priority])

    const handleLoad = useCallback<NonNullable<ImageProps["onLoad"]>>((event) => {
        setPhase(prev => (prev === "pending" ? "revealed" : prev))
        onLoad?.(event)
    }, [onLoad])

    const handleError = useCallback<NonNullable<ImageProps["onError"]>>((event) => {
        // A broken image must never stay stuck at opacity 0.
        setPhase("idle")
        onError?.(event)
    }, [onError])

    const revealClass =
        phase === "pending"  ? "img-reveal-pending" :
        phase === "revealed" ? "img-reveal-done"    : ""

    return (
        <Image
            {...props}
            alt={alt}
            ref={measureOnMount}
            priority={priority}
            onLoad={handleLoad}
            onError={handleError}
            className={`${className ?? ""} ${revealClass}`.trim() || undefined}
        />
    )
}
