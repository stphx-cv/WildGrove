// ══════════════════════════════════════════════════════════════════
// Account Profile — PATCH to update firstName, lastName, username, phone
// Updates both Prisma Profile and InsForge user_metadata.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@wildgrove/core/clients/server'
import { prisma } from "@wildgrove/db"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { NAME_REGEX, USERNAME_REGEX, PHONE_REGEX } from '@wildgrove/core/validation'
import { parseE164 } from '@wildgrove/core/phone'
import { isUsernamePending } from '@wildgrove/core/insforge/auth-admin'
import { createAdminNotificationForAllAdmins } from '@wildgrove/core/admin-notifications'

export async function PATCH(request: NextRequest) {
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, username, phone } = body

    // Validate firstName
    if (firstName !== undefined) {
        if (!firstName.trim() || !NAME_REGEX.test(firstName.trim())) {
            return NextResponse.json(
                { error: 'Invalid first name. Only letters, spaces, hyphens, and apostrophes allowed.' },
                { status: 400 }
            )
        }
    }

    // Validate lastName
    if (lastName !== undefined) {
        if (!lastName.trim() || !NAME_REGEX.test(lastName.trim())) {
            return NextResponse.json(
                { error: 'Invalid last name. Only letters, spaces, hyphens, and apostrophes allowed.' },
                { status: 400 }
            )
        }
    }

    // Validate username
    if (username !== undefined) {
        const clean = username.trim().toLowerCase()
        if (clean.length < 3 || !USERNAME_REGEX.test(clean)) {
            return NextResponse.json(
                { error: 'Username must be at least 3 characters (letters, numbers, _, ., -).' },
                { status: 400 }
            )
        }
        // Uniqueness check (exclude current user)
        const existing = await prisma.profile.findUnique({
            where: { username: clean },
            select: { id: true },
        })
        if ((existing && existing.id !== user.id) || (!existing && (await isUsernamePending(clean)))) {
            return NextResponse.json({ error: 'Username already taken.' }, { status: 409 })
        }
    }

    // Validate phone — allow null/"" to clear, or a valid E.164 number
    if (phone !== undefined && phone !== null && phone !== '') {
        if (!PHONE_REGEX.test(phone)) {
            return NextResponse.json(
                { error: 'Invalid phone number. Must be in E.164 format (e.g. +51987654321).' },
                { status: 400 }
            )
        }
        // Parse E.164 into country code + local number
        const parsed = parseE164(phone)
        if (!parsed) {
            return NextResponse.json(
                { error: 'Phone number country code not supported.' },
                { status: 400 }
            )
        }
        // Uniqueness check (exclude current user)
        const existingPhone = await prisma.profile.findFirst({
            where: {
                phoneCountryCode: parsed.dialCode,
                phoneNumber: parsed.localNumber,
                NOT: { id: user.id },
            },
            select: { id: true },
        })
        if (existingPhone) {
            return NextResponse.json({ error: 'This phone number is already linked to another account.' }, { status: 409 })
        }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (firstName !== undefined) updateData.firstName = firstName.trim()
    if (lastName !== undefined) updateData.lastName = lastName.trim()
    if (username !== undefined) updateData.username = username.trim().toLowerCase()
    // Set phone: null/"" → clear both fields, otherwise split E.164 into parts
    if (phone !== undefined) {
        if (phone === null || phone === '') {
            updateData.phoneCountryCode = null
            updateData.phoneNumber = null
        } else {
            const parsed = parseE164(phone)
            updateData.phoneCountryCode = parsed?.dialCode ?? null
            updateData.phoneNumber = parsed?.localNumber ?? null
        }
    }

    // Update Profile in DB
    const updated = await prisma.profile.update({
        where: { id: user.id },
        data: updateData,
    })

    // Recompute name from final DB values (updated has both fields regardless of what was passed)
    if (firstName !== undefined || lastName !== undefined) {
        const fullName = [updated.firstName, updated.lastName].filter(Boolean).join(' ') || null
        await prisma.profile.update({ where: { id: user.id }, data: { name: fullName } })
        updated.name = fullName
    }

    // Keep InsForge user_metadata in sync
    await insforge.auth.updateUser({
        data: {
            first_name: updated.firstName,
            last_name: updated.lastName,
            username: updated.username,
            ...(phone !== undefined && {
                phone: phone === null || phone === '' ? null : phone,
            }),
        },
    })

    const changedFields: string[] = []
    if (firstName !== undefined || lastName !== undefined) changedFields.push("name")
    if (username !== undefined) changedFields.push("username")
    if (phone !== undefined) changedFields.push("phone")

    const displayName = updated.name || updated.firstName || updated.email || "A customer"
    const fieldsStr = changedFields.length > 0 ? ` (${changedFields.join(", ")})` : ""

    createAdminNotificationForAllAdmins({
        type: "PROFILE_UPDATED",
        entityType: "PROFILE",
        entityId: user.id,
        title: "Customer profile updated",
        message: `${displayName} updated their profile${fieldsStr}.`,
        href: `/customers/${user.id}`,
        metadata: { profileId: user.id, changedFields },
    }).catch((e) => console.error("[account/profile] Notification error:", e))

    return NextResponse.json({ success: true, profile: updated })
}
