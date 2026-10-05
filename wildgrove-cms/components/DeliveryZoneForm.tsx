"use client"

// ══════════════════════════════════════════════════════════════════
// DeliveryZoneForm — Create / Edit a delivery zone
//
// Supports three zone types:
//  • AREA     — administrative text fields (country/region/province/district)
//  • POLYGON  — interactive drawing on Google Maps
//  • RADIUS   — draggable center pin + radius slider
//
// Reuses AdminSelect, AdminNumberInput, ConfirmDialog from admin kit.
// Maps via @vis.gl/react-google-maps (already installed).
// ══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    APIProvider,
    Map,
    AdvancedMarker,
    useMap,
    useMapsLibrary,
} from "@wildgrove/ui/places/maps"
import { AdminSelect } from "@/components/AdminSelect"
import { AdminNumberInput } from "@/components/AdminNumberInput"
import { Switch } from "@wildgrove/ui/Switch"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { MagnifyingGlassPlainIcon, MapPinSolidIcon, Spinner } from "@wildgrove/ui/icons"

// ─── Types ────────────────────────────────────────────────────────

type ZoneType = "AREA" | "POLYGON" | "RADIUS"
type GeoCoord = [number, number] // [lng, lat]

export interface DeliveryZoneFormData {
    id?: string
    name: string
    type: ZoneType
    /** String so AdminNumberInput can show partial decimals (e.g. "12.") while typing */
    fee: string
    feeUsd: string
    minOrder: string
    minOrderUsd: string
    estimatedMinutes: number
    active: boolean
    priority: number
    // AREA
    country: string
    region: string
    province: string
    district: string
    // POLYGON / RADIUS
    centerLat: number | null
    centerLng: number | null
    radiusMeters: number
    polygon: GeoCoord[] | null
}

interface DeliveryZoneFormProps {
    initialData?: Partial<DeliveryZoneFormData>
}

// ─── Defaults ─────────────────────────────────────────────────────

// Default map center — Lima, Peru
const DEFAULT_CENTER = { lat: -12.0464, lng: -77.0428 }
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

function emptyForm(): DeliveryZoneFormData {
    return {
        name: "",
        type: "AREA",
        fee: "0",
        feeUsd: "0",
        minOrder: "0",
        minOrderUsd: "0",
        estimatedMinutes: 45,
        active: true,
        priority: 0,
        country: "",
        region: "",
        province: "",
        district: "",
        centerLat: null,
        centerLng: null,
        radiusMeters: 2000,
        polygon: null,
    }
}

function coerceMoneyField(value: string | number | undefined, fallback: string): string {
    if (value === undefined || value === null) return fallback
    if (typeof value === "string") return value
    return String(value)
}

function mergeInitialForm(initial?: Partial<DeliveryZoneFormData>): DeliveryZoneFormData {
    const base = emptyForm()
    if (!initial) return base
    return {
        ...base,
        ...initial,
        centerLat: initial.centerLat ?? base.centerLat,
        centerLng: initial.centerLng ?? base.centerLng,
        polygon: initial.polygon ?? base.polygon,
        radiusMeters: initial.radiusMeters ?? base.radiusMeters,
        fee: coerceMoneyField(initial.fee as string | number | undefined, base.fee),
        feeUsd: coerceMoneyField(initial.feeUsd as string | number | undefined, base.feeUsd),
        minOrder: coerceMoneyField(initial.minOrder as string | number | undefined, base.minOrder),
        minOrderUsd: coerceMoneyField(initial.minOrderUsd as string | number | undefined, base.minOrderUsd),
    }
}

// ─── Shared input class ───────────────────────────────────────────

const inputCls =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border " +
    "bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text " +
    "focus:outline-none focus:ring-2 focus:ring-wg-accent/40 dark:focus:ring-wg-dark-accent/40 " +
    "placeholder:text-wg-muted dark:placeholder:text-wg-dark-muted transition-all"

// ─── Framing a saved zone ─────────────────────────────────────────
//
// The zone maps are uncontrolled (`defaultCenter` / `defaultZoom`), so
// reopening a saved zone dropped the editor on Lima at zoom 12 whatever
// the zone actually covered — a polygon drawn around one district was
// simply off screen. These frame the geometry on first load and then get
// out of the way: refitting on every change would fight the user
// mid-drag, or snap the map back each time the radius slider moves.

/** Past this, `fitBounds` on a small zone lands on an unreadable close-up. */
const MAX_FIT_ZOOM = 17
/** Pixels kept clear around the geometry. */
const FIT_PADDING = 48
/** Metres per degree of latitude — good enough to frame a circle. */
const METERS_PER_DEGREE = 111_320

function boundsFromCoords(coords: GeoCoord[] | null | undefined): google.maps.LatLngBoundsLiteral | null {
    if (!coords || coords.length === 0) return null
    let north = -90, south = 90, east = -180, west = 180
    for (const [lng, lat] of coords) {
        if (lat > north) north = lat
        if (lat < south) south = lat
        if (lng > east) east = lng
        if (lng < west) west = lng
    }
    return { north, south, east, west }
}

function boundsFromCircle(
    center: { lat: number; lng: number },
    radiusMeters: number,
): google.maps.LatLngBoundsLiteral {
    const latDelta = radiusMeters / METERS_PER_DEGREE
    // Degrees of longitude shrink towards the poles
    const lngDelta = radiusMeters / (METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180))
    return {
        north: center.lat + latDelta,
        south: center.lat - latDelta,
        east: center.lng + lngDelta,
        west: center.lng - lngDelta,
    }
}

/** Frames `bounds` the first time they exist, once per mount. */
function useFitBoundsOnce(bounds: google.maps.LatLngBoundsLiteral | null) {
    const map = useMap()
    const doneRef = useRef(false)

    useEffect(() => {
        if (!map || !bounds || doneRef.current) return
        doneRef.current = true

        map.fitBounds(bounds, FIT_PADDING)

        // A zone smaller than the viewport makes fitBounds zoom all the way in
        const listener = google.maps.event.addListenerOnce(map, "idle", () => {
            const zoom = map.getZoom()
            if (zoom != null && zoom > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM)
        })
        return () => listener.remove()
    }, [map, bounds])
}

// ─── Radius circle overlay (Google Maps) ──────────────────────────

function RadiusCircle({
    center,
    radiusMeters,
}: {
    center: { lat: number; lng: number }
    radiusMeters: number
}) {
    const map = useMap()
    const mapsLib = useMapsLibrary("maps")
    const circleRef = useRef<google.maps.Circle | null>(null)

    useEffect(() => {
        if (!map || !mapsLib) return
        if (!circleRef.current) {
            circleRef.current = new mapsLib.Circle({
                map,
                center,
                radius: radiusMeters,
                strokeColor: "#16a34a",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#16a34a",
                fillOpacity: 0.15,
            })
        } else {
            circleRef.current.setCenter(center)
            circleRef.current.setRadius(radiusMeters)
        }
        return () => {
            circleRef.current?.setMap(null)
            circleRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, mapsLib])

    useEffect(() => {
        circleRef.current?.setCenter(center)
    }, [center])

    useEffect(() => {
        circleRef.current?.setRadius(radiusMeters)
    }, [radiusMeters])

    return null
}

// ─── Polygon overlay (draw + edit) ────────────────────────────────
//
// Google removed google.maps.drawing.DrawingManager in Maps JS API
// v3.65 — the constructor now throws, and with no error boundary in
// the CMS that took the whole page down the moment "Draw polygon" was
// pressed. Drawing is implemented here instead: each map click appends
// a vertex, a live Polyline/Polygon previews the shape, and the ring is
// closed by clicking the first vertex or pressing "Finish".
//
// The draft lives in the parent so the toolbar (Finish / Undo / point
// count) can act on it — this component only renders it on the map.

const DRAW_STROKE = {
    strokeColor: "#16a34a",
    strokeOpacity: 0.9,
    strokeWeight: 2,
}

function PolygonDrawer({
    polygon,
    onChange,
    drawing,
    draft,
    onAddPoint,
    onFinish,
}: {
    polygon: GeoCoord[] | null
    onChange: (coords: GeoCoord[]) => void
    drawing: boolean
    draft: GeoCoord[]
    onAddPoint: (coord: GeoCoord) => void
    onFinish: () => void
}) {
    const map = useMap()
    const mapsLib = useMapsLibrary("maps")
    const polygonRef = useRef<google.maps.Polygon | null>(null)
    const draftShapeRef = useRef<google.maps.Polygon | google.maps.Polyline | null>(null)

    // Render the committed polygon (hidden while a new one is being drawn).
    // The dep on the first coord only is deliberate: syncPath feeds every
    // vertex drag back into `polygon`, and re-creating the overlay on each
    // of those would cancel the drag in progress.
    useEffect(() => {
        if (!map || !mapsLib || drawing || !polygon || polygon.length < 3) return

        const path = polygon.map(([lng, lat]) => ({ lat, lng }))
        polygonRef.current = new mapsLib.Polygon({
            map,
            paths: path,
            ...DRAW_STROKE,
            fillColor: "#16a34a",
            fillOpacity: 0.2,
            editable: true,
            draggable: false,
        })

        const syncPath = () => {
            const newPath = polygonRef.current?.getPath()
            if (!newPath) return
            const coords: GeoCoord[] = []
            newPath.forEach((latlng) => coords.push([latlng.lng(), latlng.lat()]))
            onChange(coords)
        }

        const pathObj = polygonRef.current.getPath()
        pathObj.addListener("set_at", syncPath)
        pathObj.addListener("insert_at", syncPath)
        pathObj.addListener("remove_at", syncPath)

        return () => {
            polygonRef.current?.setMap(null)
            polygonRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, mapsLib, drawing, JSON.stringify(polygon?.slice(0, 1))])

    // Crosshair while drawing, so the map reads as a canvas
    useEffect(() => {
        if (!map) return
        map.setOptions({ draggableCursor: drawing ? "crosshair" : null })
        return () => {
            map.setOptions({ draggableCursor: null })
        }
    }, [map, drawing])

    // Collect vertices. onAddPoint is stable, so the listener is attached once
    // per drawing session instead of on every point.
    useEffect(() => {
        if (!map || !drawing) return
        const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return
            onAddPoint([e.latLng.lng(), e.latLng.lat()])
        })
        return () => listener.remove()
    }, [map, drawing, onAddPoint])

    // Live preview of the draft ring — open path until it can be closed
    useEffect(() => {
        if (!map || !mapsLib || !drawing || draft.length < 2) return

        const path = draft.map(([lng, lat]) => ({ lat, lng }))
        draftShapeRef.current =
            draft.length >= 3
                ? new mapsLib.Polygon({
                      map,
                      paths: path,
                      ...DRAW_STROKE,
                      fillColor: "#16a34a",
                      fillOpacity: 0.15,
                      clickable: false,
                  })
                : new mapsLib.Polyline({ map, path, ...DRAW_STROKE, clickable: false })

        return () => {
            draftShapeRef.current?.setMap(null)
            draftShapeRef.current = null
        }
    }, [map, mapsLib, drawing, draft])

    if (!drawing) return null

    return (
        <>
            {draft.map(([lng, lat], i) => {
                const canClose = i === 0 && draft.length >= 3
                return (
                    <AdvancedMarker
                        key={`draft-${i}`}
                        position={{ lat, lng }}
                        anchorLeft="-50%"
                        anchorTop="-50%"
                        clickable={canClose}
                        onClick={canClose ? onFinish : undefined}
                        title={canClose ? "Close the polygon" : `Point ${i + 1}`}
                        zIndex={canClose ? 2 : 1}
                    >
                        <div
                            className={
                                canClose
                                    ? "w-4 h-4 rounded-full bg-white border-[3px] border-wg-accent shadow-elevated cursor-pointer"
                                    : "w-2.5 h-2.5 rounded-full bg-wg-accent border-2 border-white shadow-elevated"
                            }
                        />
                    </AdvancedMarker>
                )
            })}
        </>
    )
}

// ─── Draggable center marker (RADIUS) ─────────────────────────────

function CenterMarker({
    position,
    onChange,
}: {
    position: { lat: number; lng: number }
    onChange: (lat: number, lng: number) => void
}) {
    const handleDragEnd = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (e.latLng) onChange(e.latLng.lat(), e.latLng.lng())
        },
        [onChange],
    )

    return (
        <AdvancedMarker position={position} draggable onDragEnd={handleDragEnd} title="Drag to set center">
            <div className="w-7 h-7 rounded-full bg-wg-accent dark:bg-wg-dark-accent border-2 border-white shadow-elevated flex items-center justify-center">
                <MapPinSolidIcon className="w-3.5 h-3.5 text-white" />
            </div>
        </AdvancedMarker>
    )
}

// ─── Area search bar (auto-fills address fields) ─────────────────

type AreaResult = { country: string; region: string; province: string; district: string; lat: number | null; lng: number | null }

function AreaSearchBar({ onResult }: { onResult: (r: AreaResult) => void }) {
    const placesLib = useMapsLibrary("places")
    const [query, setQuery] = useState("")
    const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([])
    const [open, setOpen] = useState(false)
    const [fetching, setFetching] = useState(false)
    const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (placesLib) sessionRef.current = new placesLib.AutocompleteSessionToken()
    }, [placesLib])

    useEffect(() => {
        function close(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", close)
        return () => document.removeEventListener("mousedown", close)
    }, [])

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

    function handleChange(value: string) {
        setQuery(value)
        if (timerRef.current) clearTimeout(timerRef.current)
        if (value.length < 2) { setPredictions([]); setOpen(false); return }
        timerRef.current = setTimeout(async () => {
            if (!placesLib) return
            setFetching(true)
            try {
                const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input: value,
                    sessionToken: sessionRef.current ?? undefined,
                })
                const preds = suggestions
                    .map((s) => s.placePrediction)
                    .filter((p): p is google.maps.places.PlacePrediction => p !== null)
                setPredictions(preds)
                setOpen(preds.length > 0)
            } catch {
                setPredictions([])
            } finally {
                setFetching(false)
            }
        }, 300)
    }

    async function handleSelect(prediction: google.maps.places.PlacePrediction) {
        setQuery(prediction.text.text)
        setPredictions([])
        setOpen(false)
        try {
            const place = prediction.toPlace()
            await place.fetchFields({ fields: ["addressComponents", "location", "viewport"] })
            const components = place.addressComponents ?? []
            const get = (...types: string[]) =>
                types.reduce<string>((found, t) => found || (components.find((c) => c.types.includes(t))?.longText ?? ""), "")
            onResult({
                country: get("country"),
                region: get("administrative_area_level_1"),
                province: get("administrative_area_level_2"),
                district: get("locality", "sublocality_level_1", "sublocality"),
                lat: place.location?.lat() ?? null,
                lng: place.location?.lng() ?? null,
            })
            if (placesLib) sessionRef.current = new placesLib.AutocompleteSessionToken()
        } catch { /* ignore */ }
    }

    const fieldCls =
        "flex items-center gap-2 w-full px-3 py-2.5 rounded-brand border border-wg-border dark:border-wg-dark-border " +
        "bg-wg-bg dark:bg-wg-dark-bg"

    return (
        <div ref={wrapRef} className="relative sm:col-span-2">
            <label className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5">
                Search to auto-fill
            </label>
            <div className={fieldCls}>
                <MagnifyingGlassPlainIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted flex-shrink-0" strokeWidth={2} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={() => predictions.length > 0 && setOpen(true)}
                    placeholder="e.g. Miraflores, San Isidro…"
                    className="flex-1 min-w-0 text-sm bg-transparent text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted dark:placeholder:text-wg-dark-muted focus:outline-none"
                />
                {fetching && (
                    <Spinner className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted animate-spin flex-shrink-0" />
                )}
            </div>

            {open && predictions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-wg-surface dark:bg-wg-dark-raised border border-wg-border dark:border-wg-dark-border rounded-brand shadow-elevated overflow-hidden">
                    {predictions.map((p) => (
                        <button
                            key={p.placeId}
                            type="button"
                            onMouseDown={() => handleSelect(p)}
                            className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-wg-bg dark:hover:bg-wg-dark-bg border-b border-wg-border dark:border-wg-dark-border last:border-0 transition-colors"
                        >
                            <MapPinSolidIcon className="w-3.5 h-3.5 text-wg-muted dark:text-wg-dark-muted mt-0.5 flex-shrink-0" />
                            <span className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">{p.mainText?.text}</span>
                                <span className="text-xs text-wg-muted dark:text-wg-dark-muted truncate">{p.secondaryText?.text}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Locating a saved AREA zone ───────────────────────────────────
//
// AREA zones store administrative names, never coordinates, and the
// preview map only ever appeared after a search — reopening a saved zone
// showed no map at all. Geocoding the stored names once on mount gives a
// centre *and* a viewport, so a country frames as a country and a
// district as a district.

function AreaAutoLocate({
    country,
    region,
    province,
    district,
    enabled,
    onLocated,
}: {
    country: string
    region: string
    province: string
    district: string
    enabled: boolean
    onLocated: (
        center: { lat: number; lng: number },
        viewport: google.maps.LatLngBoundsLiteral | null,
    ) => void
}) {
    const geocodingLib = useMapsLibrary("geocoding")
    const doneRef = useRef(false)

    useEffect(() => {
        if (!geocodingLib || !enabled || doneRef.current) return

        // Most specific first — that is the order a geocoder reads an address
        const address = [district, province, region, country].filter(Boolean).join(", ")
        if (!address) return
        doneRef.current = true

        let cancelled = false
        new geocodingLib.Geocoder()
            .geocode({ address })
            .then(({ results }) => {
                const best = results[0]
                if (cancelled || !best) return
                const location = best.geometry.location
                const viewport = best.geometry.viewport
                onLocated(
                    { lat: location.lat(), lng: location.lng() },
                    viewport ? viewport.toJSON() : null,
                )
            })
            .catch(() => {
                // An area the geocoder does not recognise just leaves the map hidden,
                // exactly as it was before this ran
            })

        return () => {
            cancelled = true
        }
    }, [geocodingLib, enabled, country, region, province, district, onLocated])

    return null
}

// ─── Places search box ────────────────────────────────────────────

function PlacesSearchBox({ mapId, onPlaceSelect }: { mapId: string; onPlaceSelect?: (lat: number, lng: number) => void }) {
    const placesLib = useMapsLibrary("places")
    const map = useMap(mapId)
    const [query, setQuery] = useState("")
    const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([])
    const [open, setOpen] = useState(false)
    const [fetching, setFetching] = useState(false)
    const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (placesLib) sessionRef.current = new placesLib.AutocompleteSessionToken()
    }, [placesLib])

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

    function handleChange(value: string) {
        setQuery(value)
        if (timerRef.current) clearTimeout(timerRef.current)
        if (value.length < 2) { setPredictions([]); setOpen(false); return }
        timerRef.current = setTimeout(async () => {
            if (!placesLib) return
            setFetching(true)
            try {
                const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input: value,
                    sessionToken: sessionRef.current ?? undefined,
                })
                const preds = suggestions
                    .map((s) => s.placePrediction)
                    .filter((p): p is google.maps.places.PlacePrediction => p !== null)
                setPredictions(preds)
                setOpen(preds.length > 0)
            } catch {
                setPredictions([])
            } finally {
                setFetching(false)
            }
        }, 300)
    }

    async function handleSelect(prediction: google.maps.places.PlacePrediction) {
        setQuery(prediction.text.text)
        setPredictions([])
        setOpen(false)
        if (!map) return
        try {
            const place = prediction.toPlace()
            await place.fetchFields({ fields: ["location", "viewport"] })
            if (place.viewport) map.fitBounds(place.viewport)
            else if (place.location) { map.panTo(place.location); map.setZoom(14) }
            if (place.location) onPlaceSelect?.(place.location.lat(), place.location.lng())
            if (placesLib) sessionRef.current = new placesLib.AutocompleteSessionToken()
        } catch { /* ignore navigation errors */ }
    }

    return (
        <div ref={wrapRef} className="absolute top-3 left-3 right-3 z-10">
            <div className="flex items-center gap-2 bg-white dark:bg-wg-dark-raised border border-gray-200 dark:border-wg-dark-border rounded-brand shadow-elevated px-3 py-2">
                <MagnifyingGlassPlainIcon className="w-4 h-4 text-gray-400 dark:text-wg-dark-muted flex-shrink-0" strokeWidth={2} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={() => predictions.length > 0 && setOpen(true)}
                    placeholder="Search location…"
                    className="flex-1 min-w-0 text-sm bg-transparent text-gray-900 dark:text-wg-dark-text placeholder:text-gray-400 dark:placeholder:text-wg-dark-muted focus:outline-none"
                />
                {fetching && (
                    <Spinner className="w-4 h-4 text-gray-400 dark:text-wg-dark-muted animate-spin flex-shrink-0" />
                )}
            </div>

            {open && predictions.length > 0 && (
                <div className="mt-1 bg-white dark:bg-wg-dark-raised border border-gray-200 dark:border-wg-dark-border rounded-brand shadow-elevated overflow-hidden">
                    {predictions.map((p) => (
                        <button
                            key={p.placeId}
                            type="button"
                            onMouseDown={() => handleSelect(p)}
                            className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 dark:hover:bg-wg-dark-bg border-b border-gray-100 dark:border-wg-dark-border last:border-0 transition-colors"
                        >
                            <MapPinSolidIcon className="w-3.5 h-3.5 text-gray-400 dark:text-wg-dark-muted mt-0.5 flex-shrink-0" />
                            <span className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-wg-dark-text truncate">{p.mainText?.text}</span>
                                <span className="text-xs text-gray-500 dark:text-wg-dark-muted truncate">{p.secondaryText?.text}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Map container (POLYGON) ──────────────────────────────────────

function PolygonMapInner({
    polygon,
    onPolygonChange,
    drawing,
    draft,
    onAddPoint,
    onFinish,
}: {
    polygon: GeoCoord[] | null
    onPolygonChange: (coords: GeoCoord[]) => void
    drawing: boolean
    draft: GeoCoord[]
    onAddPoint: (coord: GeoCoord) => void
    onFinish: () => void
}) {
    useFitBoundsOnce(boundsFromCoords(polygon))

    return (
        <PolygonDrawer
            polygon={polygon}
            onChange={onPolygonChange}
            drawing={drawing}
            draft={draft}
            onAddPoint={onAddPoint}
            onFinish={onFinish}
        />
    )
}

// ─── Map container (RADIUS) ───────────────────────────────────────

function RadiusMapInner({
    center,
    radiusMeters,
    onCenterChange,
}: {
    center: { lat: number; lng: number }
    radiusMeters: number
    onCenterChange: (lat: number, lng: number) => void
}) {
    useFitBoundsOnce(boundsFromCircle(center, radiusMeters))

    return (
        <>
            <RadiusCircle center={center} radiusMeters={radiusMeters} />
            <CenterMarker position={center} onChange={onCenterChange} />
        </>
    )
}

// ─── Main Form ────────────────────────────────────────────────────

export function DeliveryZoneForm({ initialData }: DeliveryZoneFormProps) {
    const router = useRouter()
    const isEditing = !!initialData?.id

    const [form, setForm] = useState<DeliveryZoneFormData>(() =>
        mergeInitialForm({
            ...initialData,
            centerLat: initialData?.centerLat ?? null,
            centerLng: initialData?.centerLng ?? null,
            polygon: initialData?.polygon ?? null,
            radiusMeters: initialData?.radiusMeters ?? 2000,
        }),
    )
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDelete, setShowDelete] = useState(false)
    const [drawingPolygon, setDrawingPolygon] = useState(false)
    /** Vertices placed so far in the current drawing session (not yet committed to form.polygon) */
    const [polygonDraft, setPolygonDraft] = useState<GeoCoord[]>([])
    const [polygonSearchPin, setPolygonSearchPin] = useState<{ lat: number; lng: number } | null>(null)
    const [areaMapCenter, setAreaMapCenter] = useState<{ lat: number; lng: number } | null>(null)
    /** Geocoded extent of the AREA zone — a country frames wider than a district */
    const [areaMapViewport, setAreaMapViewport] = useState<google.maps.LatLngBoundsLiteral | null>(null)

    const set = useCallback(
        <K extends keyof DeliveryZoneFormData>(key: K, value: DeliveryZoneFormData[K]) => {
            setForm((prev) => ({ ...prev, [key]: value }))
            setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
        },
        [],
    )

    // ── Polygon drawing session ──
    // Mirrored in a ref so finishDrawing/cancel stay stable and can read the
    // latest draft without re-subscribing the map click listener.
    const polygonDraftRef = useRef<GeoCoord[]>([])
    useEffect(() => {
        polygonDraftRef.current = polygonDraft
    }, [polygonDraft])

    const startDrawingPolygon = useCallback(() => {
        setPolygonDraft([])
        setDrawingPolygon(true)
    }, [])

    const cancelDrawingPolygon = useCallback(() => {
        setDrawingPolygon(false)
        setPolygonDraft([])
    }, [])

    const addPolygonPoint = useCallback((coord: GeoCoord) => {
        setPolygonDraft((prev) => [...prev, coord])
    }, [])

    const undoPolygonPoint = useCallback(() => {
        setPolygonDraft((prev) => prev.slice(0, -1))
    }, [])

    const finishDrawingPolygon = useCallback(() => {
        const points = polygonDraftRef.current
        if (points.length < 3) return
        set("polygon", points)
        setDrawingPolygon(false)
        setPolygonDraft([])
    }, [set])

    const handleAreaLocated = useCallback(
        (center: { lat: number; lng: number }, viewport: google.maps.LatLngBoundsLiteral | null) => {
            setAreaMapCenter(center)
            setAreaMapViewport(viewport)
        },
        [],
    )

    // Switching zone type unmounts the map — don't leave a session hanging
    useEffect(() => {
        if (form.type !== "POLYGON" && drawingPolygon) cancelDrawingPolygon()
    }, [form.type, drawingPolygon, cancelDrawingPolygon])

    // Escape aborts the session — the map swallows most other keys
    useEffect(() => {
        if (!drawingPolygon) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") cancelDrawingPolygon()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [drawingPolygon, cancelDrawingPolygon])

    // AdminNumberInput works with strings
    const numStr = (v: number | null | undefined) => (v == null ? "" : String(v))
    const setNum = useCallback(
        <K extends keyof DeliveryZoneFormData>(key: K, raw: string) => {
            const n = parseInt(raw, 10)
            set(key, (isNaN(n) ? 0 : n) as DeliveryZoneFormData[K])
        },
        [set],
    )

    const mapCenter =
        form.centerLat != null && form.centerLng != null
            ? { lat: form.centerLat, lng: form.centerLng }
            : DEFAULT_CENTER

    // ── Validate ──

    function validate(): boolean {
        const errs: Record<string, string> = {}
        if (!form.name.trim()) errs.name = "Name is required"
        const feeNum = parseFloat(form.fee)
        const feeUsdNum = parseFloat(form.feeUsd)
        if (Number.isNaN(feeNum) || feeNum < 0) errs.fee = "Enter a valid fee (≥ 0)"
        if (Number.isNaN(feeUsdNum) || feeUsdNum < 0) errs.feeUsd = "Enter a valid fee in USD (≥ 0)"
        if (form.type === "AREA" && !form.country && !form.region && !form.province && !form.district) {
            errs.country = "At least one area field is required"
        }
        if (form.type === "RADIUS") {
            if (form.centerLat == null || form.centerLng == null) errs.centerLat = "Place the center pin on the map"
            if (!form.radiusMeters || form.radiusMeters < 100) errs.radiusMeters = "Radius must be at least 100 m"
        }
        if (form.type === "POLYGON" && (!form.polygon || form.polygon.length < 3)) {
            errs.polygon = "Draw a polygon with at least 3 points"
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    // ── Save ──

    async function handleSave() {
        if (!validate()) return
        setIsSaving(true)
        try {
            const body = {
                name: form.name,
                type: form.type,
                fee: parseFloat(form.fee) || 0,
                feeUsd: parseFloat(form.feeUsd) || 0,
                minOrder: parseFloat(form.minOrder) || 0,
                minOrderUsd: parseFloat(form.minOrderUsd) || 0,
                estimatedMinutes: form.estimatedMinutes,
                active: form.active,
                priority: form.priority,
                country: form.country || null,
                region: form.region || null,
                province: form.province || null,
                district: form.district || null,
                centerLat: form.centerLat,
                centerLng: form.centerLng,
                radiusMeters: form.type === "RADIUS" ? form.radiusMeters : null,
                polygon: form.type === "POLYGON" ? form.polygon : null,
            }

            const url = isEditing
                ? `/api/delivery-zones/${initialData!.id}`
                : "/api/delivery-zones"
            const method = isEditing ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const json = await res.json()
            if (!res.ok) {
                setErrors({ _form: json.error ?? "Save failed" })
                return
            }
            router.push("/delivery-zones")
            router.refresh()
        } catch {
            setErrors({ _form: "Network error — please try again" })
        } finally {
            setIsSaving(false)
        }
    }

    // ── Delete ──

    async function handleDelete() {
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/delivery-zones/${initialData!.id}`, { method: "DELETE" })
            if (res.ok) {
                router.push("/delivery-zones")
                router.refresh()
            } else {
                setErrors({ _form: "Delete failed" })
            }
        } catch {
            setErrors({ _form: "Network error — please try again" })
        } finally {
            setIsDeleting(false)
            setShowDelete(false)
        }
    }

    // ─── Render ───────────────────────────────────────────────────

    const labelCls = "block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5"
    const errCls = "text-xs text-red-500 mt-1"
    const sectionCls = "bg-wg-surface dark:bg-wg-dark-raised rounded-card shadow-card p-5 space-y-4"

    return (
        <div className="space-y-6">
            {/* ── Basic info ── */}
            <div className={sectionCls}>
                <h2 className="font-display font-semibold text-base text-wg-text dark:text-wg-dark-text">
                    Zone details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Zone name *</label>
                        <input
                            className={inputCls}
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="e.g. Miraflores, San Isidro"
                        />
                        {errors.name && <p className={errCls}>{errors.name}</p>}
                    </div>

                    {/* Type */}
                    <div>
                        <label className={labelCls}>Zone type *</label>
                        <AdminSelect
                            value={form.type}
                            onChange={(v) => set("type", v as ZoneType)}
                            required
                            options={[
                                { value: "AREA", label: "Area (administrative)", hint: "Match by district / province / region" },
                                { value: "POLYGON", label: "Polygon (draw on map)", hint: "Custom shape drawn on the map" },
                                { value: "RADIUS", label: "Radius (distance)", hint: "Circle from a center point" },
                            ]}
                        />
                    </div>

                    {/* Priority */}
                    <div>
                        <label className={labelCls}>Priority</label>
                        <AdminNumberInput
                            value={numStr(form.priority)}
                            onChange={(v) => setNum("priority", v)}
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0"
                        />
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">Higher wins when zones overlap</p>
                    </div>

                    {/* ETA */}
                    <div>
                        <label className={labelCls}>Estimated delivery (minutes) *</label>
                        <AdminNumberInput
                            value={numStr(form.estimatedMinutes)}
                            onChange={(v) => setNum("estimatedMinutes", v)}
                            min={1}
                            max={480}
                            step={5}
                            placeholder="45"
                        />
                    </div>

                    {/* Active */}
                    <div className="flex items-center gap-3 pt-5">
                        <Switch
                            checked={form.active}
                            onChange={(next) => set("active", next)}
                            label={form.active ? "Deactivate zone" : "Activate zone"}
                        />
                        <span className="text-sm text-wg-text dark:text-wg-dark-text">
                            {form.active ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Fees & minimums ── */}
            <div className={sectionCls}>
                <h2 className="font-display font-semibold text-base text-wg-text dark:text-wg-dark-text">
                    Fees &amp; minimums
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <label className={labelCls}>Fee (PEN) *</label>
                        <AdminNumberInput
                            value={form.fee}
                            onChange={(v) => set("fee", v)}
                            min={0}
                            step={0.5}
                            decimals={2}
                            placeholder="0.00"
                            prefix="S/"
                            nullable={false}
                        />
                        {errors.fee && <p className={errCls}>{errors.fee}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Fee (USD) *</label>
                        <AdminNumberInput
                            value={form.feeUsd}
                            onChange={(v) => set("feeUsd", v)}
                            min={0}
                            step={0.5}
                            decimals={2}
                            placeholder="0.00"
                            prefix="$"
                            nullable={false}
                        />
                        {errors.feeUsd && <p className={errCls}>{errors.feeUsd}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Min order (PEN)</label>
                        <AdminNumberInput
                            value={form.minOrder}
                            onChange={(v) => set("minOrder", v)}
                            min={0}
                            step={1}
                            decimals={2}
                            placeholder="0.00"
                            prefix="S/"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Min order (USD)</label>
                        <AdminNumberInput
                            value={form.minOrderUsd}
                            onChange={(v) => set("minOrderUsd", v)}
                            min={0}
                            step={1}
                            decimals={2}
                            placeholder="0.00"
                            prefix="$"
                        />
                    </div>
                </div>
            </div>

            {/* ── Zone configuration ── */}
            <div className={sectionCls}>
                <h2 className="font-display font-semibold text-base text-wg-text dark:text-wg-dark-text">
                    Zone boundaries
                </h2>

                {/* AREA */}
                {form.type === "AREA" && (
                    <div className="space-y-4">
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted -mt-2">
                            Leave fields blank to match any value at that level. More specific entries take priority.
                        </p>

                        {/* Search + preview map */}
                        {API_KEY && (
                            <APIProvider apiKey={API_KEY}>
                                <AreaAutoLocate
                                    country={form.country}
                                    region={form.region}
                                    province={form.province}
                                    district={form.district}
                                    enabled={!areaMapCenter}
                                    onLocated={handleAreaLocated}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <AreaSearchBar
                                        onResult={(r) => {
                                            if (r.country) set("country", r.country)
                                            if (r.region) set("region", r.region)
                                            if (r.province) set("province", r.province)
                                            if (r.district) set("district", r.district)
                                            setAreaMapCenter(r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null)
                                            setAreaMapViewport(null)
                                        }}
                                    />
                                </div>
                                {areaMapCenter && (
                                    <div
                                        key={`${areaMapCenter.lat},${areaMapCenter.lng}`}
                                        className="h-48 rounded-brand overflow-hidden border border-wg-border dark:border-wg-dark-border dark:[filter:invert(90%)_hue-rotate(180deg)_brightness(85%)_saturate(70%)]"
                                    >
                                        <Map
                                            id="wg-area"
                                            {...(areaMapViewport
                                                ? { defaultBounds: { ...areaMapViewport, padding: FIT_PADDING } }
                                                : { defaultCenter: areaMapCenter, defaultZoom: 14 })}
                                            mapId="wg-zone-area"
                                            gestureHandling="cooperative"
                                            disableDefaultUI={false}
                                            zoomControl
                                            streetViewControl={false}
                                            mapTypeControl={false}
                                            fullscreenControl={false}
                                            style={{ width: "100%", height: "100%" }}
                                        >
                                            <AdvancedMarker position={areaMapCenter} title="Ubicación referencial">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-8 h-8 rounded-full bg-violet-500 border-2 border-white shadow-elevated flex items-center justify-center">
                                                        <MapPinSolidIcon className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="w-0.5 h-2 bg-violet-500" />
                                                </div>
                                            </AdvancedMarker>
                                        </Map>
                                    </div>
                                )}
                            </APIProvider>
                        )}

                        {/* Editable fields (pre-filled by search, still adjustable) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(["country", "region", "province", "district"] as const).map((field) => (
                                <div key={field}>
                                    <label className={labelCls}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                                    <input
                                        className={inputCls}
                                        value={form[field]}
                                        onChange={(e) => set(field, e.target.value)}
                                        placeholder={field === "country" ? "e.g. Peru" : field === "region" ? "e.g. Lima" : field === "province" ? "e.g. Lima" : "e.g. Miraflores"}
                                    />
                                </div>
                            ))}
                            {errors.country && <p className={`${errCls} sm:col-span-2`}>{errors.country}</p>}
                        </div>
                    </div>
                )}

                {/* RADIUS */}
                {form.type === "RADIUS" && (
                    <div className="space-y-4">
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                            Click the map to set the center, then adjust the radius.
                        </p>
                        {errors.centerLat && <p className={errCls}>{errors.centerLat}</p>}

                        {/* Radius slider */}
                        <div>
                            <label className={labelCls}>
                                Radius:{" "}
                                <span className="text-wg-accent dark:text-wg-dark-accent font-semibold">
                                    {form.radiusMeters >= 1000
                                        ? `${(form.radiusMeters / 1000).toFixed(1)} km`
                                        : `${form.radiusMeters} m`}
                                </span>
                            </label>
                            <input
                                type="range"
                                min={100}
                                max={50000}
                                step={100}
                                value={form.radiusMeters}
                                onChange={(e) => set("radiusMeters", parseInt(e.target.value, 10))}
                                className="w-full accent-wg-accent dark:accent-wg-dark-accent"
                            />
                            <div className="flex justify-between text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
                                <span>100 m</span>
                                <span>50 km</span>
                            </div>
                            {errors.radiusMeters && <p className={errCls}>{errors.radiusMeters}</p>}
                        </div>

                        {/* Radius map */}
                        {API_KEY ? (
                            <APIProvider apiKey={API_KEY}>
                                <div className="relative">
                                    <PlacesSearchBox
                                        mapId="wg-radius"
                                        onPlaceSelect={(lat, lng) => { set("centerLat", lat); set("centerLng", lng) }}
                                    />
                                    <div className="h-72 rounded-brand overflow-hidden border border-wg-border dark:border-wg-dark-border dark:[filter:invert(90%)_hue-rotate(180deg)_brightness(85%)_saturate(70%)]">
                                        <Map
                                            id="wg-radius"
                                            defaultCenter={mapCenter}
                                            defaultZoom={13}
                                            mapId="wg-zone-radius"
                                            gestureHandling="cooperative"
                                            disableDefaultUI={false}
                                            zoomControl
                                            streetViewControl={false}
                                            mapTypeControl={false}
                                            fullscreenControl={false}
                                            onClick={(e) => {
                                                if (e.detail.latLng) {
                                                    set("centerLat", e.detail.latLng.lat)
                                                    set("centerLng", e.detail.latLng.lng)
                                                }
                                            }}
                                            style={{ width: "100%", height: "100%" }}
                                        >
                                            {form.centerLat != null && form.centerLng != null && (
                                                <RadiusMapInner
                                                    center={{ lat: form.centerLat, lng: form.centerLng }}
                                                    radiusMeters={form.radiusMeters}
                                                    onCenterChange={(lat, lng) => { set("centerLat", lat); set("centerLng", lng) }}
                                                />
                                            )}
                                        </Map>
                                    </div>
                                </div>
                            </APIProvider>
                        ) : (
                            <div className="h-20 flex items-center justify-center rounded-brand border border-wg-border dark:border-wg-dark-border">
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">Google Maps API key not configured</p>
                            </div>
                        )}

                        {form.centerLat != null && (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                                Center: {form.centerLat.toFixed(6)}, {form.centerLng?.toFixed(6)}
                            </p>
                        )}
                    </div>
                )}

                {/* POLYGON */}
                {form.type === "POLYGON" && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {!drawingPolygon ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={startDrawingPolygon}
                                        className="px-3.5 py-2 text-sm rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white font-medium transition-all hover:scale-[1.02]"
                                    >
                                        {form.polygon ? "Redraw polygon" : "Draw polygon"}
                                    </button>
                                    {form.polygon && (
                                        <button
                                            type="button"
                                            onClick={() => set("polygon", null)}
                                            className="px-3.5 py-2 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-red-500 transition-colors"
                                        >
                                            Clear polygon
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={finishDrawingPolygon}
                                        disabled={polygonDraft.length < 3}
                                        className="px-3.5 py-2 text-sm rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        Finish polygon
                                    </button>
                                    <button
                                        type="button"
                                        onClick={undoPolygonPoint}
                                        disabled={polygonDraft.length === 0}
                                        className="px-3.5 py-2 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted disabled:opacity-50 disabled:pointer-events-none transition-colors"
                                    >
                                        Undo point
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelDrawingPolygon}
                                        className="px-3.5 py-2 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-red-500 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                                        {polygonDraft.length < 3
                                            ? `Click on the map to place points — ${polygonDraft.length} of 3 minimum`
                                            : `${polygonDraft.length} points — click the first point or "Finish polygon" to close. Esc cancels.`}
                                    </p>
                                </>
                            )}
                        </div>

                        {errors.polygon && <p className={errCls}>{errors.polygon}</p>}

                        {API_KEY ? (
                            <APIProvider apiKey={API_KEY}>
                                <div className="relative">
                                    <PlacesSearchBox
                                        mapId="wg-polygon"
                                        onPlaceSelect={(lat, lng) => setPolygonSearchPin({ lat, lng })}
                                    />
                                    <div className="h-80 rounded-brand overflow-hidden border border-wg-border dark:border-wg-dark-border dark:[filter:invert(90%)_hue-rotate(180deg)_brightness(85%)_saturate(70%)]">
                                        <Map
                                            id="wg-polygon"
                                            defaultCenter={DEFAULT_CENTER}
                                            defaultZoom={12}
                                            mapId="wg-zone-polygon"
                                            gestureHandling="cooperative"
                                            disableDefaultUI={false}
                                            zoomControl
                                            streetViewControl={false}
                                            mapTypeControl={false}
                                            fullscreenControl={false}
                                            style={{ width: "100%", height: "100%" }}
                                        >
                                            <PolygonMapInner
                                                polygon={form.polygon}
                                                onPolygonChange={(coords) => set("polygon", coords)}
                                                drawing={drawingPolygon}
                                                draft={polygonDraft}
                                                onAddPoint={addPolygonPoint}
                                                onFinish={finishDrawingPolygon}
                                            />
                                            {polygonSearchPin && !form.polygon && (
                                                <AdvancedMarker position={polygonSearchPin} title="Lugar buscado">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-elevated flex items-center justify-center">
                                                            <MapPinSolidIcon className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="w-0.5 h-2 bg-blue-500" />
                                                    </div>
                                                </AdvancedMarker>
                                            )}
                                        </Map>
                                    </div>
                                </div>
                            </APIProvider>
                        ) : (
                            <div className="h-20 flex items-center justify-center rounded-brand border border-wg-border dark:border-wg-dark-border">
                                <p className="text-sm text-wg-muted dark:text-wg-dark-muted">Google Maps API key not configured</p>
                            </div>
                        )}

                        {form.polygon && (
                            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                                Polygon: {form.polygon.length} point{form.polygon.length !== 1 ? "s" : ""}. Drag vertices to adjust.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Form error ── */}
            {errors._form && (
                <div className="rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {errors._form}
                </div>
            )}

            {/* ── Actions ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
                >
                    {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create zone"}
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/delivery-zones")}
                    className="px-5 py-2.5 rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text text-sm font-medium hover:bg-wg-surface dark:hover:bg-wg-dark-raised transition-colors"
                >
                    Cancel
                </button>
                {isEditing && (
                    <button
                        type="button"
                        onClick={() => setShowDelete(true)}
                        className="ml-auto px-5 py-2.5 rounded-brand border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        Delete zone
                    </button>
                )}
            </div>

            {/* ── Delete confirm ── */}
            <ConfirmDialog
                isOpen={showDelete}
                title="Delete delivery zone"
                message={`Are you sure you want to delete "${form.name}"? This cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={handleDelete}
                onClose={() => setShowDelete(false)}
            />
        </div>
    )
}
