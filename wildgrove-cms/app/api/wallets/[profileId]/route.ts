// ══════════════════════════════════════════════════════════════════
// Admin Wallet Detail API — GET /api/wallets/[profileId]
// Returns profile info + both wallets (PEN/USD) + paginated ledger
// ADMIN: read-only  |  OWNER: read + can recharge/adjust
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { walletLedgerQuerySchema } from "@wildgrove/core/admin-validation"
import { WalletService } from "@wildgrove/core/wallet/WalletService"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { profileId } = await params

    try {
        const query = walletLedgerQuerySchema.parse(
            Object.fromEntries(request.nextUrl.searchParams)
        )
        const currency = query.currency ?? "PEN"

        const profile = await prisma.profile.findUnique({
            where: { id: profileId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                role: true,
                createdAt: true,
                wallets: {
                    select: {
                        id: true,
                        currency: true,
                        balance: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        })

        if (!profile) {
            return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
        }

        const ledgerData =
            currency === "ALL"
                ? await WalletService.getMergedLedger(profileId, {
                      page: query.page,
                      perPage: query.limit,
                  })
                : await WalletService.getLedger(profileId, currency, {
                      page: query.page,
                      perPage: query.limit,
                  })

        const pen = profile.wallets.find((w) => w.currency === "PEN") ?? null
        const usd = profile.wallets.find((w) => w.currency === "USD") ?? null

        // Resolve performer names for transactions
        const performerIds = [
            ...new Set(
                ledgerData.transactions
                    .map((t) => t.performedById)
                    .filter((id): id is string => id != null)
            ),
        ]

        const performers = performerIds.length
            ? await prisma.profile.findMany({
                where: { id: { in: performerIds } },
                select: { id: true, firstName: true, lastName: true, email: true },
            })
            : []
        const performerMap = Object.fromEntries(performers.map((p) => [p.id, p]))

        const transactions = ledgerData.transactions.map((t) => {
            const rowCurrency =
                "currency" in t && typeof t.currency === "string" ? t.currency : currency
            return {
                id: t.id,
                type: t.type,
                direction: t.direction,
                amount: t.amount.toFixed(2),
                balanceAfter: t.balanceAfter.toFixed(2),
                reference: t.reference,
                note: t.note,
                createdAt: t.createdAt.toISOString(),
                currency: rowCurrency,
                performer: t.performedById ? (performerMap[t.performedById] ?? null) : null,
            }
        })

        return NextResponse.json({
            success: true,
            data: {
                profile: {
                    id: profile.id,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    email: profile.email,
                    avatarUrl: profile.avatarUrl,
                    role: profile.role,
                    createdAt: profile.createdAt,
                },
                wallets: {
                    PEN: pen
                        ? { ...pen, balance: pen.balance.toFixed(2) }
                        : null,
                    USD: usd
                        ? { ...usd, balance: usd.balance.toFixed(2) }
                        : null,
                },
                ledger: {
                    currency,
                    transactions,
                    pagination: {
                        page: query.page,
                        limit: query.limit,
                        total: ledgerData.total,
                        totalPages: Math.ceil(ledgerData.total / query.limit),
                    },
                },
            },
        })
    } catch (error) {
        console.error("[admin/wallets/[profileId] GET]", error)
        return NextResponse.json({ success: false, error: "Failed to fetch wallet" }, { status: 500 })
    }
}
