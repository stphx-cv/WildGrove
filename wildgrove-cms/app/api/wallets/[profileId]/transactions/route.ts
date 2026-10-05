// ══════════════════════════════════════════════════════════════════
// Admin Wallet — DELETE all ledger rows for profile (PEN + USD)
// OWNER only. Removes WalletTransaction rows only; Wallet.balance unchanged.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { WalletService } from "@wildgrove/core/wallet/WalletService"

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }
    if (auth.role !== "OWNER") {
        return NextResponse.json({ success: false, error: "Only the owner can clear ledger history." }, { status: 403 })
    }

    const { profileId } = await params

    try {
        const deleted = await WalletService.deleteAllLedgerTransactions(profileId)
        return NextResponse.json({ success: true, data: { deleted } })
    } catch (error) {
        console.error("[admin/wallets/transactions DELETE]", error)
        const msg = error instanceof Error ? error.message : "Failed to clear ledger"
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
