"use client"

// ══════════════════════════════════════════════════════════════════
// AddressAutocomplete
//
// Input with real-time dropdown of Google Places suggestions.
// Uses useMapsLibrary("places") from @vis.gl/react-google-maps
// (same pattern as DeliveryZoneForm's AreaSearchBar) — requires
// an <APIProvider> ancestor in the tree.
//
// Props:
//   value          — current text displayed in the input
//   onAddressSelect — called with the full resolved PlaceDetails
//   placeholder / label / disabled / className
// ══════════════════════════════════════════════════════════════════

import { createPortal } from "react-dom"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useMapsLibrary } from "./maps"

export interface PlaceDetails {
  placeId: string
  fullAddress: string
  lat: number | null
  lng: number | null
  country: string | null
  region: string | null
  province: string | null
  district: string | null
}

interface AddressAutocompleteProps {
  value?: string
  onAddressSelect: (details: PlaceDetails) => void
  /** Fired on every keystroke — use to sync free-text edits when the user does not pick a suggestion. */
  onInputChange?: (text: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export function AddressAutocomplete({
  value = "",
  onAddressSelect,
  onInputChange,
  placeholder = "Search address…",
  label,
  disabled = false,
  className = "",
  required = false,
}: AddressAutocompleteProps) {
  const id = useId()
  const placesLib = useMapsLibrary("places")
  const [query, setQuery] = useState(value)
  const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize session token once the Places library is ready
  useEffect(() => {
    if (placesLib) sessionRef.current = new placesLib.AutocompleteSessionToken()
  }, [placesLib])

  // Sync external value changes (e.g. when editing a saved address)
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Position the portal dropdown below the input — recalculated on scroll/resize
  // so it follows the input even inside overflow:auto/hidden containers (e.g. modals).
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updateDropdownPosition()
    window.addEventListener("scroll", updateDropdownPosition, true)
    window.addEventListener("resize", updateDropdownPosition)
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true)
      window.removeEventListener("resize", updateDropdownPosition)
    }
  }, [isOpen, updateDropdownPosition])

  const fetchPredictions = useCallback(
    async (q: string) => {
      if (!placesLib || q.length < 2) {
        setPredictions([])
        setIsOpen(false)
        return
      }

      setIsLoading(true)
      try {
        const { suggestions } =
          await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sessionRef.current ?? undefined,
            includedRegionCodes: ["pe"],
          })
        const preds = suggestions
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => p !== null)
        setPredictions(preds)
        setIsOpen(preds.length > 0)
        setActiveIdx(-1)
      } catch {
        // silent — leave predictions empty
      } finally {
        setIsLoading(false)
      }
    },
    [placesLib],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    onInputChange?.(q)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => fetchPredictions(q), 300)
  }

  const handleSelect = useCallback(
    async (prediction: google.maps.places.PlacePrediction) => {
      setQuery(prediction.text.text)
      setIsOpen(false)
      setPredictions([])
      setIsLoading(true)

      try {
        const place = prediction.toPlace()
        await place.fetchFields({ fields: ["addressComponents", "location"] })

        const components = place.addressComponents ?? []
        const get = (...types: string[]) =>
          types.reduce<string>(
            (found, t) =>
              found || (components.find((c) => c.types.includes(t))?.longText ?? ""),
            "",
          )

        onAddressSelect({
          placeId: prediction.placeId,
          fullAddress: prediction.text.text,
          lat: place.location?.lat() ?? null,
          lng: place.location?.lng() ?? null,
          country: get("country") || null,
          region: get("administrative_area_level_1") || null,
          province: get("administrative_area_level_2") || null,
          district: get("locality", "sublocality_level_1", "sublocality") || null,
        })

        // Rotate session token after a completed billable session
        if (placesLib) sessionRef.current = new placesLib.AutocompleteSessionToken()
      } catch {
        // silent — text stays in input so user can retry
      } finally {
        setIsLoading(false)
      }
    },
    [placesLib, onAddressSelect],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, predictions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault()
      void handleSelect(predictions[activeIdx])
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const listboxId = `${id}-listbox`
  const isDisabled = disabled || !placesLib

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIdx >= 0 ? `${listboxId}-${activeIdx}` : undefined}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          disabled={isDisabled}
          required={required}
          autoComplete="off"
          className={[
            "w-full px-4 py-2.5 pr-10 rounded-brand border",
            "bg-wg-bg dark:bg-wg-dark-bg",
            "text-wg-text dark:text-wg-dark-text",
            "border-wg-border dark:border-wg-dark-border",
            "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50",
            "focus:outline-none focus:ring-2 focus:ring-wg-primary/30 dark:focus:ring-wg-dark-primary/30",
            "focus:border-wg-primary dark:focus:border-wg-dark-primary",
            "transition-colors text-sm",
            isDisabled ? "opacity-50 cursor-not-allowed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {/* Loading / search icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-wg-muted/60 dark:text-wg-dark-muted/60 pointer-events-none">
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Predictions dropdown — rendered via portal to escape overflow:hidden/auto parents */}
      {isOpen &&
        predictions.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Address suggestions"
            style={dropdownStyle}
            className={[
              "py-1",
              "bg-wg-surface dark:bg-wg-dark-surface",
              "border border-wg-border dark:border-wg-dark-border",
              "rounded-brand shadow-elevated",
              "max-h-56 overflow-y-auto",
            ].join(" ")}
          >
            {predictions.map((p, idx) => (
              <li
                key={p.placeId}
                id={`${listboxId}-${idx}`}
                role="option"
                aria-selected={idx === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault() // prevent blur before click
                  void handleSelect(p)
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={[
                  "flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                  idx === activeIdx
                    ? "bg-wg-primary/10 dark:bg-wg-dark-primary/10"
                    : "hover:bg-wg-primary/5 dark:hover:bg-wg-dark-primary/5",
                ].join(" ")}
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0 text-wg-muted dark:text-wg-dark-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">
                    {p.mainText?.text}
                  </span>
                  {p.secondaryText?.text && (
                    <span className="block text-xs text-wg-muted dark:text-wg-dark-muted truncate mt-0.5">
                      {p.secondaryText.text}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
