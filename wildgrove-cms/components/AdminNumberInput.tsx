"use client"

// ══════════════════════════════════════════════════════════════════
// AdminNumberInput — Custom branded numeric input with − / + controls
// Replaces native <input type="number"> in admin forms to ensure
// consistent design with AdminSelect and AdminDatePicker.
//
// Props:
//   value / onChange  → string-based (mirrors form state convention)
//   min / max / step  → numeric bounds
//   placeholder       → text shown when empty, e.g. "Unlimited"
//   nullable          → whether clearing to "" is allowed (default: true)
//   decimals          → decimal places for float values (default: 0)
//   integerStepper    → when true with decimals>0: −/+ change value by 1.00;
//                       − below 1.00 snaps to 0.00 (manual typing still allows decimals)
//   prefix            → fixed label inside the field, e.g. "$" or "#"
//   required          → HTML required attribute on the inner input
// ══════════════════════════════════════════════════════════════════

import { useRef } from "react"
import { MinusIcon, PlusCompactIcon } from "@wildgrove/ui/icons"

// ── Types ──

export interface AdminNumberInputProps {
    value: string                   // "" = empty / no value
    onChange: (value: string) => void
    min?: number                    // inclusive lower bound (default: 1)
    max?: number                    // inclusive upper bound
    step?: number                   // increment / decrement amount (default: 1)
    placeholder?: string            // shown when empty
    nullable?: boolean              // allow clearing back to "" (default: true)
    decimals?: number               // decimal precision for float inputs (default: 0)
    /** If true with decimals > 0: −/+ adjust by whole 1.00; values under 1.00 go to 0.00 on − */
    integerStepper?: boolean
    prefix?: React.ReactNode        // fixed label inside the field, e.g. "$"
    suffix?: React.ReactNode        // fixed label after the value, e.g. "%"
    required?: boolean
    disabled?: boolean
    className?: string
}

// ── Shared trigger base (mirrors AdminSelect / AdminDatePicker) ──

const TRIGGER_BASE =
    "flex items-stretch rounded-brand border " +
    "bg-wg-bg dark:bg-wg-dark-bg " +
    "transition-all"

// ── Component ──

export function AdminNumberInput({
    value,
    onChange,
    min = 1,
    max,
    step = 1,
    placeholder = "—",
    nullable = true,
    decimals = 0,
    integerStepper = false,
    prefix,
    suffix,
    required = false,
    disabled = false,
    className = "",
}: AdminNumberInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const numVal = value !== "" ? parseFloat(value) : null
    const useIntegerStepper = integerStepper && decimals > 0

    // ── Button disabled states ──
    const minusDisabled =
        disabled ||
        numVal === null ||
        (useIntegerStepper ? numVal <= 0 : !nullable && numVal <= min)

    const plusDisabled =
        disabled ||
        (max !== undefined && numVal !== null && numVal >= max)

    // ── Handlers ──

    const handleDecrement = () => {
        if (disabled || numVal === null) return
        if (useIntegerStepper) {
            if (numVal < 1) {
                onChange((0).toFixed(decimals))
                return
            }
            const next = parseFloat((numVal - 1).toFixed(decimals))
            onChange(next.toFixed(decimals))
            return
        }
        const next = parseFloat((numVal - step).toFixed(decimals))
        if (next < min) {
            if (nullable) onChange("")
            else onChange(String(min))
        } else {
            onChange(String(next))
        }
    }

    const handleIncrement = () => {
        if (disabled) return
        if (useIntegerStepper) {
            if (numVal === null) {
                const start = Math.max(1, min)
                onChange(start.toFixed(decimals))
                return
            }
            const next = parseFloat((numVal + 1).toFixed(decimals))
            if (max !== undefined && next > max) return
            onChange(next.toFixed(decimals))
            return
        }
        if (numVal === null) {
            // First step from empty: use max(step, min) so e.g. min=0.01 + step=1 → 1.00, not 0.01
            const start = Math.max(step, min)
            onChange(decimals > 0 ? start.toFixed(decimals) : String(start))
            return
        }
        const next = parseFloat((numVal + step).toFixed(decimals))
        if (max !== undefined && next > max) return
        onChange(String(next))
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value
        // Latin-American keyboards often use "," as decimal separator
        if (decimals > 0) raw = raw.replace(",", ".")
        if (raw === "" && nullable) {
            onChange("")
            return
        }
        // Allow digits plus optional decimal separator
        const pattern = decimals > 0 ? /^\d*\.?\d*$/ : /^\d*$/
        if (pattern.test(raw)) {
            onChange(raw)
        }
    }

    const handleBlur = () => {
        if (value === "") return
        const n = decimals > 0 ? parseFloat(value) : parseInt(value, 10)
        if (isNaN(n)) {
            if (nullable) onChange("")
            else onChange(String(min))
            return
        }
        const clamped = Math.max(min, max !== undefined ? Math.min(n, max) : n)
        onChange(decimals > 0 ? clamped.toFixed(decimals) : String(clamped))
    }

    // ── Shared button class ──
    const btnCls = (side: "left" | "right", isDisabled: boolean) =>
        [
            "flex items-center justify-center px-3",
            "text-wg-muted dark:text-wg-dark-muted",
            !isDisabled && "hover:text-wg-text dark:hover:text-wg-dark-text",
            side === "left"
                ? "border-r border-wg-border/30 dark:border-wg-dark-border/50"
                : "border-l border-wg-border/30 dark:border-wg-dark-border/50",
            isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
            "transition-colors select-none",
        ]
            .filter(Boolean)
            .join(" ")

    return (
        <div
            className={[
                TRIGGER_BASE,
                disabled
                    ? "border-wg-border/30 dark:border-wg-dark-border/30 opacity-50"
                    : "border-wg-border/50 dark:border-wg-dark-border hover:border-wg-accent/40 dark:hover:border-wg-dark-accent/40",
                "focus-within:border-wg-accent dark:focus-within:border-wg-dark-accent",
                "focus-within:ring-2 focus-within:ring-wg-accent/20 dark:focus-within:ring-wg-dark-accent/20",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {/* ── Minus (−) ── */}
            <button
                type="button"
                onClick={handleDecrement}
                disabled={minusDisabled}
                aria-label="Decrease"
                tabIndex={-1}
                className={btnCls("left", minusDisabled)}
            >
                <MinusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>

            {/* ── Center: optional prefix + value input + optional suffix (cluster centered between − / +) ── */}
            <div
                className={[
                    "flex flex-1 min-w-0 items-center justify-center",
                    prefix || suffix ? "px-3" : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <div className="inline-flex max-w-full min-w-0 items-center justify-center gap-1.5">
                    {prefix && (
                        <span className="shrink-0 text-sm font-semibold text-wg-muted dark:text-wg-dark-muted select-none pointer-events-none">
                            {prefix}
                        </span>
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode={decimals > 0 ? "decimal" : "numeric"}
                        value={value}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                        className={[
                            "min-w-0 py-2.5 text-center text-sm bg-transparent outline-none",
                            "text-wg-text dark:text-wg-dark-text",
                            "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50",
                            "tabular-nums font-medium",
                            prefix || suffix
                                ? "w-[min(100%,16ch)] min-w-[4ch] shrink"
                                : "flex-1 px-2",
                            disabled ? "cursor-not-allowed" : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    />
                    {suffix && (
                        <span className="shrink-0 text-sm font-semibold text-wg-muted dark:text-wg-dark-muted select-none pointer-events-none">
                            {suffix}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Plus (+) ── */}
            <button
                type="button"
                onClick={handleIncrement}
                disabled={plusDisabled}
                aria-label="Increase"
                tabIndex={-1}
                className={btnCls("right", plusDisabled)}
            >
                <PlusCompactIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
        </div>
    )
}
