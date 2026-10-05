"use client"

// ══════════════════════════════════════════════════════════════════
// AdminDatePicker — Custom date / datetime / time picker for admin
// Replaces native <input type="date|datetime-local|time"> with a
// fully branded, keyboard-aware calendar and time spinner.
//
// Props:
//   mode="date"       → calendar only, closes on day click
//   mode="datetime"   → calendar + time spinner + Done button
//   mode="time"       → time spinner only (no calendar)
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import {
    CalendarBandIcon,
    ChevronDownMidIcon,
    ChevronLeftMidIcon,
    ChevronRightMidIcon,
    ChevronUpMidIcon,
    ClockRightAngleIcon,
    CloseIcon,
} from "@wildgrove/ui/icons"

// ── Types ──────────────────────────────────────────────────────────

export interface AdminDatePickerProps {
    value: string           // "YYYY-MM-DD" | "YYYY-MM-DDTHH:mm" | "HH:mm"
    onChange: (value: string) => void
    placeholder?: string
    mode?: "date" | "datetime" | "time"
    /** Show the × clear button when there's a value (default: true) */
    nullable?: boolean
    disabled?: boolean
    /** Align dropdown to the right edge of the trigger instead of left */
    alignRight?: boolean
    className?: string
}

// ── Constants ──────────────────────────────────────────────────────

const DAY_ABBRS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

// ── Helpers ────────────────────────────────────────────────────────

interface Parts { year: number; month: number; day: number; hour: number; minute: number }

function parseParts(value: string, mode: "date" | "datetime" | "time"): Parts | null {
    if (!value) return null
    if (mode === "time") {
        const [h, m] = value.split(":").map(Number)
        if (isNaN(h) || isNaN(m)) return null
        return { year: 0, month: 0, day: 0, hour: h, minute: m }
    }
    const [datePart, timePart] = value.split("T")
    const [y, mo, d] = datePart.split("-").map(Number)
    const [h, m] = (timePart ?? "00:00").split(":").map(Number)
    if (!y || !mo || !d) return null
    return { year: y, month: mo - 1, day: d, hour: h || 0, minute: m || 0 }
}

function buildValue(p: Parts, mode: "date" | "datetime" | "time"): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    if (mode === "time") return `${pad(p.hour)}:${pad(p.minute)}`
    const date = `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`
    if (mode === "date") return date
    return `${date}T${pad(p.hour)}:${pad(p.minute)}`
}

function formatDisplay(value: string, mode: "date" | "datetime" | "time"): string {
    const p = parseParts(value, mode)
    if (!p) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    const timeStr = `${pad(p.hour)}:${pad(p.minute)}`
    if (mode === "time") return timeStr
    const dateStr = `${MONTH_NAMES[p.month].slice(0, 3)} ${p.day}, ${p.year}`
    if (mode === "date") return dateStr
    return `${dateStr}  ·  ${timeStr}`
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay()
}

// ── Shared trigger BASE (mirrors AdminSelect) ──────────────────────

const TRIGGER_BASE =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border " +
    "bg-wg-bg dark:bg-wg-dark-bg transition-all"

// ── Sub-component: time spinner ────────────────────────────────────

function TimeSpinner({
    hour, minute,
    onHourChange, onMinuteChange,
}: {
    hour: number; minute: number
    onHourChange: (h: number) => void
    onMinuteChange: (m: number) => void
}) {
    const spinBtn = "w-7 h-7 flex items-center justify-center rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-bg dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-bg transition-colors"
    const spinVal = "w-9 text-center text-sm font-mono font-semibold text-wg-text dark:text-wg-dark-text tabular-nums select-none"
    const spinArrow = (dir: "up" | "down") => (
        dir === "up"
            ? <ChevronUpMidIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
            : <ChevronDownMidIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
    )

    // Snap to nearest 5-min interval then step
    const snapMinute = Math.round(minute / 5) * 5 % 60

    return (
        <div className="flex items-center justify-center gap-2.5">
            {/* Clock icon */}
            <ClockRightAngleIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted shrink-0" />

            {/* Hour */}
            <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => onHourChange((hour + 1) % 24)} className={spinBtn}>
                    {spinArrow("up")}
                </button>
                <span className={spinVal}>{String(hour).padStart(2, "0")}</span>
                <button type="button" onClick={() => onHourChange((hour - 1 + 24) % 24)} className={spinBtn}>
                    {spinArrow("down")}
                </button>
            </div>

            <span className="text-lg font-bold text-wg-muted/70 dark:text-wg-dark-muted/70 select-none mb-0.5">:</span>

            {/* Minute */}
            <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => onMinuteChange((snapMinute + 5) % 60)} className={spinBtn}>
                    {spinArrow("up")}
                </button>
                <span className={spinVal}>{String(minute).padStart(2, "0")}</span>
                <button type="button" onClick={() => onMinuteChange((snapMinute - 5 + 60) % 60)} className={spinBtn}>
                    {spinArrow("down")}
                </button>
            </div>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────

export function AdminDatePicker({
    value,
    onChange,
    placeholder,
    mode = "date",
    nullable = true,
    disabled = false,
    alignRight = false,
    className = "",
}: AdminDatePickerProps) {
    const today = new Date()
    const parsed = parseParts(value, mode)

    const defaultPlaceholder =
        mode === "date" ? "Select date…"
        : mode === "datetime" ? "Select date & time…"
        : "Select time…"

    const [open, setOpen] = useState(false)
    const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear())
    const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth())
    const [hour, setHour] = useState(parsed?.hour ?? 0)
    const [minute, setMinute] = useState(parsed?.minute ?? 0)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    // Sync internal view when value changes from outside (derived-state-from-props pattern)
    const [prevSyncValue, setPrevSyncValue] = useState(value)
    if (prevSyncValue !== value) {
        setPrevSyncValue(value)
        const p = parseParts(value, mode)
        if (p) {
            if (mode !== "time") { setViewYear(p.year); setViewMonth(p.month) }
            setHour(p.hour)
            setMinute(p.minute)
        }
    }

    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return
        function updatePosition() {
            if (!triggerRef.current) return
            const rect = triggerRef.current.getBoundingClientRect()
            const dropdownW = mode === "time" ? 192 : 280
            const spaceBelow = window.innerHeight - rect.bottom - 16
            const spaceAbove = rect.top - 16
            const IDEAL_HEIGHT = mode === "date" ? 320 : 420

            const left = alignRight
                ? Math.max(8, rect.right - dropdownW)
                : rect.left

            if (spaceBelow >= IDEAL_HEIGHT || spaceBelow >= spaceAbove) {
                setDropdownStyle({
                    position: "fixed",
                    top: rect.bottom + 6,
                    left,
                    width: dropdownW,
                    maxHeight: Math.max(spaceBelow, 200),
                    overflowY: "auto",
                    zIndex: 9999,
                })
            } else {
                setDropdownStyle({
                    position: "fixed",
                    bottom: window.innerHeight - rect.top + 6,
                    left,
                    width: dropdownW,
                    maxHeight: Math.max(spaceAbove, 200),
                    overflowY: "auto",
                    zIndex: 9999,
                })
            }
        }
        updatePosition()
        window.addEventListener("scroll", updatePosition, true)
        window.addEventListener("resize", updatePosition)
        return () => {
            window.removeEventListener("scroll", updatePosition, true)
            window.removeEventListener("resize", updatePosition)
        }
    }, [open, mode, alignRight])

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const onOut = (e: MouseEvent) => {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest("[data-admin-datepicker-portal]")
            ) setOpen(false)
        }
        document.addEventListener("mousedown", onOut)
        return () => document.removeEventListener("mousedown", onOut)
    }, [open])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [open])

    // ── Handlers ──

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }

    const handleDayClick = (day: number) => {
        onChange(buildValue({ year: viewYear, month: viewMonth, day, hour, minute }, mode))
        if (mode === "date") setOpen(false)
    }

    const handleHourChange = (newHour: number) => {
        setHour(newHour)
        const p = parseParts(value, mode)
        if (mode === "time") {
            onChange(buildValue({ year: 0, month: 0, day: 0, hour: newHour, minute }, mode))
        } else if (p) {
            onChange(buildValue({ ...p, hour: newHour, minute }, mode))
        }
    }

    const handleMinuteChange = (newMinute: number) => {
        setMinute(newMinute)
        const p = parseParts(value, mode)
        if (mode === "time") {
            onChange(buildValue({ year: 0, month: 0, day: 0, hour, minute: newMinute }, mode))
        } else if (p) {
            onChange(buildValue({ ...p, hour, minute: newMinute }, mode))
        }
    }

    const handleClear = () => { onChange(""); setOpen(false) }

    // ── Calendar grid ──

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    const cells = Array.from({ length: totalCells }, (_, i) => {
        const day = i - firstDay + 1
        return day >= 1 && day <= daysInMonth ? day : null
    })

    const isToday = (day: number) =>
        day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

    const isSelected = (day: number) => {
        const p = parseParts(value, mode)
        return p ? p.day === day && p.month === viewMonth && p.year === viewYear : false
    }

    const displayText = formatDisplay(value, mode)

    // ── Render ──

    return (
        <div ref={containerRef} className={`relative ${className}`}>

            {/* ── Trigger button ── */}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={`${TRIGGER_BASE} flex items-center gap-2 text-left ${
                    open
                        ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
                        : "border-wg-border/50 dark:border-wg-dark-border hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
                {/* Icon */}
                {mode === "time" ? (
                    <ClockRightAngleIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                ) : (
                    <CalendarBandIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                )}

                {/* Label */}
                <span className={`flex-1 truncate ${displayText ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/50 dark:text-wg-dark-muted/50"}`}>
                    {displayText || (placeholder ?? defaultPlaceholder)}
                </span>

                {/* Clear × */}
                {nullable && value && (
                    <span
                        role="button"
                        aria-label="Clear"
                        onClick={(e) => { e.stopPropagation(); handleClear() }}
                        className="shrink-0 text-wg-muted/50 hover:text-wg-muted dark:text-wg-dark-muted/50 dark:hover:text-wg-dark-muted transition-colors"
                    >
                        <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                    </span>
                )}

                {/* Chevron */}
                <ChevronDownMidIcon className={`w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>

            {/* ── Dropdown panel ── */}
            {open && createPortal(
                <div
                    data-admin-datepicker-portal
                    style={dropdownStyle}
                    className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface shadow-elevated overflow-hidden"
                >

                    {/* ── Calendar (date + datetime modes) ── */}
                    {mode !== "time" && (
                        <>
                            {/* Month / Year header */}
                            <div className="flex items-center justify-between px-3 py-2.5 border-b border-wg-border/30 dark:border-wg-dark-border/50">
                                <button
                                    type="button"
                                    onClick={prevMonth}
                                    className="p-1.5 rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-bg dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-bg transition-colors"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeftMidIcon className="w-4 h-4" strokeWidth={2} />
                                </button>

                                <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text select-none">
                                    {MONTH_NAMES[viewMonth]} {viewYear}
                                </span>

                                <button
                                    type="button"
                                    onClick={nextMonth}
                                    className="p-1.5 rounded-brand text-wg-muted hover:text-wg-text hover:bg-wg-bg dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-bg transition-colors"
                                    aria-label="Next month"
                                >
                                    <ChevronRightMidIcon className="w-4 h-4" strokeWidth={2} />
                                </button>
                            </div>

                            {/* Weekday abbreviations */}
                            <div className="grid grid-cols-7 px-3 pt-2.5 pb-1">
                                {DAY_ABBRS.map(d => (
                                    <div key={d} className="text-center text-[11px] font-semibold text-wg-muted/60 dark:text-wg-dark-muted/60 pb-1 select-none">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Day grid */}
                            <div className="grid grid-cols-7 px-3 pb-2">
                                {cells.map((day, i) =>
                                    day === null ? (
                                        <div key={i} className="h-8" />
                                    ) : (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleDayClick(day)}
                                            className={`h-8 w-8 mx-auto flex items-center justify-center rounded-brand text-sm font-medium transition-colors ${
                                                isSelected(day)
                                                    ? "bg-wg-primary dark:bg-wg-dark-primary text-white font-semibold shadow-sm"
                                                    : isToday(day)
                                                    ? "text-wg-accent dark:text-wg-dark-accent ring-1 ring-inset ring-wg-accent/60 dark:ring-wg-dark-accent/60 font-semibold hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10"
                                                    : "text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    )
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Time spinner (datetime + time modes) ── */}
                    {mode !== "date" && (
                        <div className={`px-4 py-4 ${mode === "datetime" ? "border-t border-wg-border/30 dark:border-wg-dark-border/50" : "pt-5"}`}>
                            <TimeSpinner
                                hour={hour}
                                minute={minute}
                                onHourChange={handleHourChange}
                                onMinuteChange={handleMinuteChange}
                            />
                        </div>
                    )}

                    {/* ── Footer: Done / Clear ── */}
                    <div className={`flex items-center px-3 py-2.5 border-t border-wg-border/30 dark:border-wg-dark-border/50 ${nullable && value ? "justify-between" : "justify-end"}`}>
                        {nullable && value && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs text-wg-muted hover:text-red-500 dark:text-wg-dark-muted dark:hover:text-red-400 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-3 py-1.5 text-xs font-medium rounded-brand bg-wg-primary/10 hover:bg-wg-primary/20 dark:bg-wg-dark-primary/15 dark:hover:bg-wg-dark-primary/25 text-wg-primary dark:text-wg-dark-primary transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
