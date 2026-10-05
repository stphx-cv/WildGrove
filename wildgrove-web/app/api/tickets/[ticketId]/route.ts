// ══════════════════════════════════════════════════════════════════
// GET  /api/tickets/[ticketId] — Ticket detail with messages
// PATCH /api/tickets/[ticketId] — User cancels their own ticket
// (user-facing, filters out internal notes)
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { formatTicketNumber, toAttachmentLinks } from "@wildgrove/core/tickets"

export async function GET(
    _request: Request,
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

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                messages: {
                    where: { isInternal: false },
                    orderBy: { createdAt: "asc" },
                    include: { attachments: true },
                },
                profile: {
                    select: { name: true, avatarUrl: true },
                },
            },
        })

        if (!ticket) {
            return NextResponse.json(
                { success: false, error: "Ticket not found" },
                { status: 404 },
            )
        }

        // Verify ownership
        if (ticket.profileId !== user.id) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                formattedNumber: formatTicketNumber(ticket.ticketNumber),
                category: ticket.category,
                subject: ticket.subject,
                status: ticket.status,
                priority: ticket.priority,
                priorityLockedByAdmin: ticket.priorityLockedByAdmin,
                locale: ticket.locale,
                createdAt: ticket.createdAt.toISOString(),
                updatedAt: ticket.updatedAt.toISOString(),
                profile: ticket.profile,
                messages: ticket.messages.map((m) => ({
                    id: m.id,
                    senderId: m.senderId,
                    senderRole: m.senderRole,
                    content: m.content,
                    createdAt: m.createdAt.toISOString(),
                    attachments: toAttachmentLinks(ticket.id, m.attachments),
                })),
            },
        })
    } catch (error) {
        console.error("[tickets/detail]", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        )
    }
}

// ── PATCH — user cancels or hides their own ticket ───────────────

export async function PATCH(
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
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { profileId: true, status: true, locale: true },
        })

        if (!ticket || ticket.profileId !== user.id) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
        }

        // Read action from body (defaults to "cancel" for backwards compatibility)
        let action: string = "cancel"
        try {
            const body = await request.json()
            if (body?.action) action = body.action
        } catch { /* no body — treat as cancel */ }

        // ── Hide (works for any status — admin still sees it) ─────
        if (action === "hide") {
            await prisma.ticket.update({
                where: { id: ticketId },
                data: { hiddenByUser: true },
            })
            return NextResponse.json({ success: true })
        }

        // ── Cancel ────────────────────────────────────────────────
        if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
            return NextResponse.json({ success: false, error: "Ticket is already closed" }, { status: 400 })
        }

        const [, systemMsg] = await prisma.$transaction([
            prisma.ticket.update({
                where: { id: ticketId },
                data: { status: "CLOSED" },
            }),
            prisma.ticketMessage.create({
                data: {
                    ticketId,
                    senderId: user.id,
                    senderRole: "SYSTEM",
                    content: ticket.locale === "es" ? "Consulta cancelada por quien la envió." : "Customer cancelled this inquiry.",
                    isInternal: false,
                },
            }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                status: "CLOSED",
                systemMessage: {
                    id: systemMsg.id,
                    senderId: systemMsg.senderId,
                    senderRole: systemMsg.senderRole,
                    content: systemMsg.content,
                    createdAt: systemMsg.createdAt.toISOString(),
                    attachments: [],
                },
            },
        })
    } catch (error) {
        console.error("[tickets/cancel]", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        )
    }
}
