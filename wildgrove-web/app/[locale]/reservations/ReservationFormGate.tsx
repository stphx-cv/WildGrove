"use client"

import { useTranslations } from "next-intl"
import { ReservationForm } from "@/components/forms/ReservationForm"
import { AuthGate } from "@/components/auth/AuthGate"
import { Skeleton } from "@/components/ui/Skeleton"
import { useFormUser } from "@wildgrove/core/hooks/useFormUser"
import type { ClosedTimeRange } from "@wildgrove/core/reservation-schedule"

type ReservationFormGateProps = {
    calendarEventLocation?: string | null
    advanceNoticeMs: number
    maxPartySize: number
    largeGroupWarningFrom: number
    timeSlotIncrement: number
    operatingDays: string
    openingTime: string
    closingTime: string
    maxDaysAhead: number
    closedTimeRanges: ClosedTimeRange[]
    displayTimeFormat: "12h" | "24h"
}

function FormSkeleton() {
    return (
        <div className="space-y-5 animate-pulse">
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full rounded-brand" />
                <Skeleton className="h-10 w-full rounded-brand" />
            </div>
            <Skeleton className="h-10 w-full rounded-brand" />
            <Skeleton className="h-10 w-full rounded-brand" />
            <Skeleton className="h-28 w-full rounded-brand" />
            <Skeleton className="h-11 w-full rounded-brand" />
        </div>
    )
}

/**
 * Resolves the signed-in user in the browser (via useFormUser) so the
 * /reservations page no longer reads auth cookies on the server — keeping it
 * statically rendered and prefetchable. Settings come from the server page
 * (cache-backed getAppSettings, not a dynamic API).
 */
export function ReservationFormGate({
    calendarEventLocation,
    advanceNoticeMs,
    maxPartySize,
    largeGroupWarningFrom,
    timeSlotIncrement,
    operatingDays,
    openingTime,
    closingTime,
    maxDaysAhead,
    closedTimeRanges,
    displayTimeFormat,
}: ReservationFormGateProps) {
    const t = useTranslations("reservations")
    const { user, loading } = useFormUser()

    if (loading) return <FormSkeleton />

    return (
        <AuthGate
            isAuthenticated={!!user}
            title={t("authGateTitle")}
            description={t("authGateDescription")}
            returnPath="/reservations"
        >
            <ReservationForm
                user={user}
                advanceNoticeMs={advanceNoticeMs}
                maxPartySize={maxPartySize}
                largeGroupWarningFrom={largeGroupWarningFrom}
                timeSlotIncrement={timeSlotIncrement}
                operatingDays={operatingDays}
                openingTime={openingTime}
                closingTime={closingTime}
                maxDaysAhead={maxDaysAhead}
                closedTimeRanges={closedTimeRanges}
                displayTimeFormat={displayTimeFormat}
                calendarEventLocation={calendarEventLocation ?? null}
            />
        </AuthGate>
    )
}
