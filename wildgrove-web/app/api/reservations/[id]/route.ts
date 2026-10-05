// ══════════════════════════════════════════════════════════════════
// PATCH /api/reservations/[id]
// Cancel or reschedule a reservation owned by the authenticated user.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import {
    sendReservationEmail,
    reservationCancelledHtml,
    reservationRescheduledHtml,
    reservationAdminCancelledHtml,
    reservationAdminRescheduledHtml,
    getAdminEmail,
    getLocaleFromRequest,
} from "@wildgrove/core/email"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"
import { broadcastAdminReservationUpdated } from "@wildgrove/core/admin/reservationsRealtime"
import { getAppSettings } from "@wildgrove/core/settings"
import { reservationSlotRejection, reservationSlotRejectionResponse } from "@wildgrove/core/reservation-schedule"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"
import { getSlotCapacity } from "@wildgrove/core/reservation-capacity-query"
import { occupyReservationSlot } from "@wildgrove/core/reservation-occupy"
import type { ApiResponse } from "@wildgrove/core/types"

const bodySchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("cancel") }),
    z.object({ action: z.literal("hide") }),
    z.object({
        action: z.literal("rename"),
        nickname: z.string().max(60).nullable(),
    }),
    z.object({
        action: z.literal("reschedule"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
        partySize: z.number().int().min(1).max(50).optional(),
    }),
])

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // ── Auth ─────────────────────────────────────────────────
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()
        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Authentication required" },
                { status: 401 }
            )
        }

        const { id } = await params

        // ── Verify ownership & status ─────────────────────────────
        const reservation = await prisma.reservation.findUnique({
            where: { id },
            select: {
                id: true,
                profileId: true,
                status: true,
                date: true,
                partySize: true,
                notes: true,
                profile: { select: { name: true, firstName: true, email: true } },
            },
        })

        if (!reservation) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Reservation not found" },
                { status: 404 }
            )
        }
        if (reservation.profileId !== user.id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Forbidden" },
                { status: 403 }
            )
        }

        // ── Parse body ────────────────────────────────────────────
        const body = await request.json()
        const parsed = bodySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            )
        }

        // ── Hide (works for any status | admin still sees it) ─────
        if (parsed.data.action === "hide") {
            await prisma.reservation.update({
                where: { id },
                data: { hiddenByUser: true },
            })
            return NextResponse.json<ApiResponse>({ success: true })
        }

        // ── Rename (user-defined label, works for any status) ─────
        if (parsed.data.action === "rename") {
            const nickname = parsed.data.nickname?.trim() || null
            await prisma.reservation.update({
                where: { id },
                data: { nickname, adminViewedAt: null },
            })
            broadcastAdminReservationUpdated(id).catch((err) =>
                console.error("[reservations] Realtime broadcast error:", err)
            )
            return NextResponse.json<ApiResponse>({ success: true, data: { nickname } })
        }

        // ── Status check (only for cancel / reschedule) ───────────
        if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: getLocaleFromRequest(request) === "es" ? "Esta reserva ya no se puede modificar." : "This reservation can no longer be modified." },
                { status: 400 }
            )
        }

        // ── Shared email helpers ──────────────────────────────────
        const recipientEmail = reservation.profile?.email ?? user.email ?? null
        const recipientName =
            reservation.profile?.firstName ?? reservation.profile?.name ?? ""

        // ── Cancel ────────────────────────────────────────────────
        if (parsed.data.action === "cancel") {
            if (reservation.status === "CONFIRMED") {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: getLocaleFromRequest(request) === "es" ? "Tu reserva ya está confirmada y no se puede cancelar en línea. Escríbenos desde la página de Contacto." : "Your reservation has already been confirmed and cannot be cancelled online. Please contact us directly." },
                    { status: 400 }
                )
            }

            await prisma.reservation.update({
                where: { id },
                data: { status: "CANCELLED", adminViewedAt: null },
            })

            const cancelledAt = new Date()
            const locale = getLocaleFromRequest(request)

            // Not awaited: the reservation is already cancelled, and a mail
            // server that does not answer must not hold the response.
            if (recipientEmail) {
                sendReservationEmail(
                    recipientEmail,
                    locale === "es" ? "Reserva cancelada | Wild Grove" : "Reservation Cancelled | Wild Grove",
                    reservationCancelledHtml({
                        name: recipientName,
                        date: reservation.date,
                        partySize: reservation.partySize,
                        reservationId: id,
                    }, locale)
                ).catch((emailError) => {
                    console.error("[reservations] Cancel email failed:", emailError)
                })
            }

            getAdminEmail()
                .then((adminEmail) => sendReservationEmail(
                    adminEmail,
                    `Reservation Cancelled | ${recipientName || recipientEmail || id}`,
                    reservationAdminCancelledHtml({
                        customerName: recipientName,
                        customerEmail: recipientEmail ?? "",
                        date: reservation.date,
                        partySize: reservation.partySize,
                        reservationId: id,
                        actionAt: cancelledAt,
                    }, "en")
                ))
                .catch((emailError) => {
                    console.error("[reservations] Admin cancel email failed:", emailError)
                })

            createAdminNotificationForAllAdmins({
                type: "RESERVATION_CANCELLED",
                entityType: "RESERVATION",
                entityId: id,
                title: "Reservation cancelled",
                message: `${recipientName || recipientEmail || "A customer"} cancelled their reservation for ${reservation.partySize} ${reservation.partySize === 1 ? "person" : "people"}.`,
                href: `/reservations/${id}`,
                metadata: { reservationId: id, profileId: reservation.profileId },
            }).catch((e) => console.error("[reservations] Cancel notification error:", e))

            broadcastAdminReservationUpdated(id).catch((err) =>
                console.error("[reservations] Realtime broadcast error:", err)
            )

            return NextResponse.json<ApiResponse>({ success: true })
        }

        // ── Reschedule ────────────────────────────────────────────
        // Like cancelling: once the team has confirmed, changes go through them.
        // Rescheduling would put the reservation back to PENDING, where it could
        // then be cancelled online.
        if (reservation.status === "CONFIRMED") {
            return NextResponse.json<ApiResponse>(
                { success: false, error: getLocaleFromRequest(request) === "es" ? "Tu reserva ya está confirmada y no se puede cambiar en línea. Escríbenos desde la página de Contacto." : "Your reservation has already been confirmed and cannot be changed online. Please contact us directly." },
                { status: 400 }
            )
        }

        const { date, time, partySize: newPartySize } = parsed.data
        const settings = await getAppSettings()
        const slotStart = limaSlotStart(date, time)
        const finalPartySize = newPartySize ?? reservation.partySize

        // The same checks, in the same order and with the same answers, as a new booking.
        const rejection = reservationSlotRejection(settings, { date, time, partySize: finalPartySize })
        if (rejection) {
            const { error, status } = reservationSlotRejectionResponse(rejection, settings.maxPartySize, getLocaleFromRequest(request))
            return NextResponse.json<ApiResponse>({ success: false, error }, { status })
        }

        // The reservation being moved must not count against the slot it moves into.
        // An early answer; the count that decides is the one under the slot lock.
        const { available } = await getSlotCapacity({
            settings,
            date,
            time,
            excludeReservationId: id,
        })

        if (!available) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: getLocaleFromRequest(request) === "es" ? "Este horario está lleno. Por favor elige otro." : "That time slot is fully booked. Please try a different time." },
                { status: 409 }
            )
        }

        const previousDate = reservation.date
        const rescheduleLocale = getLocaleFromRequest(request)

        const occupied = await occupyReservationSlot({
            settings,
            slotStart,
            excludeReservationId: id,
            write: (tx) => tx.reservation.update({
                where: { id },
                data: { date: slotStart, status: "PENDING", partySize: finalPartySize, adminViewedAt: null },
            }),
        })

        if (!occupied.occupied) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: getLocaleFromRequest(request) === "es" ? "Este horario está lleno. Por favor elige otro." : "That time slot is fully booked. Please try a different time." },
                { status: 409 }
            )
        }

        // Not awaited: the new time is already saved, and a mail server that
        // does not answer must not hold the response.
        if (recipientEmail) {
            sendReservationEmail(
                recipientEmail,
                rescheduleLocale === "es" ? "Reserva reprogramada | Wild Grove" : "Reservation Rescheduled | Wild Grove",
                reservationRescheduledHtml({
                    name: recipientName,
                    date: slotStart,
                    partySize: finalPartySize,
                    reservationId: id,
                    notes: reservation.notes,
                    previousDate,
                }, rescheduleLocale)
            ).catch((emailError) => {
                console.error("[reservations] Reschedule email failed:", emailError)
            })
        }

        const rescheduledAt = new Date()
        getAdminEmail()
            .then((adminEmail) => sendReservationEmail(
                adminEmail,
                `Reservation Rescheduled | ${recipientName || recipientEmail || id}`,
                reservationAdminRescheduledHtml({
                    customerName: recipientName,
                    customerEmail: recipientEmail ?? "",
                    date: slotStart,
                    partySize: finalPartySize,
                    reservationId: id,
                    notes: reservation.notes,
                    actionAt: rescheduledAt,
                    previousDate,
                }, "en")
            ))
            .catch((emailError) => {
                console.error("[reservations] Admin reschedule email failed:", emailError)
            })

        createAdminNotificationForAllAdmins({
            type: "RESERVATION_RESCHEDULED",
            entityType: "RESERVATION",
            entityId: id,
            title: "Reservation rescheduled",
            message: `${recipientName || recipientEmail || "A customer"} rescheduled their reservation for ${finalPartySize} ${finalPartySize === 1 ? "person" : "people"}.`,
            href: `/reservations/${id}`,
            metadata: { reservationId: id, profileId: reservation.profileId, newDate: slotStart.toISOString() },
        }).catch((e) => console.error("[reservations] Reschedule notification error:", e))

        broadcastAdminReservationUpdated(id).catch((err) =>
            console.error("[reservations] Realtime broadcast error:", err)
        )

        return NextResponse.json<ApiResponse>({ success: true })
    } catch (error) {
        console.error("[reservations/[id] PATCH]", error)
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Internal server error" },
            { status: 500 }
        )
    }
}

// ══════════════════════════════════════════════════════════════════
// GET /api/reservations/[id]
// Fetches current reservation data for the authenticated owner.
// Used by the in-chat reservation card for live status polling.
// ══════════════════════════════════════════════════════════════════

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const insforge = await createClient()
        const { data: { user } } = await insforge.auth.getUser()
        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Authentication required" },
                { status: 401 }
            )
        }

        const { id } = await params

        const reservation = await prisma.reservation.findUnique({
            where: { id },
            select: { id: true, profileId: true, date: true, partySize: true, notes: true, nickname: true, status: true },
        })

        if (!reservation) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Not found" },
                { status: 404 }
            )
        }

        if (reservation.profileId !== user.id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Forbidden" },
                { status: 403 }
            )
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                id: reservation.id,
                date: reservation.date.toISOString(),
                partySize: reservation.partySize,
                notes: reservation.notes,
                nickname: reservation.nickname,
                status: reservation.status,
            },
        })
    } catch (error) {
        console.error("[reservations/[id] GET]", error)
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Internal server error" },
            { status: 500 }
        )
    }
}
