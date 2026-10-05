// ══════════════════════════════════════════════════════════════════
// GET /api/reservations/history
// Returns the authenticated user's reservations, newest first.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { prisma } from "@wildgrove/db"
import type { ApiResponse } from "@wildgrove/core/types"

export async function GET() {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()

        if (!user) {
            const response: ApiResponse = { success: false, error: "Unauthorized" }
            return NextResponse.json(response, { status: 401 })
        }

        const reservations = await prisma.reservation.findMany({
            where: { profileId: user.id, hiddenByUser: false },
            orderBy: { date: "desc" },
            select: {
                id: true,
                date: true,
                partySize: true,
                notes: true,
                nickname: true,
                status: true,
                createdAt: true,
                review: { select: { id: true } },
            },
        })

        const data = reservations.map(({ review, ...r }) => ({
            ...r,
            hasReview: !!review,
        }))

        const response: ApiResponse = { success: true, data }
        return NextResponse.json(response)
    } catch (error) {
        console.error("[reservations/history]", error)
        const response: ApiResponse = { success: false, error: "Internal server error" }
        return NextResponse.json(response, { status: 500 })
    }
}
