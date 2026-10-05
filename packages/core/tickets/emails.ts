// ══════════════════════════════════════════════════════════════════
// Ticket Email Functions — Branded HTML emails for ticket events.
// Uses the same loadEmailTemplate pattern as lib/email.ts
// ══════════════════════════════════════════════════════════════════

import { loadEmailTemplate } from "../emails/loadTemplate"
import { formatTicketNumber } from "./index"
import { escapeHtml } from "../email"
import { APP_DATETIME_TIMEZONE } from "../app-datetime-format"


// ── Types ────────────────────────────────────────────────────────

export interface TicketEmailData {
    ticketNumber: number
    name: string
    email: string
    phone?: string | null
    category: string
    subject: string
    message: string
    priority: string
    ticketId: string
    createdAt: Date
}

export interface TicketReplyEmailData {
    ticketNumber: number
    name: string
    subject: string
    replyContent: string
    replierName?: string
}

export interface TicketStatusEmailData {
    ticketNumber: number
    name: string
    subject: string
    oldStatus: string
    newStatus: string
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(date: Date, locale: "en" | "es"): string {
    const intlLocale = locale === "es" ? "es-PE" : "en-US"
    return new Intl.DateTimeFormat(intlLocale, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: APP_DATETIME_TIMEZONE,
    }).format(date)
}

function categoryLabel(category: string, locale: "en" | "es"): string {
    const labels: Record<string, Record<string, string>> = {
        GENERAL_INQUIRY: { en: "General Inquiry", es: "Consulta general" },
        RESERVATIONS: { en: "Reservations", es: "Reservas" },
        COMPLAINTS_SUGGESTIONS: { en: "Complaints & Suggestions", es: "Quejas y sugerencias" },
        BILLING: { en: "Billing", es: "Facturación" },
        OTHER: { en: "Other", es: "Otros" },
    }
    return labels[category]?.[locale] ?? category
}

function priorityLabel(priority: string, locale: "en" | "es"): string {
    const labels: Record<string, Record<string, string>> = {
        LOW: { en: "Low", es: "Baja" },
        MEDIUM: { en: "Medium", es: "Media" },
        HIGH: { en: "High", es: "Alta" },
        URGENT: { en: "Urgent", es: "Urgente" },
    }
    return labels[priority]?.[locale] ?? priority
}

function statusLabel(status: string, locale: "en" | "es"): string {
    const labels: Record<string, Record<string, string>> = {
        OPEN: { en: "Open", es: "Abierta" },
        IN_PROGRESS: { en: "In Progress", es: "En curso" },
        AWAITING_REPLY: { en: "Awaiting Reply", es: "Esperando respuesta" },
        RESOLVED: { en: "Resolved", es: "Resuelta" },
        CLOSED: { en: "Closed", es: "Cerrada" },
    }
    return labels[status]?.[locale] ?? status
}

// ── Template Functions ───────────────────────────────────────────

/** User confirmation when they create a new ticket. */
export function ticketCreatedUserHtml(data: TicketEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("ticket-created-user.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        TICKET_NUMBER: formatTicketNumber(data.ticketNumber),
        CATEGORY: categoryLabel(data.category, locale),
        SUBJECT: escapeHtml(data.subject),
        MESSAGE: escapeHtml(data.message.length > 300 ? data.message.slice(0, 300) + "..." : data.message),
        PRIORITY: priorityLabel(data.priority, locale),
    }, locale)
}

/** Admin notification when a new ticket is created. */
export function ticketCreatedAdminHtml(data: TicketEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    const phoneRow = data.phone
        ? `<tr><td style="border-top:1px solid #CDD4C7;padding:10px 20px 14px;">
            <span style="font-size:11px;color:#8FA98C;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;display:block;margin-bottom:3px;">${isEs ? "Teléfono" : "Phone"}</span>
            <a href="tel:${escapeHtml(data.phone)}" style="font-size:14px;color:#3A5A40;font-weight:500;text-decoration:none;">${escapeHtml(data.phone)}</a>
           </td></tr>`
        : ""

    return loadEmailTemplate("ticket-created-admin.html", {
        TICKET_NUMBER: formatTicketNumber(data.ticketNumber),
        CUSTOMER_NAME: escapeHtml(data.name),
        CUSTOMER_EMAIL: escapeHtml(data.email),
        CUSTOMER_PHONE_ROW: phoneRow,
        CATEGORY: categoryLabel(data.category, locale),
        PRIORITY: priorityLabel(data.priority, locale),
        SUBJECT: escapeHtml(data.subject),
        MESSAGE: escapeHtml(data.message),
        SUBMITTED_AT: formatDate(data.createdAt, locale),
    }, locale)
}

/** Notify user that admin replied to their ticket. */
export function ticketReplyUserHtml(data: TicketReplyEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("ticket-reply-user.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        TICKET_NUMBER: formatTicketNumber(data.ticketNumber),
        SUBJECT: escapeHtml(data.subject),
        REPLY_CONTENT: escapeHtml(data.replyContent.length > 500 ? data.replyContent.slice(0, 500) + "..." : data.replyContent),
        REPLIER_NAME: escapeHtml(data.replierName ?? "Wild Grove Team"),
    }, locale)
}

/** Notify admin that user replied to a ticket. */
export function ticketReplyAdminHtml(data: TicketReplyEmailData, locale: "en" | "es" = "en"): string {
    return loadEmailTemplate("ticket-reply-admin.html", {
        TICKET_NUMBER: formatTicketNumber(data.ticketNumber),
        CUSTOMER_NAME: escapeHtml(data.name),
        SUBJECT: escapeHtml(data.subject),
        REPLY_CONTENT: escapeHtml(data.replyContent.length > 500 ? data.replyContent.slice(0, 500) + "..." : data.replyContent),
    }, locale)
}

/** Notify user when ticket status changes (resolved, closed). */
export function ticketStatusUserHtml(data: TicketStatusEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("ticket-status-user.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        TICKET_NUMBER: formatTicketNumber(data.ticketNumber),
        SUBJECT: escapeHtml(data.subject),
        OLD_STATUS: statusLabel(data.oldStatus, locale),
        NEW_STATUS: statusLabel(data.newStatus, locale),
    }, locale)
}
