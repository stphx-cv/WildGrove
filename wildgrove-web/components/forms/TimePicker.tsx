"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import type { ClosedTimeRange } from "@wildgrove/core/reservation-schedule"
import { generateTimeSlots, isOpenDay, isSlotPastBookingCutoff } from "@wildgrove/core/reservation-schedule"
import { formatWallClockSlotLabel, normalizeTimeFormatPreference } from "@wildgrove/core/app-datetime-format"
import { ChevronDownIcon, ClockRightAngleIcon } from "@wildgrove/ui/icons"

interface TimePickerProps {
    value: string
    onChange: (time: string) => void
    required?: boolean
    /** Put on the trigger button, so a <label htmlFor> names it. */
    id?: string
    /** The label's id: the button is then read as the label plus its current value. */
    labelledBy?: string
    selectedDate?: string // "YYYY-MM-DD"
    advanceNoticeMs?: number // default: 2h
    openingTime?: string
    closingTime?: string
    timeSlotIncrement?: number
    enabledWeekdays?: number[] // 1=Mon ... 7=Sun
    closedTimeRanges?: ClosedTimeRange[]
    /** CMS General → Time format. Slot `value` stays HH:mm (24h) for APIs. */
    displayTimeFormat?: "12h" | "24h"
}

function isSlotDisabled(slot: string, selectedDate?: string, advanceNoticeMs = 2 * 60 * 60 * 1000): boolean {
    if (!selectedDate) return false
    return isSlotPastBookingCutoff(selectedDate, slot, advanceNoticeMs)
}

/** Two-line 12h label so "PM" does not wrap awkwardly inside narrow cells */
export function TimePicker12hSlotLabel({ label }: { label: string }) {
    const m = label.match(/^(.+?)\s+(AM|PM)$/i)
    if (!m) return <span className="tabular-nums">{label}</span>
    return (
        <span className="flex flex-col items-center justify-center gap-0.5 tabular-nums">
            <span className="leading-none">{m[1]}</span>
            <span className="text-[10px] font-semibold uppercase leading-none opacity-90">{m[2]}</span>
        </span>
    )
}

export function TimePicker({
    value,
    onChange,
    required,
    id,
    labelledBy,
    selectedDate,
    advanceNoticeMs,
    openingTime = "09:00",
    closingTime = "22:00",
    timeSlotIncrement = 30,
    enabledWeekdays = [1, 2, 3, 4, 5, 6, 7],
    closedTimeRanges = [],
    displayTimeFormat = "24h",
}: TimePickerProps) {
    const t = useTranslations("timePicker")
    const tf = normalizeTimeFormatPreference(displayTimeFormat)
    const is12h = tf === "12h"
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    useEffect(() => {
        if (!open) return
        function updatePosition() {
            if (!triggerRef.current) return
            const rect = triggerRef.current.getBoundingClientRect()
            const minPanel = is12h ? 304 : 248
            const width = Math.min(Math.max(rect.width, minPanel), window.innerWidth - 24)
            const maxLeft = window.innerWidth - width - 12
            const left = Math.min(Math.max(12, rect.left), Math.max(12, maxLeft))
            setDropdownStyle({
                position: "fixed",
                top: rect.bottom + 8,
                left,
                width,
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
    }, [open, is12h])

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest("[data-timepicker-portal]")
            ) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    function selectSlot(slot: string) {
        onChange(slot)
        setOpen(false)
    }

    const slots = useMemo(
        () => generateTimeSlots(openingTime, closingTime, timeSlotIncrement, closedTimeRanges),
        [openingTime, closingTime, timeSlotIncrement, closedTimeRanges]
    )

    const isDateOpen = !selectedDate || isOpenDay(selectedDate, enabledWeekdays)

    const triggerBase =
        "w-full px-4 py-3 rounded-brand border text-left flex items-center gap-3 transition bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text"
    const triggerClasses = `${triggerBase} ${open
        ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
        : "border-wg-border dark:border-wg-dark-border hover:border-wg-muted dark:hover:border-wg-dark-muted"
        }`

    const slotBase = is12h
        ? "min-h-[2.75rem] px-2 py-2 text-[11px] rounded-brand transition font-medium text-center leading-tight"
        : "px-1.5 py-1.5 text-xs rounded-brand transition font-medium text-center"
    const slotActive = "bg-wg-accent text-white"
    const slotIdle = "bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:bg-wg-secondary/20 dark:hover:bg-wg-dark-border border border-wg-border dark:border-wg-dark-border"
    const slotDisabled = "bg-wg-bg dark:bg-wg-dark-raised text-wg-muted/40 dark:text-wg-dark-muted/40 border border-wg-border/40 dark:border-wg-dark-border/40 cursor-not-allowed line-through"

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
                aria-haspopup="listbox"
            >
                {/* Clock icon */}
                <ClockRightAngleIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted shrink-0" />
                <span className={`text-sm ${value ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/60 dark:text-wg-dark-muted/60"}`}>
                    {value ? formatWallClockSlotLabel(value, tf) : t("selectTime")}
                </span>
                {/* Chevron */}
                <ChevronDownIcon className={`w-4 h-4 ml-auto shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && createPortal(
                <div
                    data-timepicker-portal
                    role="listbox"
                    aria-label={t("availableSlots")}
                    style={dropdownStyle}
                    className={`rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated space-y-4 ${is12h ? "min-w-[280px] p-3 sm:p-4" : "min-w-[240px] p-4"}`}
                >
                    {!isDateOpen ? (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                            {t("closedDay")}
                        </p>
                    ) : slots.length === 0 ? (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                            {t("noSlots")}
                        </p>
                    ) : (
                        <div
                            className={is12h ? "grid grid-cols-3 gap-2 sm:gap-2.5" : "grid grid-cols-4 gap-1.5"}
                            role="group"
                            aria-label={t("availableSlots")}
                        >
                            {slots.map((slot) => {
                                const disabled = isSlotDisabled(slot, selectedDate, advanceNoticeMs)
                                const label = formatWallClockSlotLabel(slot, tf)
                                return (
                                    <button
                                        key={slot}
                                        type="button"
                                        role="option"
                                        aria-selected={value === slot}
                                        disabled={disabled}
                                        onClick={() => !disabled && selectSlot(slot)}
                                        className={`${slotBase} ${disabled ? slotDisabled : value === slot ? slotActive : slotIdle}`}
                                    >
                                        {is12h ? <TimePicker12hSlotLabel label={label} /> : label}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>,
                document.body
            )}

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
