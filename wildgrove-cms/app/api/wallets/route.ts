// ══════════════════════════════════════════════════════════════════
// Admin Wallets API — GET /api/wallets
// Paginated list of profiles with PEN and USD wallet balances
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { walletListQuerySchema } from "@wildgrove/core/admin-validation"
import { Prisma } from "@wildgrove/db"

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const params = Object.fromEntries(request.nextUrl.searchParams)
        const query = walletListQuerySchema.parse(params)

        // Phase G2 — list all registered customers (and ADMIN profiles for OWNER), not only profiles that already have Wallet rows.
        const isOwner = auth.role === "OWNER"
        // OWNER sees customers, staff (ADMIN), and other OWNER profiles (including self); ADMIN sees customers only.
        const where: Prisma.ProfileWhereInput = {
            role: isOwner ? { in: ["CUSTOMER", "ADMIN", "OWNER"] } : "CUSTOMER",
        }

        if (query.search) {
            where.OR = [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { username: { contains: query.search, mode: "insensitive" } },
            ]
        }

        if (query.currency) {
            where.wallets = { some: { currency: query.currency } }
        }

        const skip = (query.page - 1) * query.limit

        const [profiles, total] = await Promise.all([
            prisma.profile.findMany({
                where,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    wallets: {
                        select: {
                            currency: true,
                            balance: true,
                            updatedAt: true,
                            isActive: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: query.limit,
            }),
            prisma.profile.count({ where }),
        ])

        const items = profiles.map((p) => {
            const pen = p.wallets.find((w) => w.currency === "PEN")
            const usd = p.wallets.find((w) => w.currency === "USD")
            const lastActivity = [pen?.updatedAt, usd?.updatedAt]
                .filter(Boolean)
                .sort((a, b) => (b! > a! ? 1 : -1))[0] ?? null

            return {
                id: p.id,
                profileId: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
                avatarUrl: p.avatarUrl,
                balancePEN: pen ? pen.balance.toFixed(2) : null,
                balanceUSD: usd ? usd.balance.toFixed(2) : null,
                lastActivity: lastActivity?.toISOString() ?? null,
            }
        })

        return NextResponse.json({
            success: true,
            data: {
                items,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                },
            },
        })
    } catch (error) {
        console.error("[admin/wallets GET]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch wallets" }, { status: 500 })
    }
}
