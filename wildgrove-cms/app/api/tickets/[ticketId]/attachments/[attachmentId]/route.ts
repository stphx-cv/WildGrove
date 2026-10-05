// ══════════════════════════════════════════════════════════════════
// GET /api/tickets/[ticketId]/attachments/[attachmentId]
// Serves one ticket attachment to an ADMIN or OWNER. The file is read
// by the server; the browser never talks to storage directly.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { ticketAttachmentResponse } from "@wildgrove/core/tickets"

const NO_STORE = { "Cache-Control": "private, no-store" }

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ticketId: string; attachmentId: string }> },
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json(
            { success: false, error: auth.error },
            { status: auth.status, headers: NO_STORE },
        )
    }

    try {
        const { ticketId, attachmentId } = await params

        const attachment = await prisma.ticketAttachment.findUnique({
            where: { id: attachmentId },
            select: {
                fileName: true,
                fileUrl: true,
                mimeType: true,
                message: { select: { ticketId: true } },
            },
        })

        if (!attachment || attachment.message.ticketId !== ticketId) {
            return NextResponse.json(
                { success: false, error: "Attachment not found" },
                { status: 404, headers: NO_STORE },
            )
        }

        return await ticketAttachmentResponse(attachment)
    } catch (error) {
        console.error("[admin/tickets/attachment]", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500, headers: NO_STORE },
        )
    }
}
