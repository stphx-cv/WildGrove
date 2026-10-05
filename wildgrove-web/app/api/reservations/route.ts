// ══════════════════════════════════════════════════════════════════
// POST /api/reservations
// Creates a reservation, validates discount codes server-side,
// re-checks availability, then sends confirmation emails.
//
// The name and the address on the confirmation come from the profile that
// booked, the same way the in-chat flow does it: a reservation belongs to an
// account, and the mail about it goes to that account's inbox.
// ══════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/server"
import { sendReservationEmail, reservationPendingHtml, reservationAdminNewHtml, getAdminEmail, getLocaleFromRequest } from "@wildgrove/core/email"
import { createAdminNotificationForAllAdmins } from "@wildgrove/core/admin-notifications"
import { broadcastAdminReservationCreated } from "@wildgrove/core/admin/reservationsRealtime"
import { getAppSettings } from "@wildgrove/core/settings"
import { reservationSlotRejection, reservationSlotRejectionResponse } from "@wildgrove/core/reservation-schedule"
import { limaSlotStart } from "@wildgrove/core/reservation-capacity"
import { getSlotCapacity } from "@wildgrove/core/reservation-capacity-query"
import { occupyReservationSlot } from "@wildgrove/core/reservation-occupy"
import { discountValueForCurrency } from "@wildgrove/core/menu-discounts"
import { enforceLimit, emailLimiter, getClientIp } from "@wildgrove/core/rate-limit"


import type { ApiResponse } from "@wildgrove/core/types"

const reservationSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
    partySize: z.number().int().min(1),
    phone: z.string().optional(),
    notes: z.string().max(500).optional(),
    discountCode: z.string().optional(),
})

interface ReservationResult {
    reservationId: string
    discountApplied?: {
        name: string
        description: string | null
        valueType: string
        value: number
        currency: string
    }
}

export async function POST(request: Request) {
    // The booking form sends the page's language; every answer below uses it.
    const locale = getLocaleFromRequest(request)
    const es = locale === "es"
    try {
        // ── 0. Authenticate ───────────────────────────────────────
        const insforge = await createClient()
        const { data: { user: authUser } } = await insforge.auth.getUser()
        if (!authUser) {
            const response: ApiResponse = { success: false, error: es ? "Inicia sesión para reservar." : "Authentication required" }
            return NextResponse.json(response, { status: 401 })
        }

        // Every booking sends two emails and takes a seat off the calendar.
        const limited = await enforceLimit(
            emailLimiter,
            `reservation:${getClientIp(request)}:${authUser.id}`,
        )
        if (limited) return limited

        // ── 1. Parse & validate ─────────────────────────────────
        const body = await request.json()
        const parsed = reservationSchema.safeParse(body)

        if (!parsed.success) {
            const response: ApiResponse = {
                success: false,
                error: es ? "Los datos de la reserva no son válidos." : parsed.error.issues[0]?.message ?? "Invalid input",
            }
            return NextResponse.json(response, { status: 400 })
        }

        const { date, time, partySize, phone, notes, discountCode } =
            parsed.data

        // ── 1b. Who booked ──────────────────────────────────────
        const profile = await prisma.profile.findUnique({
            where: { id: authUser.id },
            select: { firstName: true, lastName: true, email: true },
        })
        if (!profile?.email) {
            const response: ApiResponse = {
                success: false,
                error: es
                    ? "No encontramos tu perfil. Completa la configuración de tu cuenta."
                    : "Profile not found. Please complete your account setup.",
            }
            return NextResponse.json(response, { status: 400 })
        }
        const email = profile.email
        const name = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "Customer"

        // ── 2. Re-check availability (never trust client) ───────
        const settings = await getAppSettings()

        // The browser filters these slots out, and this is the endpoint that must not
        // trust it. With advance notice disabled the last check reduces to "not in
        // the past".
        const rejection = reservationSlotRejection(settings, { date, time, partySize })
        if (rejection) {
            const { error, status } = reservationSlotRejectionResponse(rejection, settings.maxPartySize, locale)
            const response: ApiResponse = { success: false, error }
            return NextResponse.json(response, { status })
        }

        const slotStart = limaSlotStart(date, time)

        // An early answer, so a full slot is reported before the promo code is
        // looked at. The count that decides is the one under the slot lock.
        const { available } = await getSlotCapacity({ settings, date, time })

        if (!available) {
            const response: ApiResponse = {
                success: false,
                error: es
                    ? "Este horario está lleno. Por favor elige otro."
                    : "This time slot is fully booked. Please try a different time.",
            }
            return NextResponse.json(response, { status: 409 })
        }

        // ── 3. Validate discount code (if provided) ─────────────
        let discountApplied: ReservationResult["discountApplied"] = undefined

        if (discountCode) {
            const discount = await prisma.discount.findFirst({
                where: {
                    code: discountCode.toUpperCase(),
                    active: true,
                },
            })

            if (!discount) {
                const response: ApiResponse = {
                    success: false,
                    error: es ? "Este código promocional no es válido o ha expirado." : "This promo code is not valid or has expired.",
                }
                return NextResponse.json(response, { status: 400 })
            }

            // Check date range
            const now = new Date()
            if (discount.validFrom && now < discount.validFrom) {
                const response: ApiResponse = {
                    success: false,
                    error: es ? "Este código promocional todavía no está activo." : "This promo code is not active yet.",
                }
                return NextResponse.json(response, { status: 400 })
            }
            if (discount.validUntil && now > discount.validUntil) {
                const response: ApiResponse = {
                    success: false,
                    error: es ? "Este código promocional ha expirado." : "This promo code has expired.",
                }
                return NextResponse.json(response, { status: 400 })
            }

            // Check usage limits
            if (
                discount.usageLimit !== null &&
                discount.usageCount >= discount.usageLimit
            ) {
                const response: ApiResponse = {
                    success: false,
                    error: es ? "Este código promocional alcanzó su límite de usos." : "This promo code has reached its usage limit.",
                }
                return NextResponse.json(response, { status: 400 })
            }

            discountApplied = {
                name: discount.name,
                description: discount.description,
                valueType: discount.valueType,
                value: discount.valueType === "PERCENTAGE"
                    ? Number(discount.value)
                    : discountValueForCurrency(
                        {
                            valueType: "FIXED_AMOUNT",
                            value: Number(discount.value),
                            valueUsd: discount.valueUsd == null ? null : Number(discount.valueUsd),
                        },
                        settings.defaultCurrency,
                    ),
                currency: settings.defaultCurrency,
            }
        }

        // ── 4. Create reservation ────────────────────────────────
        const profileId = authUser.id

        const occupied = await occupyReservationSlot({
            settings,
            slotStart,
            write: (tx) => tx.reservation.create({
                data: {
                    profileId,
                    date: slotStart,
                    partySize,
                    notes: notes || null,
                    status: "PENDING",
                    locale,
                },
                select: {
                    id: true,
                },
            }),
        })

        if (!occupied.occupied) {
            const response: ApiResponse = {
                success: false,
                error: es
                    ? "Este horario está lleno. Por favor elige otro."
                    : "This time slot is fully booked. Please try a different time.",
            }
            return NextResponse.json(response, { status: 409 })
        }
        const reservation = occupied.value

        createAdminNotificationForAllAdmins({
            type: "RESERVATION_CREATED",
            entityType: "RESERVATION",
            entityId: reservation.id,
            title: "New reservation received",
            message: `${name} requested a table for ${partySize} ${partySize === 1 ? "person" : "people"}.`,
            href: `/reservations/${reservation.id}`,
            metadata: {
                reservationId: reservation.id,
                profileId,
                partySize,
                date: slotStart.toISOString(),
            },
        }).catch((notifyError) => {
            console.error("[reservations] Notification error:", notifyError)
        })

        broadcastAdminReservationCreated(reservation.id).catch((err) =>
            console.error("[reservations] Realtime broadcast error:", err)
        )

        // ── 5. Record discount usage ─────────────────────────────
        if (discountCode && discountApplied) {
            const discount = await prisma.discount.findFirst({
                where: { code: discountCode.toUpperCase() },
                select: { id: true },
            })

            if (discount) {
                await prisma.$transaction([
                    prisma.discountApplication.create({
                        data: {
                            discountId: discount.id,
                            profileId,
                            reservationId: reservation.id,
                        },
                    }),
                    prisma.discount.update({
                        where: { id: discount.id },
                        data: { usageCount: { increment: 1 } },
                    }),
                ])
            }
        }

        // ── 6. Send confirmation emails ──────────────────────────
        // Not awaited, as checkout does: the reservation is already saved, and a
        // mail server that does not answer must not hold the response.

        // ── 6b. Send customer confirmation email ─────────────────
        sendReservationEmail(
            email,
            locale === "es" ? "Solicitud de reserva recibida | Wild Grove" : "Reservation Request Received | Wild Grove",
            reservationPendingHtml({
                name,
                date: slotStart,
                partySize,
                reservationId: reservation.id,
                notes: notes || null,
                discount: discountApplied,
            }, locale)
        ).catch((emailError) => {
            console.error("[reservations] Customer email failed:", emailError)
        })

        // ── 6c. Send admin notification email ────────────────────
        const submittedAt = new Date()
        getAdminEmail()
            .then((adminEmail) => sendReservationEmail(
                adminEmail,
                `New Reservation | ${name} · ${partySize} ${partySize === 1 ? "person" : "people"}`,
                reservationAdminNewHtml({
                    customerName: name,
                    customerEmail: email,
                    customerPhone: phone || null,
                    date: slotStart,
                    partySize,
                    reservationId: reservation.id,
                    notes: notes || null,
                    discount: discountApplied,
                    submittedAt,
                }, "en")
            ))
            .catch((emailError) => {
                console.error("[reservations] Admin email failed:", emailError)
            })

        // ── 7. Return success ────────────────────────────────────
        const result: ReservationResult = {
            reservationId: reservation.id,
            discountApplied,
        }

        const response: ApiResponse<ReservationResult> = {
            success: true,
            data: result,
        }
        return NextResponse.json(response, { status: 201 })
    } catch (error) {
        console.error("[reservations]", error)
        const response: ApiResponse = {
            success: false,
            error: es ? "Error interno del servidor." : "Internal server error",
        }
        return NextResponse.json(response, { status: 500 })
    }
}
