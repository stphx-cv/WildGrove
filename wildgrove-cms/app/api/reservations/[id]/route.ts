// ══════════════════════════════════════════════════════════════════
// Admin Reservation Detail API | GET + PATCH + DELETE
// /api/reservations/[id]
// ══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@wildgrove/db"
import { requireAdmin } from "@/lib/admin-auth"
import { updateReservationSchema } from "@wildgrove/core/admin-validation"

import {
    sendReservationEmail,
    reservationConfirmedHtml,
    reservationCompletedHtml,
    reservationRescheduledHtml,
    reservationAdminConfirmedHtml,
    getAdminEmail,
} from "@wildgrove/core/email"
import { broadcastAdminReservationUpdated } from "@wildgrove/core/admin/reservationsRealtime"
import { getAppSettings } from "@wildgrove/core/settings"
import { APP_DATETIME_TIMEZONE } from "@wildgrove/core/app-datetime-format"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"
import { occupyReservationSlot } from "@wildgrove/core/reservation-occupy"
import { reservationSlotRejection, reservationSlotRejectionResponse } from "@wildgrove/core/reservation-schedule"
import { canChangeReservationStatus } from "@wildgrove/core/reservation-status"

/** Statuses that hold a table, and so take a slot. */
const OCCUPYING_STATUSES = ["PENDING", "CONFIRMED"]

/** The Lima calendar date and wall-clock time of a stored instant. */
function limaDateAndTime(instant: Date): { date: string; time: string } {
    return {
        date: instant.toLocaleDateString("en-CA", { timeZone: APP_DATETIME_TIMEZONE }),
        time: instant.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: APP_DATETIME_TIMEZONE,
        }),
    }
}

// ── GET | Full reservation detail ──

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const reservation = await prisma.reservation.findUnique({
            where: { id },
            select: {
                id: true,
                date: true,
                partySize: true,
                notes: true,
                status: true,
                remindedAt: true,
                adminViewedAt: true,
                hiddenByAdmin: true,
                createdAt: true,
                updatedAt: true,
                profile: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phoneCountryCode: true,
                        phoneNumber: true,
                        avatarUrl: true,
                    },
                },
            },
        })

        if (!reservation) {
            return NextResponse.json(
                { success: false, error: "Reservation not found" },
                { status: 404 }
            )
        }

        if (!reservation.adminViewedAt) {
            await prisma.reservation.update({
                where: { id },
                data: { adminViewedAt: new Date() },
            })
        }

        return NextResponse.json({ success: true, data: reservation })
    } catch (error) {
        console.error("[Admin Reservations GET/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch reservation" },
            { status: 500 }
        )
    }
}

// ── PATCH | Update reservation fields ──

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const parsed = updateReservationSchema.parse(body)

        // Notes are the owner's; an ADMIN may still change the date, party size and status.
        if (parsed.notes !== undefined && auth.role !== "OWNER") {
            return NextResponse.json({ success: false, error: "Only the owner can edit reservation notes." }, { status: 403 })
        }

        // Fetch current reservation
        const reservation = await prisma.reservation.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                date: true,
                partySize: true,
                notes: true,
                locale: true,
                profile: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        })

        if (!reservation) {
            return NextResponse.json(
                { success: false, error: "Reservation not found" },
                { status: 404 }
            )
        }

        // Validate status transition if status is being changed
        if (parsed.status && parsed.status !== reservation.status) {
            if (!canChangeReservationStatus(reservation.status, parsed.status)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Cannot transition from ${reservation.status} to ${parsed.status}`,
                    },
                    { status: 400 }
                )
            }
        }

        // Build update data
        const data: Record<string, unknown> = {}
        if (parsed.date !== undefined) data.date = new Date(parsed.date)
        if (parsed.partySize !== undefined) data.partySize = parsed.partySize
        if (parsed.notes !== undefined) data.notes = parsed.notes || null
        if (parsed.status !== undefined) data.status = parsed.status
        if (parsed.hiddenByAdmin !== undefined) data.hiddenByAdmin = parsed.hiddenByAdmin

        const settings = await getAppSettings()
        const finalDate = parsed.date !== undefined ? new Date(parsed.date) : reservation.date
        const finalPartySize = parsed.partySize ?? reservation.partySize
        const finalStatus = parsed.status ?? reservation.status
        const dateChanged = finalDate.getTime() !== reservation.date.getTime()
        const reopened = reservation.status === "CANCELLED" && finalStatus === "PENDING"

        if (parsed.partySize !== undefined && parsed.partySize !== reservation.partySize &&
            parsed.partySize > settings.maxPartySize) {
            const { error, status } = reservationSlotRejectionResponse("PARTY_TOO_LARGE", settings.maxPartySize)
            return NextResponse.json({ success: false, error }, { status })
        }

        // Moving a reservation, or reopening a cancelled one, takes a slot: the
        // same checks as a booking from the storefront, then the count under the
        // slot lock. A reservation that ends up cancelled or completed holds no
        // table, so changing its date takes nothing.
        const takesSlot = (dateChanged || reopened) && OCCUPYING_STATUSES.includes(finalStatus)
        if (takesSlot) {
            const { date, time } = limaDateAndTime(finalDate)
            // An instant between slots (19:10, or seconds past the minute) is not on the grid.
            const rejection = limaSlotStart(date, time).getTime() !== finalDate.getTime()
                ? "OUTSIDE_SCHEDULE"
                : reservationSlotRejection(settings, { date, time, partySize: finalPartySize })
            if (rejection) {
                const { error, status } = reservationSlotRejectionResponse(rejection, settings.maxPartySize)
                return NextResponse.json({ success: false, error }, { status })
            }
        }

        const select = {
            id: true,
            date: true,
            partySize: true,
            notes: true,
            status: true,
            remindedAt: true,
            hiddenByAdmin: true,
            createdAt: true,
            updatedAt: true,
            profile: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phoneCountryCode: true,
                    phoneNumber: true,
                    avatarUrl: true,
                },
            },
        } as const

        let updated
        if (takesSlot) {
            const occupied = await occupyReservationSlot({
                settings,
                slotStart: finalDate,
                excludeReservationId: id,
                write: (tx) => tx.reservation.update({ where: { id }, data, select }),
            })
            if (!occupied.occupied) {
                return NextResponse.json(
                    { success: false, error: "That time slot is fully booked. Please choose a different time." },
                    { status: 409 }
                )
            }
            updated = occupied.value
        } else {
            updated = await prisma.reservation.update({ where: { id }, data, select })
        }

        // Send emails for status changes
        const customerName = `${reservation.profile?.firstName ?? ""} ${reservation.profile?.lastName ?? ""}`.trim()
        const customerLocale = (reservation.locale === "es" ? "es" : "en") as "en" | "es"
        if (parsed.status === "CONFIRMED" && parsed.status !== reservation.status) {
            const confirmedDate = parsed.date ? new Date(parsed.date) : reservation.date

            if (reservation.profile?.email) {
                sendReservationEmail(
                    reservation.profile.email,
                    customerLocale === "es"
                        ? "Reserva confirmada | Wild Grove"
                        : "Reservation Confirmed | Wild Grove",
                    reservationConfirmedHtml({
                        name: reservation.profile.firstName ?? customerName,
                        date: confirmedDate,
                        partySize: parsed.partySize ?? reservation.partySize,
                        reservationId: id,
                        notes: reservation.notes,
                    }, customerLocale)
                ).catch((err) => console.error("[Admin] Confirmation email to customer failed:", err))
            }

            sendReservationEmail(
                await getAdminEmail(),
                "Reservation Confirmed | Wild Grove",
                reservationAdminConfirmedHtml({
                    customerName,
                    customerEmail: reservation.profile?.email ?? "",
                    date: confirmedDate,
                    partySize: parsed.partySize ?? reservation.partySize,
                    reservationId: id,
                    notes: reservation.notes,
                    actionAt: new Date(),
                })
            ).catch((err) => console.error("[Admin] Confirmation email to staff failed:", err))
        }

        // A new date on a reservation that stands reaches the customer the way a
        // reschedule from the storefront does. Staff made the change, so staff get
        // no copy.
        if (dateChanged && OCCUPYING_STATUSES.includes(finalStatus) && reservation.profile?.email) {
            sendReservationEmail(
                reservation.profile.email,
                customerLocale === "es"
                    ? "Reserva reprogramada | Wild Grove"
                    : "Reservation Rescheduled | Wild Grove",
                reservationRescheduledHtml({
                    name: reservation.profile.firstName ?? customerName,
                    date: finalDate,
                    partySize: finalPartySize,
                    reservationId: id,
                    notes: updated.notes,
                    previousDate: reservation.date,
                }, customerLocale)
            ).catch((err) => console.error("[Admin] Reschedule email to customer failed:", err))
        }

        if (parsed.status === "COMPLETED" && parsed.status !== reservation.status) {
            if (reservation.profile?.email) {
                sendReservationEmail(
                    reservation.profile.email,
                    customerLocale === "es"
                        ? "Reserva completada | Wild Grove"
                        : "Reservation Completed | Wild Grove",
                    reservationCompletedHtml({
                        name: reservation.profile.firstName ?? customerName,
                        date: reservation.date,
                        partySize: reservation.partySize,
                        reservationId: id,
                        notes: reservation.notes,
                    }, customerLocale)
                ).catch((err) => console.error("[Admin] Completed thank-you email failed:", err))
            }
        }

        broadcastAdminReservationUpdated(id).catch((err) =>
            console.error("[Admin Reservations PATCH/:id] Realtime broadcast error:", err)
        )

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: error },
                { status: 400 }
            )
        }
        console.error("[Admin Reservations PATCH/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update reservation" },
            { status: 500 }
        )
    }
}

// ── DELETE | Permanently delete a reservation ──

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const reservation = await prisma.reservation.findUnique({
            where: { id },
            select: { id: true },
        })

        if (!reservation) {
            return NextResponse.json(
                { success: false, error: "Reservation not found" },
                { status: 404 }
            )
        }

        await prisma.reservation.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Admin Reservations DELETE/:id] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete reservation" },
            { status: 500 }
        )
    }
}
