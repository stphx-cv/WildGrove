// ══════════════════════════════════════════════════════════════════
// Account Recovery Phone
// PATCH — Add a recovery phone (saved directly, nothing to verify)
// DELETE — Remove a specific recovery phone from the list
// ══════════════════════════════════════════════════════════════════

import { createClient } from "@wildgrove/core/clients/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import { PHONE_REGEX } from "@wildgrove/core/validation"

export async function PATCH(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { phone } = await request.json()

    if (!phone || typeof phone !== "string" || !PHONE_REGEX.test(phone)) {
        return NextResponse.json({ error: "Invalid phone number." }, { status: 400 })
    }

    const normalized = phone.replace(/\s/g, "")

    // Check if it matches the user's primary phone
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { phoneCountryCode: true, phoneNumber: true, recoveryPhones: true },
    })

    const primaryPhone = profile?.phoneCountryCode && profile?.phoneNumber
        ? `+${profile.phoneCountryCode}${profile.phoneNumber}`
        : null

    if (primaryPhone && normalized === primaryPhone) {
        return NextResponse.json({ error: "Recovery phone cannot be the same as your primary phone." }, { status: 400 })
    }

    // Check if already in the list
    if (profile?.recoveryPhones.includes(normalized)) {
        return NextResponse.json({ error: "This phone is already a recovery phone." }, { status: 400 })
    }

    const updated = [...(profile?.recoveryPhones ?? []), normalized]

    await prisma.profile.update({
        where: { id: user.id },
        data: { recoveryPhones: updated },
    })

    return NextResponse.json({ success: true, recoveryPhones: updated })
}

export async function DELETE(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { phone } = await request.json()

    if (!phone) {
        return NextResponse.json({ error: "Phone is required." }, { status: 400 })
    }

    const normalized = phone.replace(/\s/g, "")

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { recoveryPhones: true },
    })

    const updated = (profile?.recoveryPhones ?? []).filter(p => p !== normalized)

    await prisma.profile.update({
        where: { id: user.id },
        data: { recoveryPhones: updated },
    })

    return NextResponse.json({ success: true, recoveryPhones: updated })
}
