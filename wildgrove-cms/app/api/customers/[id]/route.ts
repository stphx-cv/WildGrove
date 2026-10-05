// ══════════════════════════════════════════════════════════════════
// Admin Customer Detail API — GET + PATCH + DELETE
// /api/customers/[id]
//
// ADMIN: can edit name, username, phone
// OWNER: can edit everything + email + role + delete accounts
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import {
    ownerUpdateCustomerSchema,
    deleteCustomerSchema,
} from "@wildgrove/core/admin-validation"

function createAdminClient() {
    return createServiceClient()
}

const PROFILE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    username: true,
    email: true,
    recoveryEmails: true,
    recoveryPhones: true,
    phoneCountryCode: true,
    phoneNumber: true,
    avatarUrl: true,
    role: true,
    connections: true,
    createdAt: true,
    updatedAt: true,
    _count: {
        select: {
            reservations: true,
            chatSessions: true,
        },
    },
}

// ── GET — Full customer detail ──

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const profile = await prisma.profile.findUnique({
            where: { id },
            select: PROFILE_SELECT,
        })

        if (!profile) {
            return NextResponse.json(
                { success: false, error: "Customer not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                ...profile,
                reservationCount: profile._count.reservations,
                messageCount: profile._count.chatSessions,
                _count: undefined,
            },
        })
    } catch (error) {
        console.error("[Admin Customers GET/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch customer" },
            { status: 500 }
        )
    }
}

// ── PATCH — Update customer fields ──

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await request.json()

        // Always parse with owner schema (superset) — strip owner fields for ADMIN
        const parsed = ownerUpdateCustomerSchema.parse(body)

        // ADMIN cannot change email or role — ignore if present
        const isOwner = auth.role === "OWNER"
        const email = isOwner ? parsed.email : undefined
        const role = isOwner ? parsed.role : undefined

        // Verify customer exists
        const existing = await prisma.profile.findUnique({
            where: { id },
            select: { id: true, role: true, firstName: true, lastName: true, email: true },
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Customer not found" },
                { status: 404 }
            )
        }

        // OWNER accounts cannot be managed through this endpoint
        if (existing.role === "OWNER") {
            return NextResponse.json(
                { success: false, error: "Owner accounts cannot be edited here" },
                { status: 403 }
            )
        }

        // Username uniqueness check
        if (parsed.username) {
            const conflict = await prisma.profile.findUnique({
                where: { username: parsed.username },
                select: { id: true },
            })
            if (conflict && conflict.id !== id) {
                return NextResponse.json(
                    { success: false, error: "Username already taken" },
                    { status: 409 }
                )
            }
        }

        // Phone uniqueness check
        if (parsed.phoneCountryCode && parsed.phoneNumber) {
            const phoneConflict = await prisma.profile.findFirst({
                where: {
                    phoneCountryCode: parsed.phoneCountryCode,
                    phoneNumber: parsed.phoneNumber,
                    NOT: { id },
                },
                select: { id: true },
            })
            if (phoneConflict) {
                return NextResponse.json(
                    { success: false, error: "Phone number already linked to another account" },
                    { status: 409 }
                )
            }
        }

        // Email uniqueness check (OWNER only)
        if (email) {
            const emailConflict = await prisma.profile.findUnique({
                where: { email },
                select: { id: true },
            })
            if (emailConflict && emailConflict.id !== id) {
                return NextResponse.json(
                    { success: false, error: "Email already linked to another account" },
                    { status: 409 }
                )
            }
        }

        // Build Prisma update data
        const data: Record<string, unknown> = {}
        if (parsed.firstName !== undefined) data.firstName = parsed.firstName
        if (parsed.lastName !== undefined) data.lastName = parsed.lastName
        if (parsed.username !== undefined) data.username = parsed.username

        // Phone: handle clearing (both null) or setting
        if (parsed.phoneCountryCode !== undefined) data.phoneCountryCode = parsed.phoneCountryCode
        if (parsed.phoneNumber !== undefined) data.phoneNumber = parsed.phoneNumber

        // OWNER-only fields
        if (email !== undefined) data.email = email
        if (role !== undefined) data.role = role
        if (isOwner && parsed.recoveryEmails !== undefined) data.recoveryEmails = parsed.recoveryEmails
        if (isOwner && parsed.recoveryPhones !== undefined) data.recoveryPhones = parsed.recoveryPhones

        // Update Prisma Profile
        const updated = await prisma.profile.update({
            where: { id },
            data,
            select: PROFILE_SELECT,
        })

        // Recompute name if firstName or lastName changed
        if (parsed.firstName !== undefined || parsed.lastName !== undefined) {
            const fullName = [updated.firstName, updated.lastName].filter(Boolean).join(" ") || null
            await prisma.profile.update({
                where: { id },
                data: { name: fullName },
            })
        }

        // If email changed (OWNER), update InsForge Auth
        if (email && email !== existing.email) {
            try {
                const insforgeAdmin = createAdminClient()
                await insforgeAdmin.auth.admin.updateUserById(id, { email: parsed.email })
            } catch (err) {
                console.error("[Admin Customers PATCH] InsForge email update failed:", err)
                // Prisma update already succeeded — log but don't fail
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...updated,
                reservationCount: updated._count.reservations,
                messageCount: updated._count.chatSessions,
                _count: undefined,
            },
        })
    } catch (error) {
        // Prisma unique constraint violation
        if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
            return NextResponse.json(
                { success: false, error: "A unique constraint was violated" },
                { status: 409 }
            )
        }
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Customers PATCH/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update customer" },
            { status: 500 }
        )
    }
}

// ── DELETE — Delete customer account (OWNER only) ──

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    // Only OWNER can delete accounts
    if (auth.role !== "OWNER") {
        return NextResponse.json(
            { success: false, error: "Only owners can delete customer accounts" },
            { status: 403 }
        )
    }

    const { id } = await params

    try {
        const body = await request.json()
        const options = deleteCustomerSchema.parse(body)

        // Verify customer exists
        const profile = await prisma.profile.findUnique({
            where: { id },
            select: { id: true, role: true },
        })

        if (!profile) {
            return NextResponse.json(
                { success: false, error: "Customer not found" },
                { status: 404 }
            )
        }

        // OWNER accounts cannot be deleted through this endpoint
        if (profile.role === "OWNER") {
            return NextResponse.json(
                { success: false, error: "Owner accounts cannot be deleted here" },
                { status: 403 }
            )
        }

        // Prevent deleting yourself
        if (id === auth.userId) {
            return NextResponse.json(
                { success: false, error: "Cannot delete your own account" },
                { status: 400 }
            )
        }

        // Execute deletions in a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Handle chat sessions
            if (options.deleteChatSessions) {
                // Delete messages first (FK on ChatSession)
                const sessions = await tx.chatSession.findMany({
                    where: { profileId: id },
                    select: { id: true },
                })
                const sessionIds = sessions.map(s => s.id)
                if (sessionIds.length > 0) {
                    await tx.chatMessage.deleteMany({ where: { sessionId: { in: sessionIds } } })
                    await tx.chatSession.deleteMany({ where: { id: { in: sessionIds } } })
                }
            } else {
                // Unlink — set profileId to null
                await tx.chatSession.updateMany({
                    where: { profileId: id },
                    data: { profileId: null },
                })
            }

            // 2. Handle reservations
            if (options.deleteReservations) {
                // Delete discount applications referencing these reservations
                const reservations = await tx.reservation.findMany({
                    where: { profileId: id },
                    select: { id: true },
                })
                const reservationIds = reservations.map(r => r.id)
                if (reservationIds.length > 0) {
                    await tx.discountApplication.deleteMany({
                        where: { reservationId: { in: reservationIds } },
                    })
                    await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } })
                }
            } else {
                // Unlink — set profileId to null
                await tx.reservation.updateMany({
                    where: { profileId: id },
                    data: { profileId: null },
                })
            }

            // 3. Clean up discount applications linked to this profile
            await tx.discountApplication.deleteMany({ where: { profileId: id } })

            // 4. Clean up verification codes
            await tx.verificationCode.deleteMany({ where: { profileId: id } })

            // 5. Delete the wallet ledger. WalletTransaction references Wallet with ON DELETE
            // RESTRICT, so the wallets (which cascade with the profile) cannot go
            // while they hold movements. An account with orders still fails at
            // the profile delete and the whole transaction rolls back.
            await tx.walletTransaction.deleteMany({ where: { wallet: { profileId: id } } })

            // 6. Delete the profile
            await tx.profile.delete({ where: { id } })
        })

        // Delete user from InsForge Auth
        try {
            const insforgeAdmin = createAdminClient()
            await insforgeAdmin.auth.admin.deleteUser(id)
        } catch (err) {
            console.error("[Admin Customers DELETE] InsForge user deletion failed:", err)
            // Profile already deleted from Prisma — log but don't fail
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Invalid request body" },
                { status: 400 }
            )
        }
        console.error("[Admin Customers DELETE/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete customer" },
            { status: 500 }
        )
    }
}
