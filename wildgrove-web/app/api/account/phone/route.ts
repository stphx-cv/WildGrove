// ══════════════════════════════════════════════════════════════════
// Account Phone — PATCH to change the primary phone
// The number is saved directly. Phone is contact data only: it is
// never a way to sign in, so there is nothing to verify.
// ══════════════════════════════════════════════════════════════════

import { createClient } from "@wildgrove/core/clients/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@wildgrove/db"
import { PHONE_REGEX } from "@wildgrove/core/validation"
import { parseE164 } from "@wildgrove/core/phone"

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

    // Check if it's the same as the current primary phone
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { phoneCountryCode: true, phoneNumber: true, recoveryPhones: true },
    })

    const currentPrimary = profile?.phoneCountryCode && profile?.phoneNumber
        ? `+${profile.phoneCountryCode}${profile.phoneNumber}`
        : null

    if (currentPrimary && normalized === currentPrimary) {
        return NextResponse.json({ error: "This is already your current phone number." }, { status: 400 })
    }

    // Block if the phone is already a recovery phone
    if (profile?.recoveryPhones.includes(normalized)) {
        return NextResponse.json({
            error: "This phone is already a recovery phone. Remove it first or use \"Make Primary\".",
        }, { status: 400 })
    }

    const parsed = parseE164(normalized)
    if (!parsed) {
        return NextResponse.json({ error: "Could not parse phone number." }, { status: 400 })
    }

    await prisma.profile.update({
        where: { id: user.id },
        data: {
            phoneCountryCode: parsed.dialCode,
            phoneNumber: parsed.localNumber,
        },
    })

    return NextResponse.json({
        success: true,
        phoneCountryCode: parsed.dialCode,
        phoneNumber: parsed.localNumber,
    })
}

export async function DELETE() {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.profile.update({
        where: { id: user.id },
        data: { phoneCountryCode: null, phoneNumber: null },
    })

    return NextResponse.json({ success: true })
}
