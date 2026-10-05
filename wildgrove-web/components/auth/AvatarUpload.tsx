"use client"

import { useState, useRef, useEffect, useId } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { ArrowUpTrayIcon, CameraIcon, CloseIcon, GoogleLogo, Spinner, TrashIcon } from "@wildgrove/ui/icons"

// ── Constants ────────────────────────────────────────────────────────────────
const CONTAINER = 300   // crop canvas display size (px)
const MIN_CROP  = 60    // minimum crop size (px)
const OUTPUT    = 400   // exported image size (px)

// ── Types ────────────────────────────────────────────────────────────────────
type DragType = "move" | "nw" | "ne" | "sw" | "se"
interface Bounds { x: number; y: number; w: number; h: number }
interface Crop   { x: number; y: number; size: number }

const CORNER_STYLES: Record<string, React.CSSProperties> = {
    nw: { top: -6, left: -6, cursor: "nw-resize" },
    ne: { top: -6, right: -6, cursor: "ne-resize" },
    sw: { bottom: -6, left: -6, cursor: "sw-resize" },
    se: { bottom: -6, right: -6, cursor: "se-resize" },
}

// ── Props ────────────────────────────────────────────────────────────────────
interface AvatarUploadProps {
    initials: string
    avatarUrl: string | null
    firstName: string
    lastName: string
    googleAvatarUrl: string | null
}

// ── Component ────────────────────────────────────────────────────────────────
export function AvatarUpload({ initials, avatarUrl, firstName, lastName, googleAvatarUrl }: AvatarUploadProps) {
    const router     = useRouter()
    const t          = useTranslations("avatar")
    const inputRef   = useRef<HTMLInputElement>(null)
    const cropBoxRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const dialogRef  = useRef<HTMLDivElement>(null)
    const titleId    = useId()

    // SSR guard — createPortal requires document
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    // Display state
    const [displayUrl, setDisplayUrl] = useState<string | null>(avatarUrl)
    const [showModal, setShowModal]   = useState(false)
    const [mode, setMode]             = useState<"options" | "crop">("options")

    // Crop state
    const [rawDataUrl, setRawDataUrl] = useState<string | null>(null)
    const [imgBounds, setImgBounds]   = useState<Bounds>({ x: 0, y: 0, w: CONTAINER, h: CONTAINER })
    const [crop, setCrop]             = useState<Crop>({ x: 0, y: 0, size: CONTAINER })

    // Loading
    const [uploading, setUploading] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [deleting,  setDeleting]  = useState(false)
    const [error,     setError]     = useState<string | null>(null)

    // Refs to avoid stale closures in drag handlers
    const imgBoundsRef = useRef(imgBounds)
    const cropRef      = useRef(crop)
    useEffect(() => { imgBoundsRef.current = imgBounds }, [imgBounds])
    useEffect(() => { cropRef.current = crop }, [crop])

    // ── Modal helpers ─────────────────────────────────────────────────────────
    function openModal()  { setError(null); setMode("options"); setShowModal(true) }
    function closeModal() { setShowModal(false); setRawDataUrl(null) }

    // Keyboard and screen readers: focus moves into the dialog when it opens, Tab stays inside,
    // Escape closes it, and focus goes back to the button that opened it.
    useEffect(() => {
        if (!showModal) return
        const trigger = triggerRef.current
        dialogRef.current?.focus()
        return () => trigger?.focus()
    }, [showModal])

    // ── File selection ────────────────────────────────────────────────────────
    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (inputRef.current) inputRef.current.value = ""
        if (!file) return

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setError(t("errorFormat")); return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError(t("errorSize")); return
        }
        setError(null)

        const reader = new FileReader()
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            setRawDataUrl(dataUrl)

            const img = new Image()
            img.onload = () => {
                const aspect = img.naturalWidth / img.naturalHeight
                let bW: number, bH: number, bX: number, bY: number
                if (aspect >= 1) {
                    bW = CONTAINER; bH = CONTAINER / aspect; bX = 0; bY = (CONTAINER - bH) / 2
                } else {
                    bH = CONTAINER; bW = CONTAINER * aspect; bX = (CONTAINER - bW) / 2; bY = 0
                }
                const initSize = Math.min(bW, bH)
                const bounds: Bounds = { x: bX, y: bY, w: bW, h: bH }
                const initCrop: Crop = {
                    x: bX + (bW - initSize) / 2,
                    y: bY + (bH - initSize) / 2,
                    size: initSize,
                }
                imgBoundsRef.current = bounds
                cropRef.current      = initCrop
                setImgBounds(bounds)
                setCrop(initCrop)
                setMode("crop")
            }
            img.src = dataUrl
        }
        reader.readAsDataURL(file)
    }

    // ── Drag logic (direct DOM — zero React re-renders during drag) ───────────
    function clamp(x: number, y: number, size: number, b: Bounds): Crop {
        const s  = Math.max(MIN_CROP, Math.min(size, b.w, b.h))
        const cx = Math.max(b.x, Math.min(x, b.x + b.w - s))
        const cy = Math.max(b.y, Math.min(y, b.y + b.h - s))
        return { x: cx, y: cy, size: s }
    }

    function startDrag(type: DragType, startX: number, startY: number) {
        const startCrop = { ...cropRef.current }
        const b         = imgBoundsRef.current

        function computeNewCrop(dx: number, dy: number): Crop {
            switch (type) {
                case "move": return clamp(startCrop.x + dx, startCrop.y + dy, startCrop.size, b)
                case "se": {
                    const s = Math.max(MIN_CROP, startCrop.size + (dx + dy) / 2)
                    return { x: startCrop.x, y: startCrop.y,
                        size: Math.min(s, b.x + b.w - startCrop.x, b.y + b.h - startCrop.y) }
                }
                case "nw": {
                    const s   = Math.max(MIN_CROP, startCrop.size + (-dx - dy) / 2)
                    const seX = startCrop.x + startCrop.size
                    const seY = startCrop.y + startCrop.size
                    const fs  = Math.min(s, seX - b.x, seY - b.y)
                    return { x: seX - fs, y: seY - fs, size: fs }
                }
                case "ne": {
                    const s   = Math.max(MIN_CROP, startCrop.size + (dx - dy) / 2)
                    const swY = startCrop.y + startCrop.size
                    const fs  = Math.min(s, b.x + b.w - startCrop.x, swY - b.y)
                    return { x: startCrop.x, y: swY - fs, size: fs }
                }
                case "sw": {
                    const s   = Math.max(MIN_CROP, startCrop.size + (-dx + dy) / 2)
                    const neX = startCrop.x + startCrop.size
                    const fs  = Math.min(s, neX - b.x, b.y + b.h - startCrop.y)
                    return { x: neX - fs, y: startCrop.y, size: fs }
                }
            }
        }

        // Update DOM directly — no React re-render per frame
        function applyToDom(c: Crop) {
            const el = cropBoxRef.current
            if (!el) return
            el.style.left   = `${c.x}px`
            el.style.top    = `${c.y}px`
            el.style.width  = `${c.size}px`
            el.style.height = `${c.size}px`
        }

        function onMove(clientX: number, clientY: number) {
            const newCrop   = computeNewCrop(clientX - startX, clientY - startY)
            cropRef.current = newCrop
            applyToDom(newCrop)
        }

        // Sync React state once on drag end
        function onEnd() { setCrop({ ...cropRef.current }) }

        const onMouseMove = (ev: MouseEvent) => { ev.preventDefault(); onMove(ev.clientX, ev.clientY) }
        const onMouseUp   = () => {
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup",   onMouseUp)
            onEnd()
        }
        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup",   onMouseUp)

        const onTouchMove = (ev: TouchEvent) => {
            ev.preventDefault()
            onMove(ev.touches[0].clientX, ev.touches[0].clientY)
        }
        const onTouchEnd = () => {
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

    // ── Apply crop & upload ───────────────────────────────────────────────────
    async function handleApplyCrop() {
        if (!rawDataUrl) return
        setUploading(true); setError(null)
        try {
            const img = new Image()
            await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = rawDataUrl })

            const aspect = img.naturalWidth / img.naturalHeight
            const dispW  = aspect >= 1 ? CONTAINER : CONTAINER * aspect
            const scale  = img.naturalWidth / dispW

            const c    = cropRef.current
            const ib   = imgBoundsRef.current
            const natX = (c.x - ib.x) * scale
            const natY = (c.y - ib.y) * scale
            const natS = c.size * scale

            const canvas = document.createElement("canvas")
            canvas.width = OUTPUT; canvas.height = OUTPUT
            canvas.getContext("2d")!.drawImage(img, natX, natY, natS, natS, 0, 0, OUTPUT, OUTPUT)

            const blob = await new Promise<Blob>((res, rej) =>
                canvas.toBlob(b => b ? res(b) : rej(new Error("Conversion failed")), "image/jpeg", 0.92)
            )

            const fd = new FormData()
            fd.append("avatar", blob, "avatar.jpg")

            const r = await fetch("/api/account/avatar", { method: "POST", body: fd })
            const d = await r.json()
            if (!r.ok) throw new Error(d.error)

            setDisplayUrl(d.avatarUrl)
            closeModal()
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : t("uploadFailed"))
        } finally {
            setUploading(false)
        }
    }

    // ── Reset to Google ───────────────────────────────────────────────────────
    async function handleResetToGoogle() {
        setResetting(true); setError(null)
        try {
            const r = await fetch("/api/account/avatar", { method: "PATCH" })
            const d = await r.json()
            if (!r.ok) throw new Error(d.error)
            setDisplayUrl(d.avatarUrl)
            closeModal(); router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : t("failed"))
        } finally { setResetting(false) }
    }

    // ── Delete photo ──────────────────────────────────────────────────────────
    async function handleDelete() {
        setDeleting(true); setError(null)
        try {
            const r = await fetch("/api/account/avatar", { method: "DELETE" })
            if (!r.ok) throw new Error((await r.json()).error)
            setDisplayUrl(null)
            closeModal(); router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : t("failed"))
        } finally { setDeleting(false) }
    }

    const busy = uploading || resetting || deleting

    function handleDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Escape") {
            e.stopPropagation()
            if (!busy) closeModal()
            return
        }
        if (e.key !== "Tab") return
        const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? [],
        )
        if (focusable.length === 0) { e.preventDefault(); return }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }

    // ── Modal (portalled to document.body — escapes any parent stacking context)
    const modal = showModal ? (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !busy) closeModal() }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={handleDialogKeyDown}
                className="bg-wg-surface dark:bg-wg-dark-surface rounded-card shadow-elevated border border-wg-border dark:border-wg-dark-border w-full max-w-sm overflow-hidden animate-fade-up focus:outline-none"
            >

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border dark:border-wg-dark-border">
                    <h3 id={titleId} className="text-base font-semibold text-wg-text dark:text-wg-dark-text">
                        {mode === "options" ? t("profilePhoto") : t("cropPhoto")}
                    </h3>
                    <button
                        onClick={() => { if (!busy) closeModal() }}
                        disabled={busy}
                        aria-label={t("close")}
                        className="text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors disabled:opacity-40"
                    >
                        <CloseIcon className="w-5 h-5" strokeWidth={2} />
                    </button>
                </div>

                {/* ── Options mode ── */}
                {mode === "options" && (
                    <div className="p-5 space-y-4">
                        <div className="flex justify-center">
                            <div
                                className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white shadow-elevated"
                                style={!displayUrl ? { background: "linear-gradient(135deg, #3A5A40, #C17F3A)" } : undefined}
                            >
                                {displayUrl
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={displayUrl} alt={t("currentPhoto")} className="w-full h-full object-cover" />
                                    : initials}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {/* Upload photo */}
                            <button
                                type="button"
                                onClick={() => { setError(null); inputRef.current?.click() }}
                                disabled={busy}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text text-sm font-medium hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-all disabled:opacity-50"
                            >
                                <ArrowUpTrayIcon
                                    className="w-5 h-5 text-wg-muted dark:text-wg-dark-muted flex-shrink-0"
                                    strokeWidth={1.75}
                                />
                                {t("uploadPhoto")}
                            </button>

                            {/* Use Google Photo */}
                            {googleAvatarUrl && (
                                <button
                                    type="button"
                                    onClick={handleResetToGoogle}
                                    disabled={busy}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text text-sm font-medium hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-all disabled:opacity-50"
                                >
                                    {resetting ? (
                                        <Spinner className="animate-spin w-5 h-5 text-wg-muted flex-shrink-0" />
                                    ) : (
                                        <GoogleLogo width="20" height="20" className="flex-shrink-0" />
                                    )}
                                    {resetting ? t("restoring") : t("useGooglePhoto")}
                                </button>
                            )}

                            {/* Delete photo */}
                            {displayUrl && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={busy}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-brand border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/15 transition-all disabled:opacity-50"
                                >
                                    {deleting ? (
                                        <Spinner className="animate-spin w-5 h-5 flex-shrink-0" />
                                    ) : (
                                        <TrashIcon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                                    )}
                                    {deleting ? t("removing") : t("deletePhoto")}
                                </button>
                            )}
                        </div>

                        {error && (
                            <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>
                        )}
                    </div>
                )}

                {/* ── Crop mode ── */}
                {mode === "crop" && rawDataUrl && (
                    <>
                        <div
                            className="relative bg-black select-none overflow-hidden mx-auto"
                            style={{ width: CONTAINER, height: CONTAINER }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={rawDataUrl}
                                alt={t("cropPreview")}
                                draggable={false}
                                style={{
                                    position: "absolute",
                                    left: imgBounds.x,
                                    top:  imgBounds.y,
                                    width: imgBounds.w,
                                    height: imgBounds.h,
                                    pointerEvents: "none",
                                    userSelect: "none",
                                }}
                            />

                            {/* Crop box */}
                            <div
                                ref={cropBoxRef}
                                {...dragHandlers("move")}
                                style={{
                                    position: "absolute",
                                    left: crop.x,
                                    top:  crop.y,
                                    width: crop.size,
                                    height: crop.size,
                                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                                    cursor: "move",
                                    border: "1.5px solid rgba(255,255,255,0.85)",
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
                                            width: 14,
                                            height: 14,
                                            background: "white",
                                            borderRadius: 3,
                                            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                                            ...CORNER_STYLES[corner],
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="px-5 py-4 flex items-center gap-3 border-t border-wg-border dark:border-wg-dark-border">
                            <button
                                type="button"
                                onClick={() => { setMode("options"); setRawDataUrl(null) }}
                                disabled={uploading}
                                className="px-4 py-2.5 text-sm font-medium border border-wg-border dark:border-wg-dark-border rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors disabled:opacity-50"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyCrop}
                                disabled={uploading}
                                className="flex-1 py-2.5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {uploading ? (
                                    <>
                                        <Spinner className="animate-spin w-4 h-4" />
                                        {t("uploading")}
                                    </>
                                ) : t("applyUpload")}
                            </button>
                        </div>

                        {error && (
                            <p className="px-5 pb-4 text-xs text-red-500 dark:text-red-400">{error}</p>
                        )}
                    </>
                )}
            </div>
        </div>
    ) : null

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={openModal}
                className="relative group focus:outline-none"
                aria-label={t("managePhoto")}
            >
                <div
                    className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white shadow-elevated ring-4 ring-wg-surface dark:ring-wg-dark-surface"
                    style={!displayUrl ? { background: "linear-gradient(135deg, #3A5A40, #C17F3A)" } : undefined}
                >
                    {displayUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={displayUrl} alt={`${firstName} ${lastName}`} className="w-full h-full object-cover" />
                        : initials}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <CameraIcon className="w-5 h-5 text-white" strokeWidth={1.75} />
                </div>
            </button>

            {/* Portal — renders at document.body, escapes overflow/stacking contexts */}
            {mounted && createPortal(modal, document.body)}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
            />
        </>
    )
}
