// ══════════════════════════════════════════════════════════════════
// ZoneResolver — matches a delivery address to a DeliveryZone
//
// Three zone types:
//  • AREA     — matched by administrative fields (district > province > region)
//  • POLYGON  — ray-casting point-in-polygon on GeoJSON coordinates
//  • RADIUS   — haversine distance <= radiusMeters
//
// When multiple zones match, the one with highest priority wins.
// When none match, the address has no delivery: resolveZone throws ZoneNotFoundError.
// ══════════════════════════════════════════════════════════════════

import { Prisma } from "@wildgrove/db"
import { prisma } from "@wildgrove/db"

// ─── Types ────────────────────────────────────────────────────────

export interface AddressComponents {
  district?: string | null
  province?: string | null
  region?: string | null
  country?: string | null
}

export interface ResolveZoneInput {
  lat?: number | null
  lng?: number | null
  components?: AddressComponents
}

export interface ResolvedZone {
  id: string
  name: string
  type: string
  fee: Prisma.Decimal
  feeUsd: Prisma.Decimal
  minOrder: Prisma.Decimal
  minOrderUsd: Prisma.Decimal
  estimatedMinutes: number
  priority: number
}

export class ZoneNotFoundError extends Error {
  constructor() {
    super('No delivery zone covers this address')
    this.name = 'ZoneNotFoundError'
  }
}

export class MinOrderNotMetError extends Error {
  constructor(
    public readonly minOrder: Prisma.Decimal,
    public readonly subtotal: Prisma.Decimal,
    public readonly currency: string,
  ) {
    super(
      `Minimum order for this zone is ${currency === 'USD' ? '$' : 'S/'}${minOrder.toFixed(2)}`,
    )
    this.name = 'MinOrderNotMetError'
  }
}

// ─── GeoJSON coordinate pair ──────────────────────────────────────

type GeoCoord = [number, number] // [lng, lat]

// ─── Haversine distance (meters) ──────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000 // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Ray-casting point-in-polygon ────────────────────────────────

function pointInPolygon(lat: number, lng: number, polygon: GeoCoord[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// ─── Resolver ─────────────────────────────────────────────────────

const ZONE_SELECT = {
  id: true,
  name: true,
  type: true,
  fee: true,
  feeUsd: true,
  minOrder: true,
  minOrderUsd: true,
  estimatedMinutes: true,
  priority: true,
  centerLat: true,
  centerLng: true,
  radiusMeters: true,
  polygon: true,
  country: true,
  region: true,
  province: true,
  district: true,
} as const

export const ZoneResolver = {
  /**
   * Resolves the best delivery zone for the given address.
   * Throws ZoneNotFoundError when no active DeliveryZone covers it.
   */
  async resolveZone(input: ResolveZoneInput): Promise<ResolvedZone> {
    const zones = await prisma.deliveryZone.findMany({
      where: { active: true },
      select: ZONE_SELECT,
      orderBy: { priority: 'desc' },
    })

    const { lat, lng, components = {} } = input
    const matches: (typeof zones)[number][] = []

    for (const zone of zones) {
      if (zone.type === 'AREA') {
        const match = matchArea(zone, components)
        if (match) matches.push(zone)
      } else if (zone.type === 'RADIUS') {
        if (lat != null && lng != null && zone.centerLat != null && zone.centerLng != null) {
          const dist = haversineMeters(
            lat,
            lng,
            Number(zone.centerLat),
            Number(zone.centerLng),
          )
          if (zone.radiusMeters != null && dist <= zone.radiusMeters) {
            matches.push(zone)
          }
        }
      } else if (zone.type === 'POLYGON') {
        if (lat != null && lng != null && zone.polygon != null) {
          const coords = parsePolygon(zone.polygon)
          if (coords && pointInPolygon(lat, lng, coords)) {
            matches.push(zone)
          }
        }
      }
    }

    if (matches.length === 0) throw new ZoneNotFoundError()

    // Highest priority wins; already ordered by priority desc
    const best = matches[0]

    return {
      id: best.id,
      name: best.name,
      type: best.type,
      fee: best.fee,
      feeUsd: best.feeUsd,
      minOrder: best.minOrder,
      minOrderUsd: best.minOrderUsd,
      estimatedMinutes: best.estimatedMinutes,
      priority: best.priority,
    }
  },

  /**
   * Validate the order subtotal meets the zone's minimum.
   */
  validateMinOrder(zone: ResolvedZone, currency: string, subtotal: Prisma.Decimal) {
    const minOrder = currency === 'USD' ? zone.minOrderUsd : zone.minOrder
    if (subtotal.lt(minOrder)) {
      throw new MinOrderNotMetError(minOrder, subtotal, currency)
    }
  },

  /**
   * Get the delivery fee for a zone in the given currency.
   */
  getFee(zone: ResolvedZone, currency: string): Prisma.Decimal {
    return currency === 'USD' ? zone.feeUsd : zone.fee
  },
}

// ─── Helpers ──────────────────────────────────────────────────────

type ZoneRow = {
  district: string | null
  province: string | null
  region: string | null
  country: string | null
}

function matchArea(zone: ZoneRow, components: AddressComponents): boolean {
  // Match from most specific to least specific
  // A zone with district set requires district to match
  // A zone without district matches any district in that province
  const cmp = (a: string | null | undefined, b: string | null | undefined) =>
    !a || a.toLowerCase() === (b ?? '').toLowerCase()

  return (
    cmp(zone.country, components.country) &&
    cmp(zone.region, components.region) &&
    cmp(zone.province, components.province) &&
    cmp(zone.district, components.district)
  )
}

function parsePolygon(raw: unknown): GeoCoord[] | null {
  try {
    if (Array.isArray(raw)) return raw as GeoCoord[]
    if (typeof raw === 'object' && raw !== null) {
      const geo = raw as { coordinates?: unknown; type?: string }
      if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
        return (geo.coordinates[0] ?? []) as GeoCoord[]
      }
      if (geo.type === 'Feature') {
        const inner = geo as { geometry?: { type?: string; coordinates?: unknown } }
        if (inner.geometry?.type === 'Polygon' && Array.isArray(inner.geometry.coordinates)) {
          return (inner.geometry.coordinates[0] ?? []) as GeoCoord[]
        }
      }
    }
    return null
  } catch {
    return null
  }
}
