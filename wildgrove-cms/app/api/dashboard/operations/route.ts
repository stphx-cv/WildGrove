import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@wildgrove/db"
import { getOperationsData } from "@/lib/admin/dashboard-queries"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const settings = await prisma.appSettings.findUnique({
        where: { key: "global" },
        select: { dashboardKitchenAlertMinutes: true, dashboardPickupAlertMinutes: true },
    })

    const data = await getOperationsData({
        kitchenAlertMinutes: settings?.dashboardKitchenAlertMinutes ?? 20,
        pickupAlertMinutes: settings?.dashboardPickupAlertMinutes ?? 10,
    })

    return NextResponse.json(data)
}
