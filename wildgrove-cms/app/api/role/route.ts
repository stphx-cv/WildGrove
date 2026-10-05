// ══════════════════════════════════════════════════════════════════
// Admin Role API — GET the authenticated admin's role
// /api/role
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    return NextResponse.json({ success: true, role: auth.role })
}
