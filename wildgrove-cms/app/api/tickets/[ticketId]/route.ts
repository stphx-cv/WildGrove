// ══════════════════════════════════════════════════════════════════
// Admin Ticket Detail
// GET    | Full ticket with all messages (including internal notes)
// PATCH  | Update status, priority, assignment
// DELETE | Permanently delete ticket (OWNER only)
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateTicketSchema } from "@wildgrove/core/admin-validation"
import {
    addTicketMessage,
    formatTicketNumber,
    deleteTicketStorage,
    toAttachmentLinks,
} from "@wildgrove/core/tickets"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import { createTransporter, getEmailFrom } from "@wildgrove/core/email"
import { ticketStatusUserHtml } from "@wildgrove/core/tickets/emails"

function getInsforgeAdmin() {
    return createServiceClient()
}

// ── GET | Ticket detail with ALL messages ────────────────────────

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ticketId: string }> },
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
        const { ticketId } = await params

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                profile: {
                    select: { name: true, email: true, phoneNumber: true, phoneCountryCode: true, avatarUrl: true },
                },
                messages: {
                    orderBy: { createdAt: "asc" },
                    include: { attachments: true },
                },
            },
        })

        if (!ticket) {
            return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                ticket: {
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    formattedNumber: formatTicketNumber(ticket.ticketNumber),
                    category: ticket.category,
                    subject: ticket.subject,
                    status: ticket.status,
                    priority: ticket.priority,
                    priorityLockedByAdmin: ticket.priorityLockedByAdmin,
                    assignedAdminId: ticket.assignedAdminId,
                    locale: ticket.locale,
                    createdAt: ticket.createdAt.toISOString(),
                    updatedAt: ticket.updatedAt.toISOString(),
                },
                customer: ticket.profile
                    ? {
                        name: ticket.profile.name,
                        email: ticket.profile.email,
                        phone: ticket.profile.phoneNumber
                            ? `${ticket.profile.phoneCountryCode ?? ""}${ticket.profile.phoneNumber}`
                            : null,
                        avatar: ticket.profile.avatarUrl,
                    }
                    : null,
                messages: ticket.messages.map((m) => ({
                    id: m.id,
                    senderId: m.senderId,
                    senderRole: m.senderRole,
                    content: m.content,
                    isInternal: m.isInternal,
                    createdAt: m.createdAt.toISOString(),
                    attachments: toAttachmentLinks(ticket.id, m.attachments),
                })),
            },
        })
    } catch (error) {
        console.error("[admin/tickets/detail] GET failed:", error)
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
}

// ── PATCH | Update ticket properties ─────────────────────────────

export async function PATCH(
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
        const parsed = updateTicketSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
                { status: 400 },
            )
        }
        const { status, priority, assignedAdminId } = parsed.data

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                profile: { select: { name: true, email: true } },
            },
        })

        if (!ticket) {
            return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 })
        }

        const updateData: Record<string, unknown> = {}

        // Status change
        if (status && status !== ticket.status) {
            updateData.status = status

            // Create system message for status change
            const locale = ticket.locale as "en" | "es"
            const isEs = locale === "es"
            const statusLabels: Record<string, string> = isEs
                ? { OPEN: "Abierta", IN_PROGRESS: "En curso", AWAITING_REPLY: "Esperando respuesta", RESOLVED: "Resuelta", CLOSED: "Cerrada" }
                : { OPEN: "Open", IN_PROGRESS: "In Progress", AWAITING_REPLY: "Awaiting Reply", RESOLVED: "Resolved", CLOSED: "Closed" }

            const sysContent = isEs
                ? `Estado de la consulta cambiado de ${statusLabels[ticket.status] ?? ticket.status} a ${statusLabels[status] ?? status}`
                : `Inquiry status changed from ${statusLabels[ticket.status] ?? ticket.status} to ${statusLabels[status] ?? status}`

            await addTicketMessage(ticketId, auth.userId, "SYSTEM", sysContent)

            // Email user on RESOLVED or CLOSED
            if (status === "RESOLVED" || status === "CLOSED") {
                try {
                    const transporter = await createTransporter()
                    const emailFrom = await getEmailFrom()
                    if (transporter && emailFrom && ticket.profile?.email) {

                        await transporter.sendMail({
                            from: `Wild Grove <${emailFrom}>`,
                            to: ticket.profile.email,
                            subject: isEs
                                ? `Consulta ${formatTicketNumber(ticket.ticketNumber)} | ${statusLabels[status]}`
                                : `Inquiry ${formatTicketNumber(ticket.ticketNumber)} | ${statusLabels[status]}`,
                            html: ticketStatusUserHtml(
                                {
                                    ticketNumber: ticket.ticketNumber,
                                    name: ticket.profile.name || "Customer",
                                    subject: ticket.subject,
                                    oldStatus: ticket.status,
                                    newStatus: status,
                                },
                                locale,
                            ),
                        })
                    }
                } catch (emailErr) {
                    console.error("[admin/tickets] Status email error:", emailErr)
                }
            }

            // Broadcast status change
            try {
                const channel = getInsforgeAdmin().channel(`ticket:${ticketId}`)
                await channel.send({
                    type: "broadcast",
                    event: "status-change",
                    payload: { status },
                })
            } catch {
                // silent
            }
        }

        // Priority change
        if (priority && priority !== ticket.priority) {
            updateData.priority = priority
            updateData.priorityLockedByAdmin = true
        }

        // Assignment
        if (assignedAdminId !== undefined) {
            updateData.assignedAdminId = assignedAdminId || null
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true, data: { ticket } })
        }

        const updated = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData,
        })

        return NextResponse.json({
            success: true,
            data: {
                ticket: {
                    ...updated,
                    formattedNumber: formatTicketNumber(updated.ticketNumber),
                    createdAt: updated.createdAt.toISOString(),
                    updatedAt: updated.updatedAt.toISOString(),
                },
            },
        })
    } catch (error) {
        console.error("[admin/tickets/detail] PATCH failed:", error)
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
}

// ── DELETE | Permanently delete ticket (OWNER only) ──────────────

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ ticketId: string }> },
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    if (auth.role !== "OWNER") {
        return NextResponse.json(
            { success: false, error: "Only the owner can delete tickets" },
            { status: 403 },
        )
    }

    try {
        const { ticketId } = await params

        // Clean up storage files
        await deleteTicketStorage(ticketId)

        // Cascade delete (messages + attachments via schema onDelete)
        await prisma.ticket.delete({ where: { id: ticketId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[admin/tickets/detail] DELETE failed:", error)
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
}
