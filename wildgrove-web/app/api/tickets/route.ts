// ══════════════════════════════════════════════════════════════════
// POST /api/tickets | Create a new support ticket
// GET  /api/tickets | List the authenticated user's tickets
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { createServiceClient } from '@wildgrove/core/clients/admin'
import {
    createTicketWithMessage,
    formatTicketNumber,
    validateFiles,
} from "@wildgrove/core/tickets"
import {
    createTransporter,
    getAdminEmail,
    getEmailFrom,
    getLocaleFromRequest,
} from "@wildgrove/core/email"
import {
    ticketCreatedUserHtml,
    ticketCreatedAdminHtml,
} from "@wildgrove/core/tickets/emails"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"
import type { TicketCategory, TicketPriority } from "@wildgrove/db"

// ── Validation ───────────────────────────────────────────────────

const VALID_CATEGORIES: TicketCategory[] = [
    "GENERAL_INQUIRY",
    "RESERVATIONS",
    "COMPLAINTS_SUGGESTIONS",
    "BILLING",
    "OTHER",
]
const VALID_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]

const ticketSchema = z.object({
    category: z.enum(VALID_CATEGORIES as [string, ...string[]]),
    subject: z.string().min(1, "Subject is required").max(120),
    message: z.string().min(10, "Message must be at least 10 characters").max(5000),
    priority: z.enum(VALID_PRIORITIES as [string, ...string[]]).optional(),
})

// ── InsForge admin for realtime broadcasts ──────────────────────

function getInsforgeAdmin() {
    return createServiceClient()
}

// ── POST | Create Ticket ─────────────────────────────────────────

export async function POST(request: Request) {
    try {
        // Authenticate
        const insforge = await createClient()
        const {
            data: { user: authUser },
        } = await insforge.auth.getUser()
        if (!authUser) {
            return NextResponse.json(
                { success: false, error: "Authentication required" },
                { status: 401 },
            )
        }

        // Parse form data (supports file uploads)
        const formData = await request.formData()
        const body = {
            category: formData.get("category") as string,
            subject: formData.get("subject") as string,
            message: formData.get("message") as string,
            priority: formData.get("priority") as string | null,
        }

        const parsed = ticketSchema.safeParse(body)
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
            if (entry instanceof File && entry.size > 0) {
                files.push(entry)
            }
        }

        // Validate files
        if (files.length > 0) {
            const fileError = await validateFiles(files)
            if (fileError) {
                return NextResponse.json(
                    { success: false, error: fileError },
                    { status: 400 },
                )
            }
        }

        const locale = getLocaleFromRequest(request)

        // Get profile for email data
        const profile = await prisma.profile.findUnique({
            where: { id: authUser.id },
            select: { name: true, email: true, phoneNumber: true, phoneCountryCode: true },
        })

        // Create ticket
        const { ticket } = await createTicketWithMessage({
            profileId: authUser.id,
            category: parsed.data.category as TicketCategory,
            subject: parsed.data.subject,
            message: parsed.data.message,
            priority: (parsed.data.priority as TicketPriority) ?? "MEDIUM",
            locale,
            files: files.length > 0 ? files : undefined,
        })

        // Broadcast to admin panel
        try {
            const channel = getInsforgeAdmin().channel("admin:tickets")
            await channel.send({
                type: "broadcast",
                event: "new-ticket",
                payload: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
            })
        } catch (err) {
            console.error("[tickets] Broadcast error:", err)
        }

        createAdminNotificationForAllAdmins({
            type: "TICKET_CREATED",
            entityType: "TICKET",
            entityId: ticket.id,
            title: "New support ticket",
            message: `${profile?.name || "A customer"} opened ${formatTicketNumber(ticket.ticketNumber)}: ${ticket.subject}`,
            href: `/tickets?ticket=${ticket.id}`,
            metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, profileId: authUser.id },
        }).catch((e) => console.error("[tickets] Notification error:", e))

        // Send emails
        try {
            const emailFrom = await getEmailFrom()
            const transporter = await createTransporter()
            if (transporter && emailFrom) {
                const emailTo = await getAdminEmail()
                const phone = profile?.phoneNumber
                    ? `${profile.phoneCountryCode ?? ""}${profile.phoneNumber}`
                    : null
                const emailData = {
                    ticketNumber: ticket.ticketNumber,
                    name: profile?.name || "Customer",
                    email: profile?.email || authUser.email || "",
                    phone,
                    category: ticket.category,
                    subject: ticket.subject,
                    message: parsed.data.message,
                    priority: ticket.priority,
                    ticketId: ticket.id,
                    createdAt: ticket.createdAt,
                }

                if (emailTo) {
                    // Admin notification
                    await transporter.sendMail({
                        from: `Wild Grove <${emailFrom}>`,
                        to: emailTo,
                        replyTo: profile?.email || authUser.email || undefined,
                        subject: `New Ticket ${formatTicketNumber(ticket.ticketNumber)}: ${ticket.subject} | from ${emailData.name}`,
                        html: ticketCreatedAdminHtml(emailData, "en"),
                    })
                }
                // User confirmation
                await transporter.sendMail({
                    from: `Wild Grove <${emailFrom}>`,
                    to: profile?.email || authUser.email!,
                    subject: locale === "es"
                        ? `Consulta ${formatTicketNumber(ticket.ticketNumber)} recibida | Wild Grove`
                        : `Inquiry ${formatTicketNumber(ticket.ticketNumber)} received | Wild Grove`,
                    html: ticketCreatedUserHtml(emailData, locale),
                })
            }
        } catch (emailError) {
            console.error("[tickets] Email error:", emailError)
        }

        return NextResponse.json({
            success: true,
            data: {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                formattedNumber: formatTicketNumber(ticket.ticketNumber),
            },
        })
    } catch (error) {
        console.error("[tickets] Creation failed:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create ticket. Please try again." },
            { status: 500 },
        )
    }
}

// ── GET | List User's Tickets ────────────────────────────────────

export async function GET() {
    try {
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

        const tickets = await prisma.ticket.findMany({
            where: { profileId: user.id, hiddenByUser: false },
            orderBy: { updatedAt: "desc" },
            include: {
                _count: { select: { messages: { where: { isInternal: false } } } },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    where: { isInternal: false },
                    select: { content: true, createdAt: true, senderRole: true },
                },
            },
        })

        const data = tickets.map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            formattedNumber: formatTicketNumber(t.ticketNumber),
            category: t.category,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            messageCount: t._count.messages,
            lastMessage: t.messages[0]?.content?.slice(0, 120) ?? null,
            lastMessageRole: t.messages[0]?.senderRole ?? null,
            lastMessageAt: t.messages[0]?.createdAt?.toISOString() ?? null,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
        }))

        return NextResponse.json({ success: true, data })
    } catch (error) {
        console.error("[tickets] List failed:", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        )
    }
}
