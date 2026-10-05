// ══════════════════════════════════════════════════════════════════
// POST /api/chat/reservation
// Creates a reservation from the Sage in-chat form flow.
// Requires auth | fetches name/email from profile (no need to pass them).
// Returns reservation data + a saved chat message with the reservation card.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { saveMessage } from "@wildgrove/core/chat/session"
import { toClientMessage } from "@wildgrove/core/chat/client-message"
import {
  sendReservationEmail,
  reservationPendingHtml,
  reservationAdminNewHtml,
  getAdminEmail,
} from "@wildgrove/core/email"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"
import { broadcastAdminReservationCreated } from "@wildgrove/core/admin/reservationsRealtime"
import { getAppSettings } from "@wildgrove/core/settings"
import { isSlotPastBookingCutoff, isValidSlotForSchedule } from "@wildgrove/core/reservation-schedule"
import { isCalendarDateAfterMaxBookable } from "@wildgrove/core/reservation-dates-lima"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"
import { occupyReservationSlot } from "@wildgrove/core/reservation-occupy"
import { enforceLimit, emailLimiter, getClientIp } from "@wildgrove/core/rate-limit"

const schema = z.object({
  sessionKey: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  guests: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
  locale: z.enum(["en", "es"]).optional().default("en"),
})

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const insforge = await createClient()
    const { data: { user } } = await insforge.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: "AUTH_REQUIRED" },
        { status: 401 }
      )
    }

    // Same allowance as the booking form, and the same bucket: every booking
    // sends two emails and takes a seat off the calendar.
    const limited = await enforceLimit(
      emailLimiter,
      `reservation:${getClientIp(request)}:${user.id}`,
    )
    if (limited) return limited

    // ── Parse & validate ──────────────────────────────────────
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const { sessionKey, date, time, guests, notes, locale } = parsed.data

    const settings = await getAppSettings()
    if (settings.chatMode === "off") {
      return NextResponse.json({ success: false, error: "chat_off" }, { status: 403 })
    }
    const { advanceReservationMs, maxPartySize } = settings
    if (guests > maxPartySize) {
      return NextResponse.json(
        {
          success: false,
          error:
            locale === "es"
              ? `El máximo de personas por reserva es ${maxPartySize}.`
              : `Maximum party size is ${maxPartySize}.`,
        },
        { status: 400 }
      )
    }

    // ── Get profile (name + email for emails) ─────────────────
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true, email: true, phoneNumber: true, phoneCountryCode: true },
    })
    if (!profile?.email) {
      return NextResponse.json(
        { success: false, error: "Profile not found. Please complete your account setup." },
        { status: 400 }
      )
    }

    const name =
      `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "Customer"

    // ── Availability check ────────────────────────────────────
    // Lima = UTC-5, no DST
    const slotStart = limaSlotStart(date, time)
    const nowMs = Date.now()

    if (slotStart.getTime() <= nowMs) {
      return NextResponse.json(
        { success: false, error: locale === "es"
            ? "No puedes reservar en el pasado."
            : "Cannot book a reservation in the past." },
        { status: 400 }
      )
    }

    if (isCalendarDateAfterMaxBookable(date, settings.maxDaysAhead)) {
      return NextResponse.json(
        {
          success: false,
          error: locale === "es"
            ? "La fecha está fuera del plazo de reservas permitido."
            : "Selected date is beyond the current booking window.",
        },
        { status: 400 }
      )
    }

    const slotIsAllowed = isValidSlotForSchedule({
      date,
      time,
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
      timeSlotIncrement: settings.timeSlotIncrement,
      operatingDays: settings.operatingDays,
      closedTimeRanges: settings.closedTimeRanges,
    })
    if (!slotIsAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: locale === "es"
            ? "La fecha u hora elegida está fuera de los días y horarios de atención."
            : "Selected date/time is outside current booking schedule.",
        },
        { status: 400 }
      )
    }

    if (isSlotPastBookingCutoff(date, time, advanceReservationMs, nowMs)) {
      return NextResponse.json(
        { success: false, error: locale === "es"
            ? "No cumple con el tiempo mínimo de anticipación requerido. Por favor elige otro horario."
            : "Does not meet the minimum advance notice required. Please choose a later time." },
        { status: 400 }
      )
    }

    // ── Create reservation, if the slot still has a table ─────
    const occupied = await occupyReservationSlot({
      settings,
      slotStart,
      write: (tx) => tx.reservation.create({
        data: {
          profileId: user.id,
          date: slotStart,
          partySize: guests,
          notes: notes || null,
          status: "PENDING",
          locale,
        },
        select: {
          id: true,
          date: true,
          partySize: true,
          notes: true,
          status: true,
        },
      }),
    })

    if (!occupied.occupied) {
      return NextResponse.json(
        { success: false, error: locale === "es"
            ? "Este horario está lleno. Por favor elige otro."
            : "This time slot is fully booked. Please try a different time." },
        { status: 409 }
      )
    }
    const reservation = occupied.value

    // ── Admin notification (fire and forget) ──────────────────
    createAdminNotificationForAllAdmins({
      type: "RESERVATION_CREATED",
      entityType: "RESERVATION",
      entityId: reservation.id,
      title: "New reservation received (via Sage form)",
      message: `${name} requested a table for ${guests} ${guests === 1 ? "person" : "people"} via chat form.`,
      href: `/reservations/${reservation.id}`,
      metadata: {
        reservationId: reservation.id,
        profileId: user.id,
        partySize: guests,
        date: slotStart.toISOString(),
        source: "sage_form",
      },
    }).catch(() => {})

    broadcastAdminReservationCreated(reservation.id).catch(() => {})

    // ── Confirmation emails ───────────────────────────────────
    // Not awaited, as the booking form and checkout do: the reservation is
    // already saved, and a mail server that does not answer must not hold the
    // response.
    const customerEmail = profile.email
    sendReservationEmail(
      customerEmail,
      locale === "es"
        ? "Solicitud de reserva recibida | Wild Grove"
        : "Reservation Request Received | Wild Grove",
      reservationPendingHtml(
        {
          name,
          date: slotStart,
          partySize: guests,
          reservationId: reservation.id,
          notes: notes || null,
        },
        locale
      )
    ).catch((emailErr) => {
      console.error("[chat/reservation] Customer email failed:", emailErr)
    })

    const submittedAt = new Date()
    getAdminEmail()
      .then((adminEmail) => sendReservationEmail(
        adminEmail,
        `New Reservation | ${name} · ${guests} ${guests === 1 ? "person" : "people"}`,
        reservationAdminNewHtml(
          {
            customerName: name,
            customerEmail,
            customerPhone: profile.phoneNumber
              ? `${profile.phoneCountryCode ?? ""}${profile.phoneNumber}`.trim()
              : null,
            date: slotStart,
            partySize: guests,
            reservationId: reservation.id,
            notes: notes || null,
            submittedAt,
          },
          "en"
        )
      ))
      .catch((emailErr) => {
        console.error("[chat/reservation] Admin email failed:", emailErr)
      })

    // ── Save confirmation message to chat session ─────────────
    // Best-effort | the reservation is already created, this just
    // adds the card to the chat history so it persists on reload.
    let savedMessage = null
    try {
      const session = await prisma.chatSession.findFirst({
        where: { sessionKey, profileId: user.id },
        select: { id: true },
      })
      if (session) {
        const reservationJson = JSON.stringify({
          id: reservation.id,
          date: reservation.date.toISOString(),
          partySize: reservation.partySize,
          notes: reservation.notes,
          status: reservation.status,
        })
        const confirmText =
          locale === "es"
            ? `Recibimos tu solicitud de reserva. Te enviamos un correo con sus datos.\n\`\`\`reservation\n${reservationJson}\n\`\`\``
            : `We received your reservation request. We've emailed you its details.\n\`\`\`reservation\n${reservationJson}\n\`\`\``

        savedMessage = toClientMessage(await saveMessage(session.id, "ASSISTANT", confirmText, "AI"))
      }
    } catch {
      // silent | chat message persistence is best-effort
    }

    return NextResponse.json({
      success: true,
      data: {
        reservation: {
          id: reservation.id,
          date: reservation.date.toISOString(),
          partySize: reservation.partySize,
          notes: reservation.notes,
          status: reservation.status,
        },
        message: savedMessage,
      },
    })
  } catch (error) {
    console.error("[chat/reservation]", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
