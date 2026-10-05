// ══════════════════════════════════════════════════════════════════
// Admin Wallet Set Balance — POST /api/wallets/[profileId]/set-balance
// OWNER only: set wallet to an exact balance (ADJUST_SET)
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { setWalletBalanceSchema } from "@wildgrove/core/admin-validation"
import { WalletService } from "@wildgrove/core/wallet/WalletService"
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
        return NextResponse.json({ success: false, error: "Only the owner can set wallet balances." }, { status: 403 })
    }

    const { profileId } = await params

    try {
        const body = await request.json()
        const parsed = setWalletBalanceSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            )
        }

        const { currency, balance, note } = parsed.data

        const tx = await WalletService.setBalance({
            profileId,
            currency,
            targetBalance: new Prisma.Decimal(balance),
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
        if (error instanceof Error && error.message === "Balance is already at this amount.") {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 })
        }
        const msg = error instanceof Error ? error.message : "Failed to set wallet balance"
        console.error("[admin/wallets/set-balance POST]", error)
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
