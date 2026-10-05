"use client"

// ══════════════════════════════════════════════════════════════════
// ImageUploader — Drag & drop image upload with crop modal
// Crop is always 4:3 (matching the menu item display aspect ratio)
// ══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { createClient } from "@wildgrove/core/clients/client"
import { ArrowPathIcon, CheckCompactIcon, CloseIcon, PhotoSunIcon, Spinner } from "@wildgrove/ui/icons"

// ── Constants ──

const CONT_W = 360          // crop canvas display width  (px)
const CONT_H = 270          // crop canvas display height (px) — 4:3
const RATIO  = 4 / 3        // always 4:3 aspect ratio
const MIN_W  = 80           // minimum crop box display width (px)
const OUT_W  = 800          // output image width  (px)
const OUT_H  = 600          // output image height (px) — 4:3
const DIAG   = Math.sqrt(16 + 9) // ≈ 5 — for diagonal projection
const DX_F   = 4 / DIAG          // horizontal weight
const DY_F   = 3 / DIAG          // vertical weight

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

// ── Types ──

type DragType = "move" | "nw" | "ne" | "sw" | "se"
interface Bounds { x: number; y: number; w: number; h: number }
interface Crop   { x: number; y: number; w: number } // height = w / RATIO

const CORNER_POS: Record<string, React.CSSProperties> = {
    nw: { top: -6,    left: -6,  cursor: "nw-resize" },
    ne: { top: -6,    right: -6, cursor: "ne-resize" },
    sw: { bottom: -6, left: -6,  cursor: "sw-resize" },
    se: { bottom: -6, right: -6, cursor: "se-resize" },
}

// ── Props ──

interface ImageUploaderProps {
    value?: string | null
    onChange: (url: string | null) => void
    bucket?: string
    aspectRatio?: string
}

// ── Component ──

export function ImageUploader({
    value,
    onChange,
    bucket = "menu-images",
    aspectRatio = "aspect-[4/3]",
}: ImageUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cropBoxRef   = useRef<HTMLDivElement>(null)

    const [mounted, setMounted]       = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging]   = useState(false)
    const [error, setError]             = useState<string | null>(null)

    // Crop state
    const [rawDataUrl, setRawDataUrl] = useState<string | null>(null)
    const [imgBounds, setImgBounds]   = useState<Bounds>({ x: 0, y: 0, w: CONT_W, h: CONT_H })
    const [crop, setCrop]             = useState<Crop>({ x: 0, y: 0, w: CONT_W })

    // Refs to avoid stale closures during drag
    const imgBoundsRef = useRef(imgBounds)
    const cropRef      = useRef(crop)
    useEffect(() => { imgBoundsRef.current = imgBounds }, [imgBounds])
    useEffect(() => { cropRef.current      = crop      }, [crop])
    useEffect(() => { setMounted(true) }, [])

    // ── Clamp crop inside image bounds (maintains 4:3) ──
    function clampCrop(x: number, y: number, w: number, b: Bounds): Crop {
        const maxW = Math.min(b.w, b.h * RATIO)
        const cw   = Math.max(MIN_W, Math.min(w, maxW))
        const ch   = cw / RATIO
        const cx   = Math.max(b.x, Math.min(x, b.x + b.w - cw))
        const cy   = Math.max(b.y, Math.min(y, b.y + b.h - ch))
        return { x: cx, y: cy, w: cw }
    }

    // ── Drag system (direct DOM — no React re-renders per frame) ──
    function startDrag(type: DragType, startX: number, startY: number) {
        const start = { ...cropRef.current }
        const b     = imgBoundsRef.current

        function computeNewCrop(dx: number, dy: number): Crop {
            switch (type) {
                case "move":
                    return clampCrop(start.x + dx, start.y + dy, start.w, b)
                case "se": {
                    const delta = dx * DX_F + dy * DY_F
                    return clampCrop(start.x, start.y, Math.max(MIN_W, start.w + delta), b)
                }
                case "nw": {
                    const delta = -(dx * DX_F + dy * DY_F)
                    const newW  = Math.max(MIN_W, start.w + delta)
                    const seX   = start.x + start.w
                    const seY   = start.y + start.w / RATIO
                    const cw    = Math.max(MIN_W, Math.min(newW, seX - b.x, (seY - b.y) * RATIO))
                    return { x: seX - cw, y: seY - cw / RATIO, w: cw }
                }
                case "ne": {
                    const delta = dx * DX_F + (-dy) * DY_F
                    const newW  = Math.max(MIN_W, start.w + delta)
                    const swY   = start.y + start.w / RATIO
                    const cw    = Math.max(MIN_W, Math.min(newW, b.x + b.w - start.x, (swY - b.y) * RATIO))
                    return { x: start.x, y: swY - cw / RATIO, w: cw }
                }
                case "sw": {
                    const delta = (-dx) * DX_F + dy * DY_F
                    const newW  = Math.max(MIN_W, start.w + delta)
                    const neX   = start.x + start.w
                    const cw    = Math.max(MIN_W, Math.min(newW, neX - b.x, (b.y + b.h - start.y) * RATIO))
                    return { x: neX - cw, y: start.y, w: cw }
                }
            }
        }

        function applyToDom(c: Crop) {
            const el = cropBoxRef.current
            if (!el) return
            el.style.left   = `${c.x}px`
            el.style.top    = `${c.y}px`
            el.style.width  = `${c.w}px`
            el.style.height = `${c.w / RATIO}px`
        }

        function onMove(cx: number, cy: number) {
            const nc    = computeNewCrop(cx - startX, cy - startY)
            cropRef.current = nc
            applyToDom(nc)
        }
        function onEnd() { setCrop({ ...cropRef.current }) }

        const onMouseMove = (e: MouseEvent) => { e.preventDefault(); onMove(e.clientX, e.clientY) }
        const onMouseUp   = () => {
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup",   onMouseUp)
            onEnd()
        }
        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup",   onMouseUp)

        const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY) }
        const onTouchEnd  = () => {
            document.removeEventListener("touchmove", onTouchMove)
            document.removeEventListener("touchend",  onTouchEnd)
            onEnd()
        }
        document.addEventListener("touchmove", onTouchMove, { passive: false })
        document.addEventListener("touchend",  onTouchEnd)
    }

    function dragHandlers(type: DragType) {
        return {
            onMouseDown: (e: React.MouseEvent) => {
                e.preventDefault(); e.stopPropagation()
                startDrag(type, e.clientX, e.clientY)
            },
            onTouchStart: (e: React.TouchEvent) => {
                e.stopPropagation()
                startDrag(type, e.touches[0].clientX, e.touches[0].clientY)
            },
        }
    }

    // ── Process file → compute layout → show crop modal ──
    const processFile = useCallback((file: File) => {
        if (!ALLOWED_TYPES.includes(file.type)) { setError("Only JPG, PNG, or WebP files are allowed"); return }
        if (file.size > MAX_FILE_SIZE)          { setError("File must be smaller than 20 MB"); return }
        setError(null)

        const reader = new FileReader()
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            setRawDataUrl(dataUrl)

            const img = new window.Image()
            img.onload = () => {
                const aspect = img.naturalWidth / img.naturalHeight
                let bW: number, bH: number, bX: number, bY: number

                if (aspect >= CONT_W / CONT_H) {
                    bW = CONT_W; bH = CONT_W / aspect; bX = 0; bY = (CONT_H - bH) / 2
                } else {
                    bH = CONT_H; bW = CONT_H * aspect; bX = (CONT_W - bW) / 2; bY = 0
                }

                const initW   = Math.min(bW, bH * RATIO)
                const bounds  = { x: bX, y: bY, w: bW, h: bH }
                const initCrop = {
                    x: bX + (bW - initW) / 2,
                    y: bY + (bH - initW / RATIO) / 2,
                    w: initW,
                }

                imgBoundsRef.current = bounds
                cropRef.current      = initCrop
                setImgBounds(bounds)
                setCrop(initCrop)
            }
            img.src = dataUrl
        }
        reader.readAsDataURL(file)
    }, [])

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (fileInputRef.current) fileInputRef.current.value = ""
        if (file) processFile(file)
    }, [processFile])

    // ── Apply crop → upload to InsForge ──
    async function handleApplyCrop() {
        if (!rawDataUrl) return
        setIsUploading(true)
        setError(null)

        try {
            const img = new window.Image()
            await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = rawDataUrl })

            const ib     = imgBoundsRef.current
            const c      = cropRef.current
            const scaleX = img.naturalWidth  / ib.w
            const scaleY = img.naturalHeight / ib.h
            const natX   = (c.x - ib.x) * scaleX
            const natY   = (c.y - ib.y) * scaleY
            const natW   = c.w           * scaleX
            const natH   = (c.w / RATIO) * scaleY

            const canvas = document.createElement("canvas")
            canvas.width = OUT_W; canvas.height = OUT_H
            canvas.getContext("2d")!.drawImage(img, natX, natY, natW, natH, 0, 0, OUT_W, OUT_H)

            const blob = await new Promise<Blob>((res, rej) =>
                canvas.toBlob(b => b ? res(b) : rej(new Error("Canvas conversion failed")), "image/jpeg", 0.92)
            )

            const insforge = createClient()
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
            const { error: uploadError } = await insforge.storage
                .from(bucket)
                .upload(fileName, blob)

            if (uploadError) throw uploadError

            const { data: urlData } = insforge.storage.from(bucket).getPublicUrl(fileName)
            if (!urlData?.publicUrl) throw new Error("Missing public URL")
            onChange(urlData.publicUrl)
            setRawDataUrl(null)
        } catch (err) {
            console.error("[ImageUploader] Crop upload failed:", err)
            setError("Upload failed. Please try again.")
        } finally {
            setIsUploading(false)
        }
    }

    // ── Remove current image ──
    // Only clears the field; the file stays in storage. The same URL can belong
    // to the published dish, its drafts and their duplicates at once, and the
    // form can still be cancelled.
    const handleRemove = useCallback(() => {
        onChange(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }, [onChange])

    // ── Drag & drop zone ──
    const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])
    const handleDrop      = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    // ── Crop modal ──
    const cropModal = rawDataUrl ? (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !isUploading) setRawDataUrl(null) }}
        >
            <div className="bg-wg-surface dark:bg-wg-dark-surface rounded-card shadow-elevated border border-wg-border dark:border-wg-dark-border overflow-hidden animate-fade-up">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-wg-border dark:border-wg-dark-border">
                    <div>
                        <h3 className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">Crop Image</h3>
                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">4:3 aspect ratio · drag to move · corners to resize</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { if (!isUploading) setRawDataUrl(null) }}
                        disabled={isUploading}
                        className="text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors disabled:opacity-40 ml-4"
                    >
                        <CloseIcon className="w-5 h-5" strokeWidth={2} />
                    </button>
                </div>

                {/* Crop canvas */}
                <div
                    className="relative bg-black select-none overflow-hidden"
                    style={{ width: CONT_W, height: CONT_H }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={rawDataUrl}
                        alt="Crop preview"
                        draggable={false}
                        style={{
                            position: "absolute",
                            left: imgBounds.x, top: imgBounds.y,
                            width: imgBounds.w, height: imgBounds.h,
                            pointerEvents: "none", userSelect: "none",
                        }}
                    />
                    {/* Crop box */}
                    <div
                        ref={cropBoxRef}
                        {...dragHandlers("move")}
                        style={{
                            position: "absolute",
                            left: crop.x, top: crop.y,
                            width: crop.w, height: crop.w / RATIO,
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                            cursor: "move",
                            border: "1.5px solid rgba(255,255,255,0.9)",
                            boxSizing: "border-box",
                        }}
                    >
                        {/* Rule-of-thirds grid */}
                        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                            {[33.33, 66.66].map(p => (
                                <div key={`v${p}`} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                            ))}
                            {[33.33, 66.66].map(p => (
                                <div key={`h${p}`} style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.2)" }} />
                            ))}
                        </div>
                        {/* Corner handles */}
                        {(["nw", "ne", "sw", "se"] as const).map(corner => (
                            <div
                                key={corner}
                                {...dragHandlers(corner)}
                                style={{
                                    position: "absolute",
                                    width: 14, height: 14,
                                    background: "white",
                                    borderRadius: 3,
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                                    ...CORNER_POS[corner],
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-5 py-4 border-t border-wg-border dark:border-wg-dark-border bg-wg-bg/50 dark:bg-wg-dark-bg/30">
                    <button
                        type="button"
                        onClick={() => { if (!isUploading) setRawDataUrl(null) }}
                        disabled={isUploading}
                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApplyCrop}
                        disabled={isUploading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors disabled:opacity-50"
                    >
                        {isUploading ? (
                            <>
                                <Spinner className="animate-spin w-4 h-4" />
                                Uploading…
                            </>
                        ) : (
                            <>
                                <CheckCompactIcon className="w-4 h-4" strokeWidth={2} />
                                Apply & Upload
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <p className="px-5 pb-4 text-xs text-red-500 dark:text-red-400">{error}</p>
                )}
            </div>
        </div>
    ) : null

    // ── Render ──
    return (
        <>
            {/* Hidden file input — always present */}
            <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload image"
            />

            {/* Crop modal portal */}
            {mounted && createPortal(cropModal, document.body)}

            {value ? (
                /* ── Preview mode ── */
                <div className="space-y-2">
                    <div className={`relative ${aspectRatio} rounded-brand overflow-hidden border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg`}>
                        <FadeInImage
                            src={value}
                            alt="Menu item image"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 400px"
                        />
                        {/* Action buttons overlay */}
                        <div className="absolute top-2 right-2 flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 rounded-full bg-black/50 hover:bg-wg-primary/80 text-white transition-colors"
                                title="Replace image"
                                aria-label="Replace image"
                            >
                                <ArrowPathIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="p-1.5 rounded-full bg-black/50 hover:bg-red-600/80 text-white transition-colors"
                                title="Remove image"
                                aria-label="Remove image"
                            >
                                <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                    <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted text-center">
                        ↺ Replace · ✕ Remove
                    </p>
                </div>
            ) : (
                /* ── Upload zone ── */
                <div className="space-y-2">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            ${aspectRatio} rounded-brand border-2 border-dashed cursor-pointer
                            flex flex-col items-center justify-center gap-2
                            transition-colors duration-150
                            ${isDragging
                                ? "border-wg-accent bg-wg-accent/5 dark:border-wg-dark-accent dark:bg-wg-dark-accent/5"
                                : "border-wg-border dark:border-wg-dark-border hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 bg-wg-bg/50 dark:bg-wg-dark-bg/50"
                            }
                        `}
                    >
                        <PhotoSunIcon className="w-8 h-8 text-wg-muted/40 dark:text-wg-dark-muted/40" strokeWidth={1} />
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-center px-3">
                            <span className="font-semibold text-wg-accent dark:text-wg-dark-accent">Click to upload</span>
                            {" "}or drag and drop
                        </p>
                        <p className="text-[11px] text-wg-muted/50 dark:text-wg-dark-muted/50">
                            JPG, PNG or WebP · Max 20 MB · 4:3
                        </p>
                    </div>
                    {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
                </div>
            )}
        </>
    )
}
