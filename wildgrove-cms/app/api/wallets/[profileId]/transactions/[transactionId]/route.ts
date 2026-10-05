// ══════════════════════════════════════════════════════════════════
// Admin Wallet — DELETE single ledger row
// OWNER only. Removes WalletTransaction only; Wallet.balance unchanged.
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { WalletService } from "@wildgrove/core/wallet/WalletService"

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ profileId: string; transactionId: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }
    if (auth.role !== "OWNER") {
        return NextResponse.json({ success: false, error: "Only the owner can delete ledger entries." }, { status: 403 })
    }

    const { profileId, transactionId } = await params

    if (!transactionId?.trim()) {
        return NextResponse.json({ success: false, error: "Invalid transaction id." }, { status: 400 })
    }

    try {
        const deleted = await WalletService.deleteLedgerTransaction(profileId, transactionId)
        if (!deleted) {
            return NextResponse.json({ success: false, error: "Transaction not found." }, { status: 404 })
        }
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[admin/wallets/transactions/[transactionId] DELETE]", error)
        const msg = error instanceof Error ? error.message : "Failed to delete transaction"
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
