// ══════════════════════════════════════════════════════════════════
// GET /api/wallet/transactions — paginated ledger for authenticated user
// Query params: currency (PEN|USD), page, perPage
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { WalletService } from "@wildgrove/core/wallet/WalletService"

export async function GET(request: Request) {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const currency = searchParams.get("currency") === "USD" ? "USD" : "PEN"
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)))

    const { transactions, total } = await WalletService.getLedger(user.id, currency, {
      page,
      perPage,
    })

    return NextResponse.json({
      success: true,
      data: {
        currency,
        transactions: transactions.map((t) => ({
          ...t,
          amount: t.amount.toFixed(2),
          balanceAfter: t.balanceAfter.toFixed(2),
        })),
        total,
        page,
        perPage,
      },
    })
  } catch (error) {
    console.error("[wallet/transactions GET]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
