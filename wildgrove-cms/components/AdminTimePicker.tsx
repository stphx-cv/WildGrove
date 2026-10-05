"use client"

// ══════════════════════════════════════════════════════════════════
// AdminTimePicker — Lunch / dinner slot grid for admin edit forms
// Mirrors the client TimePicker design without next-intl dependency
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { formatWallClockSlotLabel, normalizeTimeFormatPreference } from "@wildgrove/core/app-datetime-format"
import { ChevronDownMidIcon, ClockRightAngleIcon, MoonIcon, SunIcon } from "@wildgrove/ui/icons"

interface AdminTimePickerProps {
    value: string // "HH:MM" or ""
    onChange: (time: string) => void
    placeholder?: string
    /** When provided, shows this slot list instead of the default lunch/dinner grids. */
    slotOptions?: string[]
    disabled?: boolean
    className?: string
}

const LUNCH_SLOTS = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"]
const DINNER_SLOTS = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"]

type SlotPeriod = "night" | "morning" | "day" | "evening"

/** Split a flat slot list into readable chunks for the settings-style picker. */
function groupSlotsByPeriod(slots: string[]): { key: SlotPeriod; label: string; slots: string[] }[] {
    const order: SlotPeriod[] = ["night", "morning", "day", "evening"]
    const labels: Record<SlotPeriod, string> = {
        night: "00:00 – 05:59",
        morning: "06:00 – 11:59",
        day: "12:00 – 17:59",
        evening: "18:00 – 23:59",
    }
    const buckets: Record<SlotPeriod, string[]> = {
        night: [],
        morning: [],
        day: [],
        evening: [],
    }
    for (const slot of slots) {
        const h = Number(slot.split(":")[0])
        if (!Number.isFinite(h)) continue
        if (h < 6) buckets.night.push(slot)
        else if (h < 12) buckets.morning.push(slot)
        else if (h < 18) buckets.day.push(slot)
        else buckets.evening.push(slot)
    }
    return order
        .filter((k) => buckets[k].length > 0)
        .map((k) => ({ key: k, label: labels[k], slots: buckets[k] }))
}

export function AdminTimePicker({
    value,
    onChange,
    placeholder = "Select time…",
    slotOptions,
    disabled = false,
    className = "",
}: AdminTimePickerProps) {
    const { timeFormat: cmsTimeFormat } = useAdminAppDateTime()
    const tf = normalizeTimeFormatPreference(cmsTimeFormat)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    const useCustomSlots = slotOptions !== undefined
    const customSlotsEmpty = useCustomSlots && slotOptions.length === 0
    /** Compact panel: still readable, less tall than a wide 2-col layout */
    const customPanelMinWidth = 236
    const customPanelMaxWidth = 272

    const slotGroups = useMemo(
        () => (useCustomSlots && slotOptions!.length > 0 ? groupSlotsByPeriod(slotOptions!) : []),
        [useCustomSlots, slotOptions],
    )

    useEffect(() => {
        if (!open) return
        function updatePosition() {
            if (!triggerRef.current) return
            const rect = triggerRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom - 16
            const spaceAbove = rect.top - 16
            const IDEAL_HEIGHT = 340
            const panelWidth = useCustomSlots
                ? Math.min(
                      Math.max(rect.width, customPanelMinWidth),
                      customPanelMaxWidth,
                      window.innerWidth - 32,
                  )
                : rect.width
            const maxLeft = window.innerWidth - panelWidth - 16
            const left = Math.min(Math.max(16, rect.left), Math.max(16, maxLeft))

            if (spaceBelow >= IDEAL_HEIGHT || spaceBelow >= spaceAbove) {
                setDropdownStyle({
                    position: "fixed",
                    top: rect.bottom + 8,
                    left,
                    width: panelWidth,
                    maxHeight: Math.max(spaceBelow - 8, 200),
                    overflowY: "auto",
                    overflowX: "hidden",
                    zIndex: 9999,
                })
            } else {
                setDropdownStyle({
                    position: "fixed",
                    bottom: window.innerHeight - rect.top + 8,
                    left,
                    width: panelWidth,
                    maxHeight: Math.max(spaceAbove - 8, 200),
                    overflowY: "auto",
                    overflowX: "hidden",
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
    }, [open, useCustomSlots, customPanelMinWidth, customPanelMaxWidth])

    useLayoutEffect(() => {
        if (!open || !useCustomSlots || !value) return
        const root = document.querySelector("[data-admin-timepicker-portal]")
        const selected = root?.querySelector("[data-admin-timepicker-selected]")
        selected?.scrollIntoView({ block: "nearest", behavior: "auto" })
    }, [open, value, useCustomSlots])

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest("[data-admin-timepicker-portal]")
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

    const TRIGGER_BASE =
        "w-full px-3.5 py-2.5 text-sm rounded-brand border " +
        "bg-wg-bg dark:bg-wg-dark-bg transition-all flex items-center gap-2 text-left"

    const triggerCls = `${TRIGGER_BASE} ${
        disabled
            ? "opacity-50 cursor-not-allowed border-wg-border/40 dark:border-wg-dark-border/40"
            : open
              ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
              : "border-wg-border/50 dark:border-wg-dark-border hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40"
    }`

    const slotBase = "py-1.5 text-xs rounded-brand transition font-medium text-center"
    const slotActive = "bg-wg-accent text-white"
    const slotIdle =
        "bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text " +
        "hover:bg-wg-secondary/20 dark:hover:bg-wg-dark-border border border-wg-border dark:border-wg-dark-border"

    const customSlotBtn =
        "min-h-[2.125rem] w-full rounded-brand border px-2 py-1.5 text-xs font-semibold tabular-nums tracking-tight " +
        "transition-colors duration-150 flex items-center justify-center text-center leading-none " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent/50 dark:focus-visible:ring-wg-dark-accent/50 " +
        "focus-visible:ring-offset-1 focus-visible:ring-offset-wg-surface dark:focus-visible:ring-offset-wg-dark-surface"
    const customSlotActive =
        "border-wg-accent dark:border-wg-dark-accent bg-wg-accent text-white shadow-sm"
    const customSlotIdle =
        "border-wg-border/60 dark:border-wg-dark-border bg-wg-bg/80 dark:bg-wg-dark-raised/90 " +
        "text-wg-text dark:text-wg-dark-text hover:border-wg-accent/45 dark:hover:border-wg-dark-accent/50 " +
        "hover:bg-wg-secondary/15 dark:hover:bg-wg-dark-border/60"

    return (
        <div ref={containerRef} className={`relative min-w-[9.5rem] ${className}`}>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled || customSlotsEmpty}
                onClick={() => {
                    if (disabled || customSlotsEmpty) return
                    setOpen(v => !v)
                }}
                className={triggerCls}
                aria-expanded={open}
            >
                {/* Clock icon */}
                <ClockRightAngleIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                <span className={`flex-1 truncate ${value ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/50 dark:text-wg-dark-muted/50"}`}>
                    {value ? formatWallClockSlotLabel(value, tf) : placeholder}
                </span>
                {/* Chevron */}
                <ChevronDownMidIcon className={`w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>

            {open && createPortal(
                <div
                    data-admin-timepicker-portal
                    style={dropdownStyle}
                    className={
                        useCustomSlots
                            ? "rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/80 dark:border-wg-dark-border shadow-elevated py-2 pl-2.5 pr-1.5"
                            : "rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated p-4 space-y-4"
                    }
                >
                    {useCustomSlots ? (
                        <div className="space-y-3.5 pr-1 pb-0.5">
                            {slotGroups.map((group) => (
                                <div key={group.key}>
                                    <p className="mb-1.5 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-wg-muted dark:text-wg-dark-muted">
                                        {group.label}
                                    </p>
                                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-1.5">
                                        {group.slots.map((slot) => {
                                            const selected = value === slot
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    data-admin-timepicker-selected={selected ? "" : undefined}
                                                    onClick={() => selectSlot(slot)}
                                                    className={`${customSlotBtn} ${selected ? customSlotActive : customSlotIdle}`}
                                                >
                                                    {formatWallClockSlotLabel(slot, tf)}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Lunch */}
                            <div>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <SunIcon className="w-3.5 h-3.5 text-wg-accent dark:text-wg-dark-accent" />
                                    <span className="text-xs font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted select-none">
                                        Lunch
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {LUNCH_SLOTS.map(slot => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => selectSlot(slot)}
                                            className={`${slotBase} ${value === slot ? slotActive : slotIdle}`}
                                        >
                                            {formatWallClockSlotLabel(slot, tf)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-wg-border dark:bg-wg-dark-border" />

                            {/* Dinner */}
                            <div>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <MoonIcon className="w-3.5 h-3.5 text-wg-accent dark:text-wg-dark-accent" />
                                    <span className="text-xs font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted select-none">
                                        Dinner
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {DINNER_SLOTS.map(slot => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => selectSlot(slot)}
                                            className={`${slotBase} ${value === slot ? slotActive : slotIdle}`}
                                        >
                                            {formatWallClockSlotLabel(slot, tf)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}
