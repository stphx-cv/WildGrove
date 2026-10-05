"use client"

// ══════════════════════════════════════════════════════════════════
// AdminGuestsPicker — Stepper + 1–20 quick-select grid for admin
// Mirrors the client GuestsPicker design without next-intl dependency
// Uses createPortal so the dropdown escapes overflow-hidden parents
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDownMidIcon, MinusIcon, PlusIcon, UsersIcon } from "@wildgrove/ui/icons"

interface AdminGuestsPickerProps {
    value: number
    onChange: (n: number) => void
}

export function AdminGuestsPicker({ value, onChange }: AdminGuestsPickerProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    useEffect(() => {
        if (!open) return
        function updatePosition() {
            if (!triggerRef.current) return
            const rect = triggerRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom - 16
            const spaceAbove = rect.top - 16
            const IDEAL_HEIGHT = 420

            if (spaceBelow >= IDEAL_HEIGHT || spaceBelow >= spaceAbove) {
                setDropdownStyle({
                    position: "fixed",
                    top: rect.bottom + 6,
                    left: rect.left,
                    width: rect.width,
                    maxHeight: Math.max(spaceBelow, 200),
                    overflowY: "auto",
                    zIndex: 9999,
                })
            } else {
                setDropdownStyle({
                    position: "fixed",
                    bottom: window.innerHeight - rect.top + 6,
                    left: rect.left,
                    width: rect.width,
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
    }, [open])

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (
                containerRef.current && !containerRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest("[data-admin-guestspicker-portal]")
            ) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    function select(n: number) {
        onChange(n)
        if (n <= 7) setOpen(false)
    }

    const TRIGGER_BASE =
        "w-full px-3.5 py-2.5 text-sm rounded-brand border " +
        "bg-wg-bg dark:bg-wg-dark-bg transition-all flex items-center gap-2 text-left"

    const triggerCls = `${TRIGGER_BASE} ${
        open
            ? "border-wg-accent dark:border-wg-dark-accent ring-2 ring-wg-accent/20 dark:ring-wg-dark-accent/20"
            : "border-wg-border/50 dark:border-wg-dark-border hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40"
    }`

    const numBase = "py-1.5 text-xs rounded-brand transition font-medium text-center"
    const numActive = "bg-wg-accent text-white"
    const numIdle =
        "bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text " +
        "hover:bg-wg-secondary/20 dark:hover:bg-wg-dark-border border border-wg-border dark:border-wg-dark-border"

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className={triggerCls}
                aria-expanded={open}
            >
                {/* People icon */}
                <UsersIcon className="w-4 h-4 shrink-0 text-wg-muted dark:text-wg-dark-muted" />
                <span className="text-sm text-wg-text dark:text-wg-dark-text">
                    {value} {value === 1 ? "guest" : "guests"}
                </span>
                {/* Chevron */}
                <ChevronDownMidIcon className={`w-4 h-4 ml-auto shrink-0 text-wg-muted dark:text-wg-dark-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>

            {open && createPortal(
                <div
                    data-admin-guestspicker-portal
                    style={dropdownStyle}
                    className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated p-4"
                >
                    {/* Stepper */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={() => { if (value > 1) onChange(value - 1) }}
                            disabled={value <= 1}
                            className="w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <MinusIcon className="w-4 h-4" strokeWidth={2} />
                        </button>

                        <div className="text-center select-none">
                            <span className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                                {value}
                            </span>
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                {value === 1 ? "guest" : "guests"}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => { if (value < 20) onChange(value + 1) }}
                            disabled={value >= 20}
                            className="w-9 h-9 rounded-full border border-wg-border dark:border-wg-dark-border flex items-center justify-center text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-4 h-4" strokeWidth={2} />
                        </button>
                    </div>

                    <div className="h-px bg-wg-border dark:bg-wg-dark-border mb-3" />

                    {/* Quick-select grid 1–20 */}
                    <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => select(n)}
                                className={`${numBase} ${value === n ? numActive : numIdle}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    {value >= 8 && (
                        <p className="text-xs text-wg-accent dark:text-wg-dark-accent mt-3 text-center leading-relaxed">
                            For large parties, please confirm availability with the team.
                        </p>
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}
