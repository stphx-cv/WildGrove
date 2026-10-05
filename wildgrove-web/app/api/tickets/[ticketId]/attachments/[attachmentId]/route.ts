// ══════════════════════════════════════════════════════════════════
// GET /api/tickets/[ticketId]/attachments/[attachmentId]
// Serves one attachment to the ticket's owner. The file is read by
// the server; the browser never talks to storage directly.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { ticketAttachmentResponse } from "@wildgrove/core/tickets"

const NO_STORE = { "Cache-Control": "private, no-store" }

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ticketId: string; attachmentId: string }> },
) {
    try {
        const { ticketId, attachmentId } = await params
        const insforge = await createClient()
        const {
            data: { user },
        } = await insforge.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401, headers: NO_STORE },
            )
        }

        const attachment = await prisma.ticketAttachment.findUnique({
            where: { id: attachmentId },
            select: {
                fileName: true,
                fileUrl: true,
                mimeType: true,
                message: {
                    select: {
                        ticketId: true,
                        isInternal: true,
                        ticket: { select: { profileId: true } },
                    },
                },
            },
        })

        // Same answer for "missing" and "not yours", so ids can't be probed.
        if (
            !attachment ||
            attachment.message.ticketId !== ticketId ||
            attachment.message.isInternal ||
            attachment.message.ticket.profileId !== user.id
        ) {
            return NextResponse.json(
                { success: false, error: "Attachment not found" },
                { status: 404, headers: NO_STORE },
            )
        }

        return await ticketAttachmentResponse(attachment)
    } catch (error) {
        console.error("[tickets/attachment]", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500, headers: NO_STORE },
        )
    }
}
