import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const count = await prisma.review.count({ where: { approved: false, hidden: false } })
        return NextResponse.json({ success: true, count })
    } catch {
        return NextResponse.json({ success: false, count: 0 })
    }
}
