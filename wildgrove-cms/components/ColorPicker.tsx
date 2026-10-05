"use client"

import { useState, useRef, useCallback, useEffect } from "react"

// ── Color math ───────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = v - c
    let r = 0, g = 0, b = 0
    if (h < 60)       { r = c; g = x }
    else if (h < 120) { r = x; g = c }
    else if (h < 180) { g = c; b = x }
    else if (h < 240) { g = x; b = c }
    else if (h < 300) { r = x; b = c }
    else              { r = c; b = x }
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ]
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d   = max - min
    let h = 0
    if (d > 0) {
        if (max === r)      h = ((g - b) / d + 6) % 6 * 60
        else if (max === g) h = ((b - r) / d + 2) * 60
        else                h = ((r - g) / d + 4) * 60
    }
    return [Math.round(h), max === 0 ? 0 : d / max, max]
}

function hexToRgb(hex: string): [number, number, number] | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(n => n.toString(16).padStart(2, "0")).join("")
}

const HUE_GRADIENT =
    "linear-gradient(to right," +
    "hsl(0,100%,50%),hsl(30,100%,50%),hsl(60,100%,50%),hsl(90,100%,50%)," +
    "hsl(120,100%,50%),hsl(150,100%,50%),hsl(180,100%,50%),hsl(210,100%,50%)," +
    "hsl(240,100%,50%),hsl(270,100%,50%),hsl(300,100%,50%),hsl(330,100%,50%)," +
    "hsl(360,100%,50%))"

// ── Component ────────────────────────────────────────────────────

export interface ColorPickerProps {
    initialColor?: string
    onConfirm: (hex: string) => void
    onCancel: () => void
    confirmLabel?: string
    title?: string
}

export function ColorPicker({
    initialColor = "#10b981",
    onConfirm,
    onCancel,
    confirmLabel = "Apply",
    title = "Pick a color",
}: ColorPickerProps) {
    const initHsv = (): [number, number, number] => {
        const rgb = hexToRgb(initialColor)
        return rgb ? rgbToHsv(...rgb) : [160, 0.75, 0.73]
    }

    const [[h, s, v], setHsv] = useState<[number, number, number]>(initHsv)
    const [hexInput, setHexInput] = useState(() => {
        const c = initialColor.startsWith("#") ? initialColor : "#" + initialColor
        return c.toLowerCase()
    })
    const sbRef = useRef<HTMLDivElement>(null)
    const dragging = useRef(false)

    const currentRgb = hsvToRgb(h, s, v)
    const currentHex = rgbToHex(...currentRgb)

    useEffect(() => { setHexInput(currentHex) }, [currentHex])

    const updateSV = useCallback((clientX: number, clientY: number) => {
        const el = sbRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const ns = Math.max(0, Math.min(1, (clientX - rect.left)  / rect.width))
        const nv = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
        setHsv(([hh]) => [hh, ns, nv])
    }, [])

    useEffect(() => {
        const onMove = (e: MouseEvent) => { if (dragging.current) updateSV(e.clientX, e.clientY) }
        const onUp   = () => { dragging.current = false }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup",   onUp)
        return () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup",   onUp)
        }
    }, [updateSV])

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value
        setHexInput(raw)
        const norm = raw.startsWith("#") ? raw : "#" + raw
        const rgb = hexToRgb(norm)
        if (rgb) setHsv(rgbToHsv(...rgb))
    }

    const glowStyle = { boxShadow: `0 4px 18px ${currentHex}55` }

    return (
        <div className="w-full select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-wg-border/40 dark:border-wg-dark-border/40">
                <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">{title}</p>
                <div
                    className="w-6 h-6 rounded-full border-2 border-white/20 shrink-0"
                    style={{ background: currentHex, ...glowStyle }}
                />
            </div>

            <div className="p-4 space-y-4">
                {/* Saturation / Brightness square */}
                <div
                    ref={sbRef}
                    className="relative w-full rounded-xl cursor-crosshair overflow-hidden"
                    style={{
                        aspectRatio: "1 / 1",
                        background: `hsl(${h}, 100%, 50%)`,
                        touchAction: "none",
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault()
                        dragging.current = true
                        updateSV(e.clientX, e.clientY)
                    }}
                    onTouchStart={(e) => {
                        const t = e.touches[0]
                        updateSV(t.clientX, t.clientY)
                    }}
                    onTouchMove={(e) => {
                        e.preventDefault()
                        const t = e.touches[0]
                        updateSV(t.clientX, t.clientY)
                    }}
                >
                    {/* White → transparent (saturation axis) */}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff 0%, transparent 100%)" }} />
                    {/* Transparent → black (brightness axis) */}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, #000 100%)" }} />
                    {/* Cursor dot */}
                    <div
                        className="absolute w-5 h-5 rounded-full pointer-events-none"
                        style={{
                            left: `${s * 100}%`,
                            top:  `${(1 - v) * 100}%`,
                            transform: "translate(-50%, -50%)",
                            background: currentHex,
                            boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.5)",
                        }}
                    />
                </div>

                {/* Hue slider */}
                <div className="relative h-4 rounded-full overflow-hidden" style={{ background: HUE_GRADIENT }}>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={h}
                        onChange={(e) => setHsv([Number(e.target.value), s, v])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        style={{ touchAction: "none" }}
                    />
                    {/* Thumb */}
                    <div
                        className="absolute top-1/2 w-5 h-5 rounded-full pointer-events-none"
                        style={{
                            left: `${(h / 360) * 100}%`,
                            transform: "translate(-50%, -50%)",
                            background: `hsl(${h}, 100%, 50%)`,
                            boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px rgba(0,0,0,0.35)",
                        }}
                    />
                </div>

                {/* Preview + Hex input */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-xl shrink-0 border border-white/10"
                        style={{ background: currentHex, ...glowStyle }}
                    />
                    <div className="flex-1">
                        <p className="text-[10px] font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-widest mb-1.5">
                            Hex
                        </p>
                        <input
                            type="text"
                            value={hexInput}
                            onChange={handleHexChange}
                            maxLength={7}
                            spellCheck={false}
                            className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-wg-surface dark:bg-wg-dark-raised border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-current placeholder:text-wg-muted/50"
                            placeholder="#000000"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-surface dark:hover:bg-wg-dark-raised transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(currentHex)}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:opacity-90 active:scale-[0.97]"
                        style={{ background: currentHex, ...glowStyle }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
