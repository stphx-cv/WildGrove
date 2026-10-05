import { NextResponse, NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@wildgrove/db"
import { getProductsCustomersData } from "@/lib/admin/dashboard-queries"
import { getLimaDayBounds } from "@wildgrove/core/app-datetime-format"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = req.nextUrl
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    let from: Date
    let to: Date

    if (fromParam && toParam) {
        from = new Date(fromParam)
        to = new Date(toParam)
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
        }
    } else {
        const bounds = getLimaDayBounds()
        from = bounds.start
        to = bounds.end
    }

    const settings = await prisma.appSettings.findUnique({
        where: { key: "global" },
        select: { dashboardLowStockThreshold: true },
    })

    const data = await getProductsCustomersData(
        { from, to },
        settings?.dashboardLowStockThreshold ?? 5
    )
    return NextResponse.json(data)
}
