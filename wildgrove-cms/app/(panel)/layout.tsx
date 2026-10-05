// ══════════════════════════════════════════════════════════════════
// Panel shell — sidebar, header and the app date-time context.
// Previously wildgrove-web/app/admin/layout.tsx. Excluded from /login.
// ══════════════════════════════════════════════════════════════════
import { AdminSidebar } from "@/components/AdminSidebar"
import { AdminHeader } from "@/components/AdminHeader"
import { AdminAppDateTimeProvider } from "@/components/AdminAppDateTimeContext"
import { CmsQueryProvider } from "@/components/CmsQueryProvider"

export default function PanelLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <CmsQueryProvider>
            <AdminAppDateTimeProvider>
                <div className="admin-shell flex min-h-screen bg-wg-bg dark:bg-wg-dark-bg">
                    {/* Fixed sidebar — hidden on mobile, visible on lg+ */}
                    <AdminSidebar />

                    {/* Main panel — shifts right on desktop to make room for sidebar */}
                    <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
                        <AdminHeader />
                        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                            {children}
                        </main>
                    </div>
                </div>
            </AdminAppDateTimeProvider>
        </CmsQueryProvider>
    )
}
