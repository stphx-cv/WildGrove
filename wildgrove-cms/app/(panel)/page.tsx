// ══════════════════════════════════════════════════════════════════
// Admin Dashboard — H3: Professional real-time dashboard
// Server component: auth guard + settings → renders DashboardShell
// ══════════════════════════════════════════════════════════════════

import type { Metadata } from "next"
import { getAppSettings } from "@wildgrove/core/settings"
import { DashboardShell } from "@/components/dashboard/DashboardShell"

export const metadata: Metadata = {
    title: "Dashboard",
}

export default async function AdminDashboardPage() {
    // The cached getter, so the dashboard shell opens no Postgres connection of
    // its own before the client sections start asking for data.
    const settings = await getAppSettings()

    return (
        <DashboardShell defaultPreset={settings.dashboardDefaultPreset} />
    )
}
