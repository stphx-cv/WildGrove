"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { ChevronDownIcon, MinusIcon, PlusIcon, UsersIcon } from "@wildgrove/ui/icons"

interface GuestsPickerProps {
    value: number
    onChange: (n: number) => void
    required?: boolean
    /** Put on the trigger button, so a <label htmlFor> names it. */
    id?: string
    /** The label's id: the button is then read as the label plus its current value. */
    labelledBy?: string
    maxGuests?: number
    largeGroupWarningFrom?: number
}

export function GuestsPicker({
    value,
    onChange,
    required,
    id,
    labelledBy,
    maxGuests = 20,
    largeGroupWarningFrom = 8,
}: GuestsPickerProps) {
    const t = useTranslations("guestsPicker")
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
    const hasValue = value > 0

    useEffect(() => {
        if (!open) return
        function updatePosition() {
            if (!triggerRef.current) return
            const rect = triggerRef.current.getBoundingClientRect()
            setDropdownStyle({
                position: "fixed",
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width,
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
                !(e.target as HTMLElement).closest("[data-guestspicker-portal]")
            ) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    function select(n: number) {
        onChange(n)
        // Auto-close only for small parties (large parties might want to see the note)
        if (n <= 7) setOpen(false)
    }

    const triggerBase =
        "w-full px-4 py-3 rounded-brand border text-left flex items-center gap-3 transition bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text"
    const triggerClasses = `${triggerBase} ${
        open
            ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
            : "border-wg-border dark:border-wg-dark-border hover:border-wg-muted dark:hover:border-wg-dark-muted"
    }`

    const numBase = "py-1.5 text-xs rounded-brand transition font-medium text-center"
    const numActive = "bg-wg-accent text-white"
    const numIdle = "bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:bg-wg-secondary/20 dark:hover:bg-wg-dark-border border border-wg-border dark:border-wg-dark-border"
    const warningThreshold = Math.min(Math.max(1, largeGroupWarningFrom), maxGuests)

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
                {/* People icon */}
                <UsersIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted shrink-0" />
                <span className={`text-sm ${hasValue ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/60 dark:text-wg-dark-muted/60"}`}>
                    {hasValue ? `${value} ${value === 1 ? t("guest") : t("guests")}` : t("selectGuests")}
                </span>
                {/* Chevron */}
                <ChevronDownIcon className={`w-4 h-4 ml-auto shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && createPortal(
                <div
                    data-guestspicker-portal
                    role="dialog"
                    aria-label={t("dialogLabel")}
                    style={dropdownStyle}
                    className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated p-4"
                >
                    {/* Stepper */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={() => { if (value > 1) onChange(value - 1) }}
                            disabled={value <= 1}
                            aria-label={t("decreaseGuests")}
                            className="w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <MinusIcon className="w-4 h-4" strokeWidth={2} />
                        </button>

                        <div className="text-center select-none">
                            <span className={`font-display text-2xl font-bold ${hasValue ? "text-wg-text dark:text-wg-dark-text" : "text-wg-muted/40 dark:text-wg-dark-muted/40"}`}>
                                {hasValue ? value : "–"}
                            </span>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                {value === 1 ? t("guest") : t("guests")}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => { if (value < maxGuests) onChange(value + 1) }}
                            disabled={value >= maxGuests}
                            aria-label={t("increaseGuests")}
                            className="w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-4 h-4" strokeWidth={2} />
                        </button>
                    </div>

                    <div className="h-px bg-wg-border dark:bg-wg-dark-border mb-3" />

                    {/* Quick-select grid 1–maxGuests */}
                    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={t("quickSelect")}>
                        {Array.from({ length: maxGuests }, (_, i) => i + 1).map(n => (
                            <button
                                key={n}
                                type="button"
                                aria-pressed={value === n}
                                onClick={() => select(n)}
                                className={`${numBase} ${value === n ? numActive : numIdle}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    {value >= warningThreshold && (
                        <p className="text-xs text-wg-accent dark:text-wg-dark-accent mt-3 text-center leading-relaxed">
                            {t("largeGroupNote", { count: warningThreshold })}
                        </p>
                    )}
                </div>,
                document.body
            )}

            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ opacity: 0, position: "absolute", height: 0, width: 0, pointerEvents: "none" }}
                    value={hasValue ? String(value) : ""}
                    required
                    onChange={() => { }}
                />
            )}
        </div>
    )
}
