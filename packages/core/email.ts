// ══════════════════════════════════════════════════════════════════
// Shared Email Utilities
// Branded HTML email templates and Nodemailer transporter for
// Wild Grove transactional emails.
// ══════════════════════════════════════════════════════════════════

import nodemailer from "nodemailer"
import { prisma } from "@wildgrove/db"
import { loadEmailTemplate } from "./emails/loadTemplate"
import { cmsLink } from "./urls"
import { absoluteLocalizedUrl } from "./seo/alternates"
import { APP_DATETIME_TIMEZONE } from "./app-datetime-format"

// ── HTML escaping ───────────────────────────────────────────────
// User-controlled values (names, notes, addresses, messages, phones)
// are interpolated into HTML email bodies. JSON/string interpolation
// does NOT escape markup, so escape every such value to prevent HTML
// injection. Safe for both text nodes and double-quoted attributes.
export function escapeHtml(value: string | null | undefined): string {
    if (value == null) return ""
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

// ── Transporter ────────────────────────────────────────────────

export interface EmailConfig {
    host: string
    port: number
    user: string
    pass: string
    from: string
}

/**
 * SMTP settings come from the environment, never from the database.
 *
 * A mailbox password stored in `AppSettings` would sit in a plaintext column
 * that `GET /api/settings` hands to every ADMIN. Credentials belong where the
 * rest of this project keeps them, and the four fields around the password are
 * read from the environment too so the configuration stays in one place.
 *
 * Both apps need all five: the CMS sends ticket replies, the storefront sends
 * everything else. Any missing or unparseable value disables outbound email —
 * callers already treat `null` as "email is off".
 */
export function getEmailConfig(): EmailConfig | null {
    const host = process.env.SMTP_HOST?.trim() ?? ""
    const user = process.env.SMTP_USER?.trim() ?? ""
    const pass = process.env.SMTP_PASS ?? ""
    const from = process.env.SMTP_FROM?.trim() || user
    const port = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "", 10)

    if (!host || !user || !pass || !from) return null
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null

    return { host, port, user, pass, from }
}

export async function createTransporter() {
    const config = getEmailConfig()
    if (!config) return null

    // Fixed timeouts, so a slow mail server fails a send in seconds instead of
    // holding whatever is waiting on it.
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: true,
        auth: {
            user: config.user,
            pass: config.pass,
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    })
}

export async function getEmailFrom() {
    return getEmailConfig()?.from ?? null
}

// ── Branded HTML Wrapper ───────────────────────────────────────

// ── Recovery Email OTP Template ────────────────────────────────
// Matches the structure of emails/templates/*.html

export function recoveryEmailOtpHtml(code: string, locale: "en" | "es" = "en") {
    const isEs = locale === "es"
    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${isEs ? "Verificar correo de recuperación | Wild Grove" : "Verify Your Recovery Email | Wild Grove"}</title>
</head>
<body style="margin:0;padding:0;background-color:#E9EEE4;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background-color:#E9EEE4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:560px;width:100%;">
          <!-- HEADER -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="https://www.wildgrove.cv/png/wildgrove_logo.png"
                      width="36" height="36" alt="Wild Grove" style="display:block;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;
                      font-weight:700;color:#3A5A40;letter-spacing:-0.3px;">Wild Grove</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CARD -->
          <tr>
            <td style="background-color:#F3F6F0;border-radius:16px;
              box-shadow:0 2px 24px rgba(58,90,64,0.10);overflow:hidden;">
              <!-- Green top bar -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color:#3A5A40;height:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <!-- Card body -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:44px 44px 16px;">
                    <!-- Shield icon -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                      style="margin-bottom:28px;">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td width="64" height="64" align="center" valign="middle"
                                style="width:64px;height:64px;border-radius:50%;
                                background-color:#3A5A40;text-align:center;
                                font-size:28px;line-height:64px;">&#128737;</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <!-- Heading -->
                    <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;
                      font-size:28px;font-weight:700;color:#1A1A18;text-align:center;
                      line-height:1.25;letter-spacing:-0.5px;">
                      ${isEs ? "Verificar correo de recuperación" : "Verify Recovery Email"}
                    </h1>
                    <!-- Subheading -->
                    <p style="margin:0 0 32px;font-size:16px;color:#566650;text-align:center;
                      line-height:1.6;">
                      ${isEs
                          ? "Solicitaste agregar esta dirección como correo de recuperación en tu cuenta de Wild Grove. Ingresa el código a continuación para confirmar."
                          : "You requested to add this address as a recovery email on your Wild Grove account. Enter the code below to confirm."
                      }
                    </p>
                    <!-- OTP Code -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                      style="margin-bottom:8px;">
                      <tr>
                        <td align="center">
                          <p style="margin:0 0 20px;font-size:14px;color:#566650;
                            text-align:center;line-height:1.6;">
                            ${isEs ? "Tu código de verificación:" : "Your verification code:"}
                          </p>
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="background-color:#E9EEE4;border-radius:14px;
                                border:2px solid #3A5A40;padding:22px 44px;">
                                <span style="font-size:40px;font-weight:700;letter-spacing:12px;
                                  color:#3A5A40;font-family:'Courier New',Courier,monospace;
                                  line-height:1;display:block;">${code}</span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:16px 0 0;font-size:13px;color:#8FA98C;
                            text-align:center;line-height:1.6;">
                            ${isEs
                                ? "Este código expira en <strong>10 minutos</strong>."
                                : "This code expires in <strong>10 minutes</strong>."
                            }
                          </p>
                        </td>
                      </tr>
                    </table>
                    <!-- Instruction -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                      style="margin-top:28px;">
                      <tr>
                        <td style="border-top:1px solid #CDD4C7;padding-top:24px;padding-bottom:8px;">
                          <p style="margin:0;font-size:13px;color:#566650;line-height:1.6;
                            text-align:center;">
                            ${isEs
                                ? "Regresa a la configuración de tu cuenta en Wild Grove e ingresa este código para finalizar."
                                : "Go back to your Wild Grove account settings and enter this code to finish."
                            }
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Security note -->
                <tr>
                  <td style="padding:16px 44px 36px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background-color:#E9EEE4;border-radius:10px;padding:16px 20px;">
                          <p style="margin:0;font-size:12px;color:#566650;line-height:1.6;">
                            <strong style="color:#3A5A40;">${isEs ? "¿No solicitaste esto?" : "Didn't request this?"}</strong>
                            ${isEs
                                ? "Puedes ignorar este correo. No se realizarán cambios en tu cuenta."
                                : "You can safely ignore this email. No changes will be made to your account."
                            }
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="padding:28px 0 8px;">
              <p style="margin:0;font-size:12px;color:#566650;text-align:center;line-height:1.7;">
                ${isEs ? "© 2026 Wild Grove · Todos los derechos reservados" : "© 2026 Wild Grove · All rights reserved"}<br/>
                <a href="${absoluteLocalizedUrl("/privacy", locale)}" style="color:#566650;text-decoration:underline;">${isEs ? "Política de Privacidad" : "Privacy Policy"}</a>
                &nbsp;·&nbsp;
                <a href="${absoluteLocalizedUrl("/terms", locale)}" style="color:#566650;text-decoration:underline;">${isEs ? "Términos de Servicio" : "Terms of Service"}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Reservation Email Templates ────────────────────────────────

export interface ReservationEmailData {
    name: string
    date: Date
    partySize: number
    reservationId: string
    notes?: string | null
    discount?: {
        name: string
        description: string | null
        valueType: string
        value: number
    }
}

// Reservation times are Lima wall-clock times: the stored instant is UTC.
function formatReservationDate(date: Date, locale: "en" | "es" = "en"): string {
    const intlLocale = locale === "es" ? "es-PE" : "en-US"
    return new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: APP_DATETIME_TIMEZONE,
    }).format(date)
}

// Builds the optional <tr> rows injected into {{DETAIL_ROWS}} in each template.
function buildDetailRows(
    discount?: ReservationEmailData["discount"],
    notes?: string | null,
    locale: "en" | "es" = "en"
): string {
    const isEs = locale === "es"
    let rows = ""
    if (discount) {
        rows += `
            <tr>
              <td style="border-top:1px solid #CDD4C7;padding:12px 20px;">
                <span style="font-size:11px;color:#8FA98C;text-transform:uppercase;
                  letter-spacing:0.08em;font-weight:600;display:block;margin-bottom:4px;">
                  ${isEs ? "Promoción aplicada" : "Promo Applied"}
                </span>
                <span style="font-size:14px;color:#3A5A40;font-weight:600;">${escapeHtml(discount.name)}</span>
                ${discount.description
                    ? `<span style="font-size:13px;color:#566650;display:block;margin-top:2px;">${escapeHtml(discount.description)}</span>`
                    : ""}
              </td>
            </tr>`
    }
    if (notes) {
        rows += `
            <tr>
              <td style="border-top:1px solid #CDD4C7;padding:12px 20px;">
                <span style="font-size:11px;color:#8FA98C;text-transform:uppercase;
                  letter-spacing:0.08em;font-weight:600;display:block;margin-bottom:4px;">
                  ${isEs ? "Solicitudes especiales" : "Special Requests"}
                </span>
                <span style="font-size:14px;color:#1A1A18;">${escapeHtml(notes)}</span>
              </td>
            </tr>`
    }
    return rows
}

export function reservationPendingHtml(data: ReservationEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-pending.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        DETAIL_ROWS: buildDetailRows(data.discount, data.notes, locale),
    }, locale)
}

export function reservationConfirmedHtml(data: ReservationEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-confirmed.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        DETAIL_ROWS: buildDetailRows(data.discount, data.notes, locale),
    }, locale)
}

export function reservationCancelledHtml(data: ReservationEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-cancelled.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
    }, locale)
}

export function reservationRescheduledHtml(
    data: ReservationEmailData & { previousDate: Date },
    locale: "en" | "es" = "en"
): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-rescheduled.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        PREVIOUS_DATE: formatReservationDate(data.previousDate, locale),
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        DETAIL_ROWS: buildDetailRows(data.discount, data.notes, locale),
    }, locale)
}

export function reservationCompletedHtml(data: ReservationEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-completed.html", {
        GREETING: data.name ? (isEs ? `Hola ${escapeHtml(data.name)},` : `Hi ${escapeHtml(data.name)},`) : (isEs ? "Hola," : "Hello,"),
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
    }, locale)
}

// ── Admin Reservation Notifications ───────────────────────────

export interface AdminReservationData {
    customerName: string
    customerEmail: string
    customerPhone?: string | null
    date: Date
    partySize: number
    reservationId: string
    notes?: string | null
    discount?: ReservationEmailData["discount"]
    submittedAt: Date
}

export interface AdminReservationActionData {
    customerName: string
    customerEmail: string
    date: Date
    partySize: number
    reservationId: string
    notes?: string | null
    actionAt: Date
    previousDate?: Date  // only for reschedule
}

/** Destination for admin alert emails (Settings → Notification Email). Empty = do not send. */
export async function getAdminEmail(): Promise<string> {
    try {
        const settings = await prisma.appSettings.findUnique({
            where: { key: "global" },
            select: { notificationEmail: true, adminEmailNotificationsEnabled: true },
        })
        if (settings?.adminEmailNotificationsEnabled === false) return ""
        const fromSettings = settings?.notificationEmail?.trim()
        if (fromSettings) return fromSettings
    } catch (error) {
        console.error("[email] Failed to read notificationEmail from settings:", error)
    }

    return ""
}

function formatActionDate(date: Date, locale: "en" | "es" = "en"): string {
    const intlLocale = locale === "es" ? "es-PE" : "en-US"
    return new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: APP_DATETIME_TIMEZONE,
    }).format(date)
}

export function reservationAdminNewHtml(data: AdminReservationData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    const phoneLabel = isEs ? "Teléfono" : "Phone"
    const phoneRow = data.customerPhone
        ? `
            <tr>
              <td style="border-top:1px solid #CDD4C7;padding:10px 20px 14px;">
                <span style="font-size:11px;color:#8FA98C;text-transform:uppercase;
                  letter-spacing:0.08em;font-weight:600;display:block;margin-bottom:3px;">
                  ${phoneLabel}
                </span>
                <a href="tel:${escapeHtml(data.customerPhone)}"
                  style="font-size:14px;color:#3A5A40;font-weight:500;text-decoration:none;">
                  ${escapeHtml(data.customerPhone)}
                </a>
              </td>
            </tr>`
        : `<tr><td style="height:6px;"></td></tr>`

    return loadEmailTemplate("reservation-admin-new.html", {
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        ADMIN_DETAIL_ROWS: buildDetailRows(data.discount, data.notes, locale),
        CUSTOMER_NAME: escapeHtml(data.customerName),
        CUSTOMER_EMAIL: escapeHtml(data.customerEmail),
        CUSTOMER_PHONE_ROW: phoneRow,
        SUBMITTED_AT: formatActionDate(data.submittedAt, locale),
    }, locale)
}

export function reservationAdminConfirmedHtml(data: AdminReservationActionData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-admin-confirmed.html", {
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        ADMIN_DETAIL_ROWS: buildDetailRows(undefined, data.notes, locale),
        CUSTOMER_NAME: escapeHtml(data.customerName),
        CUSTOMER_EMAIL: escapeHtml(data.customerEmail),
        ACTION_AT: formatActionDate(data.actionAt, locale),
    }, locale)
}

export function reservationAdminCancelledHtml(data: AdminReservationActionData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-admin-cancelled.html", {
        DATE_TIME: formatReservationDate(data.date, locale),
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        CUSTOMER_NAME: escapeHtml(data.customerName),
        CUSTOMER_EMAIL: escapeHtml(data.customerEmail),
        ACTION_AT: formatActionDate(data.actionAt, locale),
    }, locale)
}

export function reservationAdminRescheduledHtml(data: AdminReservationActionData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    return loadEmailTemplate("reservation-admin-rescheduled.html", {
        DATE_TIME: formatReservationDate(data.date, locale),
        PREVIOUS_DATE: data.previousDate ? formatReservationDate(data.previousDate, locale) : "-",
        PARTY_SIZE: String(data.partySize),
        PARTY_LABEL: isEs ? (data.partySize === 1 ? "persona" : "personas") : (data.partySize === 1 ? "guest" : "guests"),
        REFERENCE: data.reservationId.slice(-8).toUpperCase(),
        ADMIN_DETAIL_ROWS: buildDetailRows(undefined, data.notes, locale),
        CUSTOMER_NAME: escapeHtml(data.customerName),
        CUSTOMER_EMAIL: escapeHtml(data.customerEmail),
        ACTION_AT: formatActionDate(data.actionAt, locale),
    }, locale)
}

// ── Contact Email Templates ────────────────────────────────────

function formatSubmittedAt(date: Date, locale: "en" | "es" = "en"): string {
    const intlLocale = locale === "es" ? "es-PE" : "en-US"
    return new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: APP_DATETIME_TIMEZONE,
    }).format(date)
}

// ── Chat Support Notification ────────────────────────────────

export interface ChatSupportEmailData {
    customerName: string | null
    customerEmail: string | null
    sessionId: string
    messages: { role: string; content: string; createdAt: string }[]
    locale: "en" | "es"
}

function formatChatMessages(
    messages: ChatSupportEmailData["messages"],
    locale: "en" | "es"
): string {
    const roleLabels: Record<string, Record<string, string>> = {
        en: { USER: "Customer", ASSISTANT: "Sage", SYSTEM: "System", AGENT: "Agent" },
        es: { USER: "Cliente", ASSISTANT: "Sage", SYSTEM: "Sistema", AGENT: "Agente" },
    }
    return messages
        .filter((m) => m.role !== "SYSTEM")
        .slice(-5)
        .map((m) => {
            const label = roleLabels[locale][m.role] || m.role
            const escapedContent = escapeHtml(m.content)
            return `<p style="margin:0 0 8px;">
                <strong style="color:${m.role === "USER" ? "#3A5A40" : "#566650"};">${label}:</strong>
                <span style="color:#1A1A18;">${escapedContent}</span>
            </p>`
        })
        .join("")
}

export async function sendChatSupportEmail(data: ChatSupportEmailData): Promise<void> {
    const isEs = data.locale === "es"

    const html = loadEmailTemplate("chat-support-notification.html", {
        CUSTOMER_NAME: escapeHtml(data.customerName) || (isEs ? "Anónimo" : "Anonymous"),
        CUSTOMER_EMAIL: escapeHtml(data.customerEmail) || (isEs ? "Sin cuenta" : "Not signed in"),
        SESSION_ID: data.sessionId.slice(-8).toUpperCase(),
        MESSAGES: formatChatMessages(data.messages, data.locale),
        SUBMITTED_AT: formatSubmittedAt(new Date(), data.locale),
    }, data.locale)

    const subject = isEs
        ? "💬 Solicitud de soporte en chat | Wild Grove"
        : "💬 Chat support request | Wild Grove"

    try {
        const transporter = await createTransporter()
        const emailFrom = await getEmailFrom()
        if (!transporter || !emailFrom) return
        await transporter.sendMail({
            from: `Wild Grove <${emailFrom}>`,
            to: await getAdminEmail(),
            subject,
            html,
        })
    } catch (error) {
        console.error("[email] Failed to send chat support notification:", error)
    }
}

// ── Send Reservation Email ─────────────────────────────────────

export async function sendReservationEmail(
    to: string,
    subject: string,
    html: string
): Promise<void> {
    try {
        if (!to.trim()) return
        const transporter = await createTransporter()
        const emailFrom = await getEmailFrom()
        if (!transporter || !emailFrom) return
        await transporter.sendMail({
            from: `Wild Grove <${emailFrom}>`,
            to,
            subject,
            html,
        })
    } catch (error) {
        console.error("[email] Failed to send reservation email:", error)
    }
}

// ── Order Email Types & Helpers ────────────────────────────────

export interface OrderEmailData {
    orderNumber: number
    customerName: string
    customerEmail: string
    fulfillment: "PICKUP" | "DELIVERY"
    deliveryAddress?: string | null
    itemsSummary: string     // e.g. "2× Grilled Salmon, 1× House Salad"
    currencySymbol: string   // "S/" or "$"
    total: string            // "45.50"
    documentLabel?: string   // "B001-00000001"
}

function buildDeliveryRow(deliveryAddress: string | null | undefined, isEs: boolean): string {
    if (!deliveryAddress) return ""
    return `<tr><td style="border-top:1px solid #CDD4C7;padding:12px 20px;">
      <span style="font-size:11px;color:#8FA98C;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;display:block;margin-bottom:4px;">${isEs ? "Dirección" : "Address"}</span>
      <span style="font-size:14px;color:#1A1A18;">${escapeHtml(deliveryAddress)}</span>
    </td></tr>`
}

// ── Order email HTML generators ────────────────────────────────

export function orderConfirmationHtml(data: OrderEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    const fulfillmentLabel = data.fulfillment === "PICKUP"
        ? (isEs ? "Recoger en restaurante" : "Pick up at restaurant")
        : (isEs ? "Delivery a domicilio" : "Home delivery")
    return loadEmailTemplate("order-confirmation", {
        GREETING: data.customerName ? (isEs ? `Hola ${escapeHtml(data.customerName)},` : `Hi ${escapeHtml(data.customerName)},`) : (isEs ? "Hola," : "Hello,"),
        ORDER_NUMBER: String(data.orderNumber),
        FULFILLMENT: fulfillmentLabel,
        DELIVERY_ROW: buildDeliveryRow(data.deliveryAddress, isEs),
        ITEMS_SUMMARY: data.itemsSummary,
        CURRENCY_SYMBOL: data.currencySymbol,
        TOTAL: data.total,
        DOCUMENT_LABEL: data.documentLabel ?? (isEs ? "Boleta" : "Boleta"),
    }, locale)
}

export function orderAdminNewHtml(data: OrderEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    const fulfillmentLabel = data.fulfillment === "PICKUP"
        ? (isEs ? "Recoger en restaurante" : "Pick up")
        : (isEs ? "Delivery" : "Delivery")
    return loadEmailTemplate("order-admin-new", {
        ORDER_NUMBER: String(data.orderNumber),
        CUSTOMER_NAME: escapeHtml(data.customerName),
        FULFILLMENT: fulfillmentLabel,
        ITEMS_SUMMARY: data.itemsSummary,
        CURRENCY_SYMBOL: data.currencySymbol,
        TOTAL: data.total,
        ADMIN_ORDER_URL: cmsLink("/orders"),
    }, locale)
}

export interface ProductReviewInviteEmailData {
    orderNumber: number
    customerName: string
    items: Array<{ name: string; imageUrl: string | null }>
}

export function productReviewInviteHtml(data: ProductReviewInviteEmailData, locale: "en" | "es" = "en"): string {
    const isEs = locale === "es"
    const itemsList = data.items
        .map((it) => {
            const safeName = escapeHtml(it.name)
            const image = it.imageUrl
                ? `<img src="${it.imageUrl}" alt="" width="40" height="40" style="display:block;border-radius:6px;object-fit:cover;border:1px solid #CDD4C7;" />`
                : `<span style="display:inline-block;width:40px;height:40px;border-radius:6px;background-color:#CDD4C7;"></span>`
            return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px;">
                <tr>
                    <td style="padding-right:12px;vertical-align:middle;">${image}</td>
                    <td style="vertical-align:middle;font-size:14px;color:#1A1A18;font-weight:500;">${safeName}</td>
                </tr>
            </table>`
        })
        .join("")
    return loadEmailTemplate("product-review-invite", {
        GREETING: data.customerName
            ? (isEs ? `Hola ${escapeHtml(data.customerName)},` : `Hi ${escapeHtml(data.customerName)},`)
            : (isEs ? "Hola," : "Hello,"),
        ORDER_NUMBER: String(data.orderNumber),
        ITEMS_LIST: itemsList,
    }, locale)
}

// ── Generic send helper for order emails ──────────────────────

export async function sendOrderEmail(
    to: string,
    subject: string,
    html: string,
    pdfAttachment?: { filename: string; content: Buffer } | null,
): Promise<void> {
    try {
        if (!to.trim()) return
        const transporter = await createTransporter()
        const emailFrom = await getEmailFrom()
        if (!transporter || !emailFrom) return
        await transporter.sendMail({
            from: `Wild Grove <${emailFrom}>`,
            to,
            subject,
            html,
            ...(pdfAttachment
                ? {
                      attachments: [
                          {
                              filename: pdfAttachment.filename,
                              content: pdfAttachment.content,
                              contentType: "application/pdf",
                          },
                      ],
                  }
                : {}),
        })
    } catch (error) {
        console.error("[email] Failed to send order email:", error)
    }
}

// ── Link Email Verification ─────────────────────────────────────
// Sent when a user requests to link their email as a sign-in method.

export function linkEmailVerificationHtml(firstName: string, magicLink: string, locale: "en" | "es" = "en") {
    return loadEmailTemplate("link-email.html", {
        NAME: firstName,
        LINK: magicLink,
    }, locale)
}

// ── InsForge Auth Hook Email Templates ────────────────────────────
// Used by the Send Email hook to render auth emails via Nodemailer.

// ── Locale Helper ───────────────────────────────────────────────
// Reads Accept-Language from a Request to determine locale.

export function getLocaleFromRequest(req: Request): "en" | "es" {
    const explicit = req.headers.get("x-locale")
    if (explicit === "es" || explicit === "en") return explicit
    const acceptLang = req.headers.get("accept-language") || ""
    return acceptLang.toLowerCase().startsWith("es") ? "es" : "en"
}
