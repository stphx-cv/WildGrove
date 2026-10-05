"use client"

// ══════════════════════════════════════════════════════════════════
// ContactAddressField
//
// Settings → Contact → Address: Google Places search + draggable map
// pin, synced bidirectionally (same UX as delivery address picker).
// Persists only the address string; map coords are ephemeral UI state.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { APIProvider, useMapsLibrary } from "@wildgrove/ui/places/maps"
import { AddressAutocomplete, type PlaceDetails } from "@wildgrove/ui/places/AddressAutocomplete"
import { MapPicker } from "@wildgrove/ui/places/MapPicker"

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

const DEFAULT_CENTER = { lat: -12.046374, lng: -77.042793 } as const

const FALLBACK_INPUT_CLASS =
  "h-9 px-3 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50 disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-xl"

interface ContactAddressFieldProps {
  value: string
  onChange: (address: string) => void
  disabled?: boolean
}

function forwardGeocode(
  geocoder: google.maps.Geocoder,
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    geocoder.geocode({ address, region: "pe" }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location
        resolve({ lat: loc.lat(), lng: loc.lng() })
        return
      }
      resolve(null)
    })
  })
}

function reverseGeocode(
  geocoder: google.maps.Geocoder,
  lat: number,
  lng: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results?.[0]?.formatted_address) {
        resolve(results[0].formatted_address)
        return
      }
      resolve(null)
    })
  })
}

function ContactAddressFieldInner({ value, onChange, disabled = false }: ContactAddressFieldProps) {
  const mapsLib = useMapsLibrary("maps")
  const [pinLat, setPinLat] = useState<number | null>(null)
  const [pinLng, setPinLng] = useState<number | null>(null)
  const lastSyncedAddressRef = useRef("")
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!mapsLib) return

    const trimmed = value.trim()
    if (!trimmed) {
      // Nothing to geocode. `pin` below already reads as null while the address
      // is empty, so the map is right either way; the coordinates are dropped
      // as well so that an address arriving later cannot briefly show the old
      // location. Through the timer, not straight from the effect body, which
      // is what React's set-state-in-effect rule is about.
      lastSyncedAddressRef.current = ""
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
      geocodeTimerRef.current = setTimeout(() => {
        setPinLat(null)
        setPinLng(null)
      }, 0)
      return
    }

    if (trimmed === lastSyncedAddressRef.current) return

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    const requestAddress = trimmed
    geocodeTimerRef.current = setTimeout(() => {
      const geocoder = new google.maps.Geocoder()
      void forwardGeocode(geocoder, requestAddress).then((coords) => {
        if (!coords || value.trim() !== requestAddress) return
        setPinLat(coords.lat)
        setPinLng(coords.lng)
        lastSyncedAddressRef.current = requestAddress
      })
    }, 500)

    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [mapsLib, value])

  // The pin belongs to the address: without one there is nothing to point at,
  // whatever coordinates happen to be left over from a previous search.
  const pin =
    value.trim() && pinLat != null && pinLng != null ? { lat: pinLat, lng: pinLng } : null
  const mapPin = pin ?? DEFAULT_CENTER

  const handlePlaceSelect = useCallback(
    (details: PlaceDetails) => {
      lastSyncedAddressRef.current = details.fullAddress
      onChange(details.fullAddress)
      if (details.lat != null && details.lng != null) {
        setPinLat(details.lat)
        setPinLng(details.lng)
      }
    },
    [onChange],
  )

  const handleInputChange = useCallback(
    (text: string) => {
      onChange(text)
      if (!text.trim()) {
        lastSyncedAddressRef.current = ""
        setPinLat(null)
        setPinLng(null)
      }
    },
    [onChange],
  )

  const handleMapDrag = useCallback(
    async (lat: number, lng: number) => {
      setPinLat(lat)
      setPinLng(lng)
      if (!mapsLib) return

      const geocoder = new google.maps.Geocoder()
      const address = await reverseGeocode(geocoder, lat, lng)
      if (address) {
        lastSyncedAddressRef.current = address
        onChange(address)
      }
    },
    [mapsLib, onChange],
  )

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Restaurant address</p>
        <AddressAutocomplete
          value={value}
          onAddressSelect={handlePlaceSelect}
          onInputChange={handleInputChange}
          placeholder="e.g. Av. Larco, Miraflores…"
          disabled={disabled}
        />
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-2">
          Search for a place or type the address. Drag the pin on the map to adjust the location.
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Map</p>
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-2">
          {pin != null
            ? "Drag the pin to fine-tune the restaurant location."
            : "Enter or search for an address to place the pin, or drag the pin on the map."}
        </p>
        <MapPicker
          withApiProvider={false}
          lat={mapPin.lat}
          lng={mapPin.lng}
          onChange={handleMapDrag}
          zoom={pin != null ? 16 : 12}
          className="h-64 w-full rounded-brand overflow-hidden border border-wg-border/50 dark:border-wg-dark-border"
        />
      </div>
    </div>
  )
}

export function ContactAddressField({ value, onChange, disabled = false }: ContactAddressFieldProps) {
  if (!MAPS_API_KEY) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">Restaurant address</p>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Av. Ejemplo 123, Lima, Peru"
          disabled={disabled}
          className={FALLBACK_INPUT_CLASS}
        />
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
          Set{" "}
          <span className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span> to enable map
          search and pin placement (same key as checkout delivery).
        </p>
      </div>
    )
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <ContactAddressFieldInner value={value} onChange={onChange} disabled={disabled} />
    </APIProvider>
  )
}
