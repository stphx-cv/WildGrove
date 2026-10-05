// ══════════════════════════════════════════════════════════════════
// Edit Delivery Zone — /delivery-zones/[id]
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@wildgrove/db"
import { DeliveryZoneForm, type DeliveryZoneFormData } from "@/components/DeliveryZoneForm"

export const metadata: Metadata = {
    title: "Edit Delivery Zone",
}

type PageProps = { params: Promise<{ id: string }> }

export default async function EditDeliveryZonePage({ params }: PageProps) {
    const { id } = await params

    const zone = await prisma.deliveryZone.findUnique({
        where: { id },
    })

    if (!zone) notFound()

    const initialData: DeliveryZoneFormData = {
        id: zone.id,
        name: zone.name,
        type: zone.type as "AREA" | "POLYGON" | "RADIUS",
        fee: zone.fee.toString(),
        feeUsd: zone.feeUsd.toString(),
        minOrder: zone.minOrder.toString(),
        minOrderUsd: zone.minOrderUsd.toString(),
        estimatedMinutes: zone.estimatedMinutes,
        active: zone.active,
        priority: zone.priority,
        country: zone.country ?? "",
        region: zone.region ?? "",
        province: zone.province ?? "",
        district: zone.district ?? "",
        centerLat: zone.centerLat != null ? parseFloat(zone.centerLat.toString()) : null,
        centerLng: zone.centerLng != null ? parseFloat(zone.centerLng.toString()) : null,
        radiusMeters: zone.radiusMeters ?? 2000,
        polygon: (zone.polygon as [number, number][] | null) ?? null,
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    Edit Zone: {zone.name}
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Update boundaries, fees, or availability
                </p>
            </div>
            <DeliveryZoneForm initialData={initialData} />
        </div>
    )
}
