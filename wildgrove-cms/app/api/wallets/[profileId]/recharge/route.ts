// ══════════════════════════════════════════════════════════════════
// Admin Wallet Recharge — POST /api/wallets/[profileId]/recharge
// OWNER only: add balance to a user's wallet
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { rechargeWalletSchema } from "@wildgrove/core/admin-validation"
import { WalletService, WalletIdempotencyError } from "@wildgrove/core/wallet/WalletService"
import { Prisma } from "@wildgrove/db"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }
    if (auth.role !== "OWNER") {
        return NextResponse.json({ success: false, error: "Only the owner can recharge wallets." }, { status: 403 })
    }

    const { profileId } = await params

    try {
        const body = await request.json()
        const parsed = rechargeWalletSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            )
        }

        const { currency, amount, note, idempotencyKey } = parsed.data

        const tx = await WalletService.recharge({
            profileId,
            currency,
            amount: new Prisma.Decimal(amount),
            performedById: auth.userId,
            note,
            idempotencyKey,
        })

        return NextResponse.json({
            success: true,
            data: {
                id: tx.id,
                amount: tx.amount.toFixed(2),
                balanceAfter: tx.balanceAfter.toFixed(2),
                currency,
                createdAt: tx.createdAt,
            },
        })
    } catch (error) {
        if (error instanceof WalletIdempotencyError) {
            return NextResponse.json({ success: false, error: "This recharge was already processed." }, { status: 409 })
        }
        console.error("[admin/wallets/recharge POST]", error)
        const msg = error instanceof Error ? error.message : "Failed to recharge wallet"
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
