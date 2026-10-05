"use client"

import { useRef, useState, useEffect } from "react"
import type { DatePreset } from "@/hooks/useDashboardDateRange"
import { CalendarBandIcon, ChevronDownIcon } from "@wildgrove/ui/icons"

const PRESETS: Array<{ value: DatePreset; label: string }> = [
    { value: "today",     label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last7d",    label: "Last 7 days" },
    { value: "last30d",   label: "Last 30 days" },
    { value: "thisMonth", label: "This month" },
    { value: "lastMonth", label: "Last month" },
]

const PRESET_LABELS: Record<DatePreset, string> = {
    today:     "Today",
    yesterday: "Yesterday",
    last7d:    "Last 7 days",
    last30d:   "Last 30 days",
    thisMonth: "This month",
    lastMonth: "Last month",
    custom:    "Custom range",
}

interface DateRangePickerProps {
    preset: DatePreset
    onPresetChange: (preset: DatePreset) => void
}

export function DateRangePicker({ preset, onPresetChange }: DateRangePickerProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    // Close on outside click or Escape
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus() }
        }
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("keydown", onKey)
        document.addEventListener("mousedown", onClick)
        return () => {
            document.removeEventListener("keydown", onKey)
            document.removeEventListener("mousedown", onClick)
        }
    }, [open])

    return (
        <div className="relative" ref={ref}>
            <button
                ref={triggerRef}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-brand border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-sm text-wg-text dark:text-wg-dark-text hover:border-wg-accent dark:hover:border-wg-dark-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent"
            >
                <CalendarBandIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted" aria-hidden="true" />
                {PRESET_LABELS[preset]}
                <ChevronDownIcon className="w-3.5 h-3.5 text-wg-muted dark:text-wg-dark-muted" strokeWidth={2} aria-hidden="true" />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Select date range"
                    className="absolute right-0 mt-1 z-50 w-44 rounded-card border border-wg-border/60 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface shadow-card dark:shadow-glow-sm"
                >
                    <ul role="listbox" aria-label="Date presets" className="py-1">
                        {PRESETS.map(({ value, label }) => (
                            <li key={value} role="option" aria-selected={preset === value}>
                                <button
                                    onClick={() => { onPresetChange(value); setOpen(false); triggerRef.current?.focus() }}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-accent ${
                                        preset === value
                                            ? "bg-wg-primary/10 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-accent font-medium"
                                            : "text-wg-text dark:text-wg-dark-text hover:bg-wg-border/20 dark:hover:bg-wg-dark-border"
                                    }`}
                                >
                                    {label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
