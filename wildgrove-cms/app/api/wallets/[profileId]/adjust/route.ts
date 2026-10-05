// ══════════════════════════════════════════════════════════════════
// Admin Wallet Adjust — POST /api/wallets/[profileId]/adjust
// OWNER only: add or deduct balance from a user's wallet
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { adjustWalletSchema } from "@wildgrove/core/admin-validation"
import { WalletService, WalletInsufficientFundsError } from "@wildgrove/core/wallet/WalletService"
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
        return NextResponse.json({ success: false, error: "Only the owner can adjust wallets." }, { status: 403 })
    }

    const { profileId } = await params

    try {
        const body = await request.json()
        const parsed = adjustWalletSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            )
        }

        const { currency, delta, note } = parsed.data

        const tx = await WalletService.adjust({
            profileId,
            currency,
            delta: new Prisma.Decimal(delta),
            performedById: auth.userId,
            note,
        })

        return NextResponse.json({
            success: true,
            data: {
                id: tx.id,
                amount: tx.amount.toFixed(2),
                balanceAfter: tx.balanceAfter.toFixed(2),
                direction: tx.direction,
                currency,
                createdAt: tx.createdAt,
            },
        })
    } catch (error) {
        if (error instanceof WalletInsufficientFundsError) {
            return NextResponse.json(
                { success: false, error: `Insufficient balance: available ${error.available.toFixed(2)} ${error.currency}` },
                { status: 422 }
            )
        }
        console.error("[admin/wallets/adjust POST]", error)
        const msg = error instanceof Error ? error.message : "Failed to adjust wallet"
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
