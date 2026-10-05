// ══════════════════════════════════════════════════════════════════
// /api/addresses
//
// GET  — list all addresses for the authenticated user
// POST — create a new address
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { Prisma } from "@wildgrove/db"
import { z } from "zod/v4"

const MAX_ADDRESSES = 10

const createAddressSchema = z.object({
  label: z.string().max(40).optional().nullable(),
  recipientName: z.string().max(80).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  fullAddress: z.string().min(5).max(255),
  detail: z.string().max(140).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  country: z.string().max(60).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  province: z.string().max(80).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
})

// ── GET ───────────────────────────────────────────────────────────

export async function GET() {
  const insforge = await createClient()
  const {
    data: { user },
  } = await insforge.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    )
  }

  try {
    const addresses = await prisma.userAddress.findMany({
      where: { profileId: user.id },
      select: {
        id: true,
        label: true,
        recipientName: true,
        phone: true,
        fullAddress: true,
        detail: true,
        lat: true,
        lng: true,
        country: true,
        region: true,
        province: true,
        district: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })

    // Serialize Decimal fields to numbers
    const serialized = addresses.map((a) => ({
      ...a,
      lat: a.lat ? Number(a.lat) : null,
      lng: a.lng ? Number(a.lng) : null,
    }))

    return NextResponse.json({ success: true, data: serialized })
  } catch (err) {
    console.error("[GET /api/addresses]", err)
    return NextResponse.json(
      { success: false, error: "Failed to fetch addresses" },
      { status: 500 },
    )
  }
}

// ── POST ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const insforge = await createClient()
  const {
    data: { user },
  } = await insforge.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    )
  }

  const parsed = createAddressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 422 },
    )
  }

  const {
    label, recipientName, phone, fullAddress, detail,
    lat, lng, country, region, province, district, isDefault,
  } = parsed.data

  try {
    // Enforce address limit
    const count = await prisma.userAddress.count({
      where: { profileId: user.id },
    })
    if (count >= MAX_ADDRESSES) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_ADDRESSES} addresses allowed` },
        { status: 422 },
      )
    }

    const address = await prisma.$transaction(async (tx) => {
      // If this is set as default, unset all others first
      if (isDefault) {
        await tx.userAddress.updateMany({
          where: { profileId: user.id },
          data: { isDefault: false },
        })
      }

      return tx.userAddress.create({
        data: {
          profileId: user.id,
          label: label ?? null,
          recipientName: recipientName ?? null,
          phone: phone ?? null,
          fullAddress,
          detail: detail ?? null,
          lat: lat != null ? new Prisma.Decimal(lat) : null,
          lng: lng != null ? new Prisma.Decimal(lng) : null,
          country: country ?? null,
          region: region ?? null,
          province: province ?? null,
          district: district ?? null,
          isDefault: isDefault ?? false,
        },
        select: {
          id: true,
          label: true,
          recipientName: true,
          phone: true,
          fullAddress: true,
          detail: true,
          lat: true,
          lng: true,
          country: true,
          region: true,
          province: true,
          district: true,
          isDefault: true,
          createdAt: true,
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        ...address,
        lat: address.lat ? Number(address.lat) : null,
        lng: address.lng ? Number(address.lng) : null,
      },
    })
  } catch (err) {
    console.error("[POST /api/addresses]", err)
    return NextResponse.json(
      { success: false, error: "Failed to create address" },
      { status: 500 },
    )
  }
}
