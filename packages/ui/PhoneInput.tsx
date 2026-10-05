"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { type Country, COUNTRIES, PRIORITY_COUNTRIES, OTHER_COUNTRIES } from "@wildgrove/core/phone"

// ══════════════════════════════════════════════════════════════════
// PhoneInput — Country code picker + digit-only number field
// Stores combined value as E.164 string: "+51987654321"
// ══════════════════════════════════════════════════════════════════

export type { Country }
export { COUNTRIES }

const DEFAULT_COUNTRY = PRIORITY_COUNTRIES[0] // Perú

/** Lowercase and strip diacritics, so "peru" finds "Perú" and "cote" finds "Côte d'Ivoire". */
function normalize(text: string): string {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/** Parse a stored E.164 phone string back into country + local number */
export function parsePhone(value: string): { country: Country; localNumber: string } | null {
    if (!value || !value.startsWith("+")) return null
    const digits = value.slice(1) // strip "+"
    // Sort by dialCode length descending so longer codes (e.g. "506") match before "50"
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
    for (const country of sorted) {
        if (digits.startsWith(country.dialCode)) {
            const local = digits.slice(country.dialCode.length)
            if (local.length <= country.maxDigits) {
                return { country, localNumber: local }
            }
        }
    }
    return null
}

interface PhoneInputProps {
    value: string          // E.164 string or ""
    onChange: (value: string) => void
    disabled?: boolean
    readOnly?: boolean
    className?: string
    id?: string
    autoComplete?: string
    searchPlaceholder?: string
    noResultsLabel?: string
    /** Accessible name of the country code button. */
    countryCodeLabel?: string
    /** Id of the element that names the number field, when there is no <label htmlFor>. */
    labelledBy?: string
    /** BCP 47 tag used to translate country names. Falls back to the English list when omitted. */
    locale?: string
}

export function PhoneInput({
    value,
    onChange,
    disabled = false,
    readOnly = false,
    className = "",
    id,
    autoComplete = "tel",
    searchPlaceholder = "Search country or code",
    noResultsLabel = "No countries found",
    countryCodeLabel = "Select country code",
    labelledBy,
    locale,
}: PhoneInputProps) {
    const parsed = parsePhone(value)
    const [selectedCountry, setSelectedCountry] = useState<Country>(
        parsed?.country ?? DEFAULT_COUNTRY
    )
    const [localNumber, setLocalNumber] = useState(parsed?.localNumber ?? "")
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [query, setQuery] = useState("")
    const dropdownRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // Sync external value changes (e.g. when user profile loads).
    // React-recommended "derived state from props" pattern: track the previous prop
    // with useState and update during render — avoids setState-in-effect and ref-in-render.
    const [prevValue, setPrevValue] = useState(value)
    if (prevValue !== value) {
        setPrevValue(value)
        const p = parsePhone(value)
        if (p) {
            setSelectedCountry(p.country)
            setLocalNumber(p.localNumber)
        } else if (!value) {
            setLocalNumber("")
        }
    }

    function closeDropdown() {
        setDropdownOpen(false)
        setQuery("")
    }

    // Close dropdown on outside click
    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                closeDropdown()
            }
        }
        if (dropdownOpen) {
            document.addEventListener("mousedown", handleOutside)
        }
        return () => document.removeEventListener("mousedown", handleOutside)
    }, [dropdownOpen])

    // Focus the search field as soon as the list opens: 242 entries are not scrollable by hand
    useEffect(() => {
        if (dropdownOpen) searchRef.current?.focus()
    }, [dropdownOpen])

    // Country names come from the platform for the active locale ("Germany" / "Alemania"),
    // so the search box answers to whichever language the guest is reading the site in.
    const displayNames = useMemo(() => {
        if (!locale) return null
        try {
            return new Intl.DisplayNames([locale], { type: "region" })
        } catch {
            return null
        }
    }, [locale])

    const labelOf = useCallback((country: Country) => {
        if (!displayNames) return country.name
        try {
            const translated = displayNames.of(country.code)
            // Unassigned codes (e.g. "XK") come back as the code itself — keep the curated name
            return !translated || translated === country.code ? country.name : translated
        } catch {
            return country.name
        }
    }, [displayNames])

    // A query searches the whole list flat; without one, priority countries lead and the rest follow
    const results = useMemo(() => {
        const q = normalize(query.trim()).replace(/^\+/, "")
        if (!q) return null
        return COUNTRIES.filter(c =>
            normalize(c.name).includes(q) ||
            normalize(labelOf(c)).includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.dialCode.includes(q)
        )
    }, [query, labelOf])

    function handleCountrySelect(country: Country) {
        setSelectedCountry(country)
        closeDropdown()
        // Trim local number if it exceeds new max
        const trimmed = localNumber.slice(0, country.maxDigits)
        setLocalNumber(trimmed)
        const combined = trimmed ? `+${country.dialCode}${trimmed}` : ""
        onChange(combined)
    }

    function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
        const digits = e.target.value.replace(/\D/g, "").slice(0, selectedCountry.maxDigits)
        setLocalNumber(digits)
        const combined = digits ? `+${selectedCountry.dialCode}${digits}` : ""
        onChange(combined)
    }

    const isInteractive = !disabled && !readOnly

    // ── Base input style (matches the rest of the design system)
    const inputBase =
        "border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 outline-none transition-colors"
    const borderNormal =
        "border-wg-border dark:border-wg-dark-border"
    // The focus ring is drawn outside the border box, so the half that falls on the
    // neighbouring field is painted over unless the focused half is lifted above it.
    const focusRing =
        "relative focus:z-20 focus:outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent"
    const disabledStyle =
        "opacity-50 cursor-default select-none"

    function renderOption(country: Country) {
        return (
            <button
                key={country.code}
                type="button"
                role="option"
                aria-selected={country.code === selectedCountry.code}
                onClick={() => handleCountrySelect(country)}
                className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors
                    ${country.code === selectedCountry.code
                        ? "bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent font-medium"
                        : "text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                    }
                `}
            >
                <span className="text-base leading-none w-6 flex-shrink-0">{country.flag}</span>
                <span className="flex-1 truncate">{labelOf(country)}</span>
                <span className="text-xs tabular-nums text-wg-muted dark:text-wg-dark-muted flex-shrink-0">
                    +{country.dialCode}
                </span>
            </button>
        )
    }

    return (
        <div
            className={`relative flex rounded-brand overflow-visible ${className}`}
            ref={dropdownRef}
            onKeyDown={(e) => {
                if (e.key === "Escape" && dropdownOpen) {
                    e.stopPropagation()
                    closeDropdown()
                }
            }}
        >
            {/* ── Country selector ─────────────────────────────── */}
            <button
                type="button"
                disabled={disabled || readOnly}
                onClick={() => isInteractive && (dropdownOpen ? closeDropdown() : setDropdownOpen(true))}
                className={`
                    flex items-center gap-1.5 px-3 py-3 rounded-l-brand
                    ${inputBase} ${borderNormal} ${focusRing}
                    flex-shrink-0 select-none
                    ${dropdownOpen ? "z-20 ring-2 ring-wg-accent dark:ring-wg-dark-accent" : ""}
                    ${isInteractive ? "hover:bg-wg-surface dark:hover:bg-wg-dark-surface cursor-pointer" : disabledStyle}
                `}
                aria-label={countryCodeLabel}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
            >
                <span className="text-lg leading-none">{selectedCountry.flag}</span>
                <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text tabular-nums">
                    +{selectedCountry.dialCode}
                </span>
                {isInteractive && (
                    <svg
                        className={`w-3.5 h-3.5 text-wg-muted dark:text-wg-dark-muted transition-transform flex-shrink-0 ${dropdownOpen ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                )}
            </button>

            {/* ── Number input ──────────────────────────────────── */}
            {/* -ml-px collapses the two adjacent borders into the single 1px divider */}
            <input
                id={id}
                aria-labelledby={labelledBy}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={localNumber}
                onChange={handleNumberChange}
                disabled={disabled}
                readOnly={readOnly}
                maxLength={selectedCountry.maxDigits}
                placeholder={"0".repeat(selectedCountry.maxDigits)}
                autoComplete={autoComplete}
                className={`
                    flex-1 min-w-0 -ml-px px-3 py-3 rounded-r-brand
                    ${inputBase} ${borderNormal} ${focusRing}
                    ${disabled ? disabledStyle : ""}
                    ${readOnly ? "bg-wg-surface dark:bg-wg-dark-surface cursor-default" : ""}
                `}
            />

            {/* ── Country dropdown ──────────────────────────────── */}
            {dropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-1.5 w-72 max-w-[calc(100vw-3rem)] rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated overflow-hidden">
                    <div className="p-2 border-b border-wg-border dark:border-wg-dark-border">
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            aria-label={searchPlaceholder}
                            className="w-full px-3 py-2 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 outline-none focus:ring-2 focus:ring-wg-accent dark:focus:ring-wg-dark-accent transition-colors"
                        />
                    </div>
                    <div role="listbox" className="max-h-72 overflow-y-auto py-1">
                        {results
                            ? (results.length > 0
                                ? results.map(renderOption)
                                : (
                                    <p className="px-4 py-6 text-sm text-center text-wg-muted dark:text-wg-dark-muted">
                                        {noResultsLabel}
                                    </p>
                                ))
                            : (
                                <>
                                    {PRIORITY_COUNTRIES.map(renderOption)}
                                    <div className="my-1 border-t border-wg-border dark:border-wg-dark-border" />
                                    {OTHER_COUNTRIES.map(renderOption)}
                                </>
                            )
                        }
                    </div>
                </div>
            )}
        </div>
    )
}
