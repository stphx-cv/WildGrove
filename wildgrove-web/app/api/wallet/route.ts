// ══════════════════════════════════════════════════════════════════
// GET /api/wallet — PEN + USD balances for authenticated user
// Auto-creates wallets on first access via WalletService
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { createClient } from "@wildgrove/core/clients/server"
import { WalletService } from "@wildgrove/core/wallet/WalletService"

export async function GET() {
  try {
    const insforge = await createClient()
    const {
      data: { user },
    } = await insforge.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const [pen, usd] = await Promise.all([
      WalletService.getBalance(user.id, "PEN"),
      WalletService.getBalance(user.id, "USD"),
    ])

    return NextResponse.json({
      success: true,
      data: {
        PEN: { balance: pen.toFixed(2) },
        USD: { balance: usd.toFixed(2) },
      },
    })
  } catch (error) {
    console.error("[wallet GET]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
