"use client"

// ══════════════════════════════════════════════════════════════════
// SearchInput — Debounced search input for admin list views
// 300ms debounce to avoid excessive API calls
// ══════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from "react"
import { CloseIcon, MagnifyingGlassIcon } from "@wildgrove/ui/icons"

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    /** Debounce delay in ms (default: 300) */
    debounceMs?: number
    className?: string
}

export function SearchInput({
    value: externalValue,
    onChange,
    placeholder = "Search...",
    debounceMs = 300,
    className = "",
}: SearchInputProps) {
    const [internalValue, setInternalValue] = useState(externalValue)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync internal with external when external changes
    useEffect(() => {
        setInternalValue(externalValue)
    }, [externalValue])

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value
            setInternalValue(newValue)

            // Debounce the external onChange
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                onChange(newValue)
            }, debounceMs)
        },
        [onChange, debounceMs]
    )

    const handleClear = useCallback(() => {
        setInternalValue("")
        onChange("")
        if (debounceRef.current) clearTimeout(debounceRef.current)
    }, [onChange])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    return (
        <div className={`relative ${className}`}>
            {/* Search icon */}
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wg-muted dark:text-wg-dark-muted pointer-events-none" />

            <input
                type="text"
                value={internalValue}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 focus:outline-none focus:ring-2 focus:ring-wg-accent/30 dark:focus:ring-wg-dark-accent/30 focus:border-wg-accent dark:focus:border-wg-dark-accent transition-colors"
            />

            {/* Clear button */}
            {internalValue && (
                <button
                    onClick={handleClear}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text transition-colors"
                    aria-label="Clear search"
                >
                    <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
            )}
        </div>
    )
}
