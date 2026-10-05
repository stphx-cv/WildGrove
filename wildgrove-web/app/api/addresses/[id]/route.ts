// ══════════════════════════════════════════════════════════════════
// /api/addresses/[id]
//
// PATCH  — update a specific address
// DELETE — delete a specific address
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import { Prisma } from "@wildgrove/db"
import { z } from "zod/v4"

const updateAddressSchema = z.object({
  label: z.string().max(40).optional().nullable(),
  recipientName: z.string().max(80).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  fullAddress: z.string().min(5).max(255).optional(),
  detail: z.string().max(140).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  country: z.string().max(60).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  province: z.string().max(80).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  isDefault: z.boolean().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

// ── Ownership check ───────────────────────────────────────────────

async function getOwnedAddress(userId: string, addressId: string) {
  return prisma.userAddress.findFirst({
    where: { id: addressId, profileId: userId },
    select: { id: true, isDefault: true },
  })
}

// ── PATCH ─────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

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

  const existing = await getOwnedAddress(user.id, id)
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Address not found" },
      { status: 404 },
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

  const parsed = updateAddressSchema.safeParse(body)
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
    const address = await prisma.$transaction(async (tx) => {
      // If setting as default, unset others first
      if (isDefault === true) {
        await tx.userAddress.updateMany({
          where: { profileId: user.id },
          data: { isDefault: false },
        })
      }

      const updateData: Prisma.UserAddressUpdateInput = {}
      if (label !== undefined) updateData.label = label
      if (recipientName !== undefined) updateData.recipientName = recipientName
      if (phone !== undefined) updateData.phone = phone
      if (fullAddress !== undefined) updateData.fullAddress = fullAddress
      if (detail !== undefined) updateData.detail = detail
      if (lat !== undefined) updateData.lat = lat != null ? new Prisma.Decimal(lat) : null
      if (lng !== undefined) updateData.lng = lng != null ? new Prisma.Decimal(lng) : null
      if (country !== undefined) updateData.country = country
      if (region !== undefined) updateData.region = region
      if (province !== undefined) updateData.province = province
      if (district !== undefined) updateData.district = district
      if (isDefault !== undefined) updateData.isDefault = isDefault

      return tx.userAddress.update({
        where: { id },
        data: updateData,
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
    console.error("[PATCH /api/addresses/[id]]", err)
    return NextResponse.json(
      { success: false, error: "Failed to update address" },
      { status: 500 },
    )
  }
}

// ── DELETE ────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params

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

  const existing = await getOwnedAddress(user.id, id)
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Address not found" },
      { status: 404 },
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userAddress.delete({ where: { id } })

      // If the deleted address was the default, promote the oldest remaining
      if (existing.isDefault) {
        const oldest = await tx.userAddress.findFirst({
          where: { profileId: user.id },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
        if (oldest) {
          await tx.userAddress.update({
            where: { id: oldest.id },
            data: { isDefault: true },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/addresses/[id]]", err)
    return NextResponse.json(
      { success: false, error: "Failed to delete address" },
      { status: 500 },
    )
  }
}
