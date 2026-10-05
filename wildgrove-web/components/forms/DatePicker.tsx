"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { useLocale } from "next-intl"
import { limaCalendarTodayIso } from "@wildgrove/core/reservation-dates-lima"
import { getWeekdayFromDate } from "@wildgrove/core/reservation-schedule"
import { CalendarBandIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@wildgrove/ui/icons"

interface DatePickerProps {
    value: string // "YYYY-MM-DD"
    min?: string  // "YYYY-MM-DD"
    max?: string  // "YYYY-MM-DD" (inclusive last selectable day)
    enabledWeekdays?: number[] // 1=Mon ... 7=Sun
    /** When set, calendar days that return false are disabled (e.g. no bookable time slots that day). */
    hasBookableSlot?: (dateIso: string) => boolean
    onChange: (date: string) => void
    required?: boolean
    /** Put on the trigger button, so a <label htmlFor> names it. */
    id?: string
    /** The label's id: the button is then read as the label plus its current value. */
    labelledBy?: string
}

function formatDisplayDate(dateStr: string, locale: string): string {
    if (!dateStr) return ""
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
}

export function DatePicker({ value, min, max, enabledWeekdays, hasBookableSlot, onChange, required, id, labelledBy }: DatePickerProps) {
    const t = useTranslations("datePicker")
    const locale = useLocale()
    const limaTodayIso = limaCalendarTodayIso()

    const MONTHS = Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2024, i, 1))
    )
    const DAYS = Array.from({ length: 7 }, (_, i) => {
        // Jan 7, 2024 is a Sunday
        const d = new Date(2024, 0, 7 + i)
        return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)
    })

    const [open, setOpen] = useState(false)
    const [viewYear, setViewYear] = useState(() => {
        if (value) return parseInt(value.split("-")[0])
        return new Date().getFullYear()
    })
    const [viewMonth, setViewMonth] = useState(() => {
        if (value) return parseInt(value.split("-")[1]) - 1
        return new Date().getMonth()
    })
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    useEffect(() => {
        if (!open) return
        function updatePosition() {
            if (!triggerRef.current) return
            const rect = triggerRef.current.getBoundingClientRect()
            setDropdownStyle({
                position: "fixed",
                top: rect.bottom + 8,
                left: rect.left,
                width: 288, // w-72
                zIndex: 9999,
            })
        }
        updatePosition()
        window.addEventListener("scroll", updatePosition, true)
        window.addEventListener("resize", updatePosition)
        return () => {
            window.removeEventListener("scroll", updatePosition, true)
            window.removeEventListener("resize", updatePosition)
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest("[data-datepicker-portal]")
            ) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    function cellDateIso(year: number, month: number, day: number): string {
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }

    function getDaysInMonth(year: number, month: number) {
        return new Date(year, month + 1, 0).getDate()
    }

    function getFirstDayOfMonth(year: number, month: number) {
        return new Date(year, month, 1).getDay()
    }

    function isDisabled(year: number, month: number, day: number) {
        const iso = cellDateIso(year, month, day)
        if (min && iso < min) return true
        if (max && iso > max) return true

        if (enabledWeekdays && enabledWeekdays.length > 0) {
            const weekday = getWeekdayFromDate(iso)
            if (weekday === null || !enabledWeekdays.includes(weekday)) return true
        }

        if (hasBookableSlot && !hasBookableSlot(iso)) return true

        return false
    }

    function isSelected(year: number, month: number, day: number) {
        if (!value) return false
        const [vy, vm, vd] = value.split("-").map(Number)
        return vy === year && vm - 1 === month && vd === day
    }

    function isToday(year: number, month: number, day: number) {
        return cellDateIso(year, month, day) === limaTodayIso
    }

    function selectDay(day: number) {
        const m = String(viewMonth + 1).padStart(2, "0")
        const d = String(day).padStart(2, "0")
        onChange(`${viewYear}-${m}-${d}`)
        setOpen(false)
    }

    function prevMonth() {
        if (viewMonth === 0) {
            setViewMonth(11)
            setViewYear(v => v - 1)
        } else {
            setViewMonth(v => v - 1)
        }
    }

    function nextMonth() {
        if (viewMonth === 11) {
            setViewMonth(0)
            setViewYear(v => v + 1)
        } else {
            setViewMonth(v => v + 1)
        }
    }

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    const triggerBase =
        "w-full px-4 py-3 rounded-brand border text-left flex items-center gap-3 transition bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text"
    const triggerClasses = `${triggerBase} ${
        open
            ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
            : "border-wg-border dark:border-wg-dark-border hover:border-wg-muted dark:hover:border-wg-dark-muted"
    }`

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                id={id}
                aria-labelledby={labelledBy && id ? `${labelledBy} ${id}` : undefined}
                type="button"
                onClick={() => setOpen(v => !v)}
                className={triggerClasses}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                {/* Calendar icon */}
                <CalendarBandIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted shrink-0" />
                <span className={`text-sm ${value ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/60 dark:text-wg-dark-muted/60"}`}>
                    {value ? formatDisplayDate(value, locale) : t("selectDate")}
                </span>
                {/* Chevron */}
                <ChevronDownIcon className={`w-4 h-4 ml-auto shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && createPortal(
                <div
                    data-datepicker-portal
                    role="dialog"
                    aria-label={t("dialogLabel")}
                    style={dropdownStyle}
                    className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated p-4"
                >
                    {/* Month / Year navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={prevMonth}
                            aria-label={t("previousMonth")}
                            className="w-8 h-8 flex items-center justify-center rounded-brand hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition text-wg-muted dark:text-wg-dark-muted"
                        >
                            <ChevronLeftIcon className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <span className="font-display text-sm font-semibold text-wg-text dark:text-wg-dark-text select-none">
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            aria-label={t("nextMonth")}
                            className="w-8 h-8 flex items-center justify-center rounded-brand hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition text-wg-muted dark:text-wg-dark-muted"
                        >
                            <ChevronRightIcon className="w-4 h-4" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS.map(d => (
                            <div key={d} className="text-center text-xs font-medium text-wg-muted dark:text-wg-dark-muted py-1 select-none">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar cells */}
                    <div className="grid grid-cols-7 gap-y-1">
                        {cells.map((day, idx) => {
                            if (day === null) return <div key={`e-${idx}`} />
                            const disabled = isDisabled(viewYear, viewMonth, day)
                            const selected = isSelected(viewYear, viewMonth, day)
                            const today = isToday(viewYear, viewMonth, day)

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => selectDay(day)}
                                    aria-label={`${MONTHS[viewMonth]} ${day}, ${viewYear}`}
                                    aria-pressed={selected}
                                    className={`
                                        relative w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-full transition select-none
                                        ${selected
                                            ? "bg-wg-accent text-white font-semibold"
                                            : disabled
                                                ? "text-wg-muted/30 dark:text-wg-dark-muted/30 cursor-not-allowed"
                                                : today
                                                    ? "text-wg-accent dark:text-wg-dark-accent font-semibold hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                                                    : "text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
                                        }
                                    `}
                                >
                                    {day}
                                    {today && !selected && (
                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-wg-accent dark:bg-wg-dark-accent" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}

            {/* Hidden native input so browser form validation works */}
            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ opacity: 0, position: "absolute", height: 0, width: 0, pointerEvents: "none" }}
                    value={value}
                    required
                    onChange={() => { }}
                />
            )}
        </div>
    )
}
