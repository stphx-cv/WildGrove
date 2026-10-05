// ══════════════════════════════════════════════════════════════════
// POST /api/tickets/[ticketId]/reply — User replies to a ticket
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import {
    addTicketMessage,
    uploadTicketAttachments,
    validateFiles,
    formatTicketNumber,
    toAttachmentLinks,
} from "@wildgrove/core/tickets"
import { createTransporter, getAdminEmail, getEmailFrom, getLocaleFromRequest } from "@wildgrove/core/email"
import { ticketReplyAdminHtml } from "@wildgrove/core/tickets/emails"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"

const replySchema = z.object({
    message: z.string().min(1, "Message is required").max(5000),
})

function getInsforgeAdmin() {
    return createServiceClient()
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ ticketId: string }> },
) {
    try {
        const { ticketId } = await params
        const insforge = await createClient()
        const {
            data: { user },
        } = await insforge.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 },
            )
        }

        // Verify ticket ownership
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                profile: { select: { name: true, email: true } },
            },
        })

        if (!ticket || ticket.profileId !== user.id) {
            return NextResponse.json(
                { success: false, error: "Ticket not found" },
                { status: 404 },
            )
        }

        // Prevent replies on closed/resolved tickets
        if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
            return NextResponse.json(
                { success: false, error: "This ticket is closed and cannot receive replies" },
                { status: 400 },
            )
        }

        // Parse form data
        const formData = await request.formData()
        const body = { message: formData.get("message") as string }
        const parsed = replySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 },
            )
        }

        // Collect files
        const files: File[] = []
        const fileEntries = formData.getAll("files")
        for (const entry of fileEntries) {
            if (entry instanceof File && entry.size > 0) files.push(entry)
        }
        if (files.length > 0) {
            const fileError = await validateFiles(files)
            if (fileError) {
                return NextResponse.json({ success: false, error: fileError }, { status: 400 })
            }
        }

        // Create message
        const message = await addTicketMessage(
            ticketId,
            user.id,
            "USER",
            parsed.data.message,
        )

        // Upload attachments
        let attachments: { id: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string }[] = []
        if (files.length > 0) {
            const uploaded = await uploadTicketAttachments(ticketId, message.id, files)
            // Private bucket: return the app's attachment route, not the raw storage paths.
            attachments = toAttachmentLinks(ticketId, uploaded)
        }

        // If ticket was AWAITING_REPLY, change back to OPEN
        if (ticket.status === "AWAITING_REPLY") {
            await prisma.ticket.update({
                where: { id: ticketId },
                data: { status: "OPEN" },
            })
        }

        // Broadcast to admin
        try {
            const channel = getInsforgeAdmin().channel(`admin:ticket:${ticketId}`)
            await channel.send({
                type: "broadcast",
                event: "new-message",
                payload: { message: { ...message, attachments } },
            })
        } catch (err) {
            console.error("[tickets/reply] Broadcast error:", err)
        }

        createAdminNotificationForAllAdmins({
            type: "TICKET_REPLY_RECEIVED",
            entityType: "TICKET_MESSAGE",
            entityId: message.id,
            title: "Ticket reply received",
            message: `${ticket.profile?.name || "A customer"} replied on ${formatTicketNumber(ticket.ticketNumber)}: ${ticket.subject}`,
            href: `/tickets?ticket=${ticketId}`,
            metadata: { ticketId, messageId: message.id, ticketNumber: ticket.ticketNumber },
        }).catch((e) => console.error("[tickets/reply] Notification error:", e))

        // Email admin
        try {
            const transporter = await createTransporter()
            if (transporter) {
                const emailTo = await getAdminEmail()
                const emailFrom = await getEmailFrom()
                const locale = getLocaleFromRequest(request)
                if (!emailFrom || !emailTo) {
                    // Email notifications disabled in settings.
                } else {

                    await transporter.sendMail({
                        from: `Wild Grove <${emailFrom}>`,
                        to: emailTo,
                        replyTo: ticket.profile?.email || undefined,
                        subject: `Reply on ${formatTicketNumber(ticket.ticketNumber)}: ${ticket.subject}`,
                        html: ticketReplyAdminHtml(
                            {
                                ticketNumber: ticket.ticketNumber,
                                name: ticket.profile?.name || "Customer",
                                subject: ticket.subject,
                                replyContent: parsed.data.message,
                            },
                            locale,
                        ),
                    })
                }
            }
        } catch (emailErr) {
            console.error("[tickets/reply] Email error:", emailErr)
        }

        return NextResponse.json({
            success: true,
            data: {
                message: {
                    id: message.id,
                    senderId: message.senderId,
                    senderRole: message.senderRole,
                    content: message.content,
                    createdAt: message.createdAt.toISOString(),
                    attachments,
                },
            },
        })
    } catch (error) {
        console.error("[tickets/reply]", error)
        return NextResponse.json(
            { success: false, error: "Failed to send reply" },
            { status: 500 },
        )
    }
}
