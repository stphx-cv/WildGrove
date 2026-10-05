"use client"

import type { MouseEvent } from "react"

/**
 * The one switch of the design system.
 *
 * Lives here for the same reason `.wg-check` and `.wg-radio` live in
 * `styles/tokens.css`: every toggle used to be hand-written at its call site,
 * and by v12 they had drifted into eight different "on" colours (emerald, sky,
 * amber, violet, indigo, teal, green and the brand amber) across two apps.
 * The brand has one accent — amber — and a toggle is not a status light.
 *
 * Sizes are the two that existed in the code: `md` (h-6 w-11) for settings
 * panels and forms, `sm` (h-5 w-9) for table rows.
 */
type SwitchSize = "sm" | "md"

/** Track, knob and travel are one formula: knob = track height − 4px, travel = width − height. */
const SIZES: Record<SwitchSize, { track: string; knob: string; travel: string }> = {
    sm: { track: "h-5 w-9", knob: "h-4 w-4", travel: "translate-x-4" },
    md: { track: "h-6 w-11", knob: "h-5 w-5", travel: "translate-x-5" },
}

interface SwitchProps {
    checked: boolean
    /** The event is forwarded so callers inside a clickable row can stop propagation. */
    onChange: (next: boolean, event: MouseEvent<HTMLButtonElement>) => void
    /** Accessible name. Required — the switch renders no text of its own. */
    label: string
    size?: SwitchSize
    disabled?: boolean
    title?: string
    className?: string
}

export function Switch({
    checked,
    onChange,
    label,
    size = "md",
    disabled = false,
    title,
    className = "",
}: SwitchProps) {
    const { track, knob, travel } = SIZES[size]

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={title}
            disabled={disabled}
            onClick={(event) => {
                if (disabled) return
                onChange(!checked, event)
            }}
            className={`relative inline-flex ${track} flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 focus:ring-offset-2 focus:ring-offset-wg-surface dark:focus:ring-offset-wg-dark-surface disabled:opacity-50 disabled:cursor-not-allowed ${
                checked
                    ? "bg-wg-accent dark:bg-wg-dark-accent"
                    : "bg-wg-border dark:bg-wg-dark-border"
            } ${className}`}
        >
            <span
                className={`pointer-events-none inline-block ${knob} transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    checked ? travel : "translate-x-0"
                }`}
            />
        </button>
    )
}
