"use client"

// ══════════════════════════════════════════════════════════════════
// MapPicker
//
// Interactive Google Map with a draggable pin for confirming /
// adjusting delivery location.
//
// Uses @vis.gl/react-google-maps which loads the Maps JS SDK via
// <APIProvider>. Key must be NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
//
// Dark mode: CSS filter (same pattern as Contact page iframe).
//
// Props:
//   lat / lng      — current pin position (controlled)
//   onChange       — called when pin is dragged
//   zoom           — default 16
//   className      — container class (height controlled from outside)
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "./maps"

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// ── Inner marker that uses the maps context ───────────────────────

function DraggableMarker({
  position,
  onChange,
}: {
  position: { lat: number; lng: number }
  onChange: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onChange(e.latLng.lat(), e.latLng.lng())
      }
      setDragging(false)
    },
    [onChange],
  )

  const handleDragStart = useCallback(() => setDragging(true), [])

  return (
    <AdvancedMarker
      ref={markerRef}
      position={position}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title="Drag to adjust your location"
    >
      {/* Custom pin */}
      <div
        className={[
          "relative transition-transform duration-150",
          dragging ? "scale-125" : "scale-100",
        ].join(" ")}
      >
        <div className="w-8 h-8 rounded-full bg-wg-accent dark:bg-wg-dark-accent border-2 border-white shadow-elevated flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-wg-accent dark:bg-wg-dark-accent rotate-45 shadow" />
      </div>
    </AdvancedMarker>
  )
}

// ── Map center sync when prop changes ─────────────────────────────

function MapCenterSync({ position }: { position: { lat: number; lng: number } }) {
  const map = useMap()
  const mapsLib = useMapsLibrary("core")
  const prevPos = useRef(position)

  useEffect(() => {
    if (!map || !mapsLib) return
    // Only pan if the position changed meaningfully (> ~50m)
    const prev = prevPos.current
    const deltaLat = Math.abs(position.lat - prev.lat)
    const deltaLng = Math.abs(position.lng - prev.lng)
    if (deltaLat > 0.0005 || deltaLng > 0.0005) {
      map.panTo(position)
      prevPos.current = position
    }
  }, [map, mapsLib, position])

  return null
}

// ── Main export ───────────────────────────────────────────────────

interface MapPickerProps {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  zoom?: number
  className?: string
  /** When false, render only the map — must be wrapped in a parent `<APIProvider>`. */
  withApiProvider?: boolean
}

export function MapPicker({
  lat,
  lng,
  onChange,
  zoom = 16,
  className = "h-56 w-full rounded-brand overflow-hidden border border-wg-border dark:border-wg-dark-border",
  withApiProvider = true,
}: MapPickerProps) {
  const position = { lat, lng }

  if (!API_KEY) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-wg-surface dark:bg-wg-dark-surface`}
      >
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
          Google Maps API key not configured
        </p>
      </div>
    )
  }

  const mapTree = (
    <Map
      defaultCenter={position}
      defaultZoom={zoom}
      mapId="wildgrove-map-picker"
      gestureHandling="cooperative"
      disableDefaultUI={false}
      zoomControl
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapCenterSync position={position} />
      <DraggableMarker position={position} onChange={onChange} />
    </Map>
  )

  return (
    <div
      className={[
        className,
        // Dark mode CSS filter — same pattern as Contact page
        "dark:[filter:invert(90%)_hue-rotate(180deg)_brightness(85%)_saturate(70%)]",
      ].join(" ")}
    >
      {withApiProvider ? <APIProvider apiKey={API_KEY}>{mapTree}</APIProvider> : mapTree}
    </div>
  )
}
