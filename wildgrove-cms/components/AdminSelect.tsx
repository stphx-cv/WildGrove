"use client"

// ══════════════════════════════════════════════════════════════════
// AdminSelect — Custom styled dropdown with per-option icons
// Replaces native <select> for all admin forms to ensure consistent
// design and support icon rendering inside option items.
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import { CheckCompactIcon, ChevronDownMidIcon } from "@wildgrove/ui/icons"

// ── Types ──

export interface SelectOption {
    value: string
    label: string
    /** Optional icon shown next to the label in both trigger and list */
    icon?: React.ReactNode
    /** Optional dim hint text shown below the label */
    hint?: string
}

interface AdminSelectProps {
    value: string
    onChange: (value: string) => void
    options: SelectOption[]
    placeholder?: string
    required?: boolean
    disabled?: boolean
    className?: string
    /** Extra label shown inside the trigger before the value (e.g. a left icon wrapper) */
    triggerPrefix?: React.ReactNode
}

// ── Shared admin input class (must match the inputCls in form files) ──
const BASE =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border " +
    "bg-wg-bg dark:bg-wg-dark-bg " +
    "transition-all"

export function AdminSelect({
    value,
    onChange,
    options,
    placeholder = "Select…",
    required = false,
    disabled = false,
    className = "",
    triggerPrefix,
}: AdminSelectProps) {
    const [open, setOpen]     = useState(false)
    const containerRef        = useRef<HTMLDivElement>(null)
    const selectedOption      = options.find((o) => o.value === value)

    // ── Close on outside click ──
    useEffect(() => {
        if (!open) return
        function handleOut(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleOut)
        return () => document.removeEventListener("mousedown", handleOut)
    }, [open])

    // ── Close on Escape ──
    useEffect(() => {
        if (!open) return
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("keydown", handleKey)
        return () => document.removeEventListener("keydown", handleKey)
    }, [open])

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* ── Trigger button ── */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((o) => !o)}
                className={`${BASE} flex items-center gap-2.5 text-left ${
                    open
                        ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
                        : "border-wg-border/50 dark:border-wg-dark-border hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
                {/* Left prefix (e.g. static icon) */}
                {triggerPrefix && (
                    <span className="shrink-0 pointer-events-none">{triggerPrefix}</span>
                )}

                {/* Selected option icon */}
                {selectedOption?.icon && !triggerPrefix && (
                    <span className="shrink-0 text-wg-accent/80 dark:text-wg-dark-accent/80">
                        {selectedOption.icon}
                    </span>
                )}

                {/* Label */}
                <span className={`flex-1 truncate ${selectedOption ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/50 dark:text-wg-dark-muted/50"}`}>
                    {selectedOption?.label ?? placeholder}
                </span>

                {/* Chevron */}
                <ChevronDownMidIcon className={`w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>

            {/* Native hidden select for form required validation */}
            <select
                value={value}
                onChange={() => {}}
                required={required}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 w-full opacity-0 pointer-events-none"
            >
                <option value="" />
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>

            {/* ── Dropdown list ── */}
            {open && (
                <div className="absolute z-50 mt-1.5 w-full rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface shadow-elevated max-h-72 overflow-y-auto">
                    {/* Placeholder row: choosing it clears the value, so a
                        required field does not offer it. */}
                    {!required && (
                        <button
                            type="button"
                            onClick={() => { onChange(""); setOpen(false) }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left text-wg-muted/60 dark:text-wg-dark-muted/60 hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors border-b border-wg-border/30 dark:border-wg-dark-border/50"
                        >
                            {placeholder}
                        </button>
                    )}

                    {options.map((option) => {
                        const isSelected = option.value === value
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => { onChange(option.value); setOpen(false) }}
                                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors ${
                                    isSelected
                                        ? "bg-wg-primary/10 dark:bg-wg-dark-primary/15"
                                        : "hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                                }`}
                            >
                                {/* Option icon */}
                                {option.icon && (
                                    <span className={`shrink-0 ${isSelected ? "text-wg-primary dark:text-wg-dark-primary" : "text-wg-muted dark:text-wg-dark-muted"}`}>
                                        {option.icon}
                                    </span>
                                )}

                                {/* Label + hint */}
                                <span className="flex-1 min-w-0">
                                    <span className={`block truncate font-medium ${isSelected ? "text-wg-primary dark:text-wg-dark-primary" : "text-wg-text dark:text-wg-dark-text"}`}>
                                        {option.label}
                                    </span>
                                    {option.hint && (
                                        <span className="block text-[11px] text-wg-muted dark:text-wg-dark-muted truncate">
                                            {option.hint}
                                        </span>
                                    )}
                                </span>

                                {/* Check mark for selected */}
                                {isSelected && (
                                    <CheckCompactIcon className="w-4 h-4 shrink-0 text-wg-primary dark:text-wg-dark-primary" strokeWidth={2.5} />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
