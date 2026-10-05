// ══════════════════════════════════════════════════════════════════
// New Delivery Zone — /delivery-zones/new
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { DeliveryZoneForm } from "@/components/DeliveryZoneForm"

export const metadata: Metadata = {
    title: "New Delivery Zone",
}

export default function NewDeliveryZonePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                    New Delivery Zone
                </h1>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                    Define where you deliver and the associated fees
                </p>
            </div>
            <DeliveryZoneForm />
        </div>
    )
}
