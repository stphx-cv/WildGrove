// ══════════════════════════════════════════════════════════════════
// /tickets/[id] — the address ticket notifications used to link to.
// The tickets page picks a ticket from `?ticket=`, so this only redirects,
// and notifications already saved with the old address keep working.
// ══════════════════════════════════════════════════════════════════

import { redirect } from "next/navigation"

export default async function AdminTicketRedirectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/tickets?ticket=${encodeURIComponent(id)}`)
}
