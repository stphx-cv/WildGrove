// ══════════════════════════════════════════════════════════════════
// POST /api/tickets/[ticketId]/reply | Admin replies to ticket
// Supports internal notes (isInternal=true) which are not visible
// to the customer and do not trigger email notifications.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { addTicketMessage, formatTicketNumber } from "@wildgrove/core/tickets"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { createTransporter, getEmailFrom } from "@wildgrove/core/email"
import { ticketReplyUserHtml } from "@wildgrove/core/tickets/emails"

const replySchema = z.object({
    message: z.string().min(1).max(5000),
    isInternal: z.boolean().optional().default(false),
})

function getInsforgeAdmin() {
    return createServiceClient()
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ ticketId: string }> },
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const { ticketId } = await params
        const body = await request.json()
        const parsed = replySchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 },
            )
        }

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                profile: { select: { name: true, email: true } },
            },
        })

        if (!ticket) {
            return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 })
        }

        // Create the message
        const message = await addTicketMessage(
            ticketId,
            auth.userId,
            "AGENT",
            parsed.data.message,
            parsed.data.isInternal,
        )

        // For non-internal messages: update status and notify user
        if (!parsed.data.isInternal) {
            // Set status to AWAITING_REPLY if currently OPEN or IN_PROGRESS
            if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") {
                await prisma.ticket.update({
                    where: { id: ticketId },
                    data: { status: "AWAITING_REPLY" },
                })
            }

            // Broadcast to user
            try {
                const channel = getInsforgeAdmin().channel(`ticket:${ticketId}`)
                await channel.send({
                    type: "broadcast",
                    event: "new-message",
                    payload: {
                        message: {
                            id: message.id,
                            senderId: message.senderId,
                            senderRole: message.senderRole,
                            content: message.content,
                            isInternal: false,
                            createdAt: message.createdAt.toISOString(),
                            attachments: [],
                        },
                    },
                })
            } catch {
                // silent
            }

            // Email user
            try {
                const transporter = await createTransporter()
                const emailFrom = await getEmailFrom()
                if (transporter && emailFrom && ticket.profile?.email) {
                    const locale = (ticket.locale as "en" | "es") || "en"

                    // Get admin name
                    const adminProfile = await prisma.profile.findUnique({
                        where: { id: auth.userId },
                        select: { name: true },
                    })

                    await transporter.sendMail({
                        from: `Wild Grove <${emailFrom}>`,
                        to: ticket.profile.email,
                        subject: locale === "es"
                            ? `Respuesta a tu consulta ${formatTicketNumber(ticket.ticketNumber)} | Wild Grove`
                            : `Reply to your inquiry ${formatTicketNumber(ticket.ticketNumber)} | Wild Grove`,
                        html: ticketReplyUserHtml(
                            {
                                ticketNumber: ticket.ticketNumber,
                                name: ticket.profile.name || "Customer",
                                subject: ticket.subject,
                                replyContent: parsed.data.message,
                                replierName: adminProfile?.name || "Wild Grove Team",
                            },
                            locale,
                        ),
                    })
                }
            } catch (emailErr) {
                console.error("[admin/tickets/reply] Email error:", emailErr)
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                message: {
                    id: message.id,
                    senderId: message.senderId,
                    senderRole: message.senderRole,
                    content: message.content,
                    isInternal: message.isInternal,
                    createdAt: message.createdAt.toISOString(),
                    attachments: [],
                },
            },
        })
    } catch (error) {
        console.error("[admin/tickets/reply]", error)
        return NextResponse.json({ success: false, error: "Failed to send reply" }, { status: 500 })
    }
}
