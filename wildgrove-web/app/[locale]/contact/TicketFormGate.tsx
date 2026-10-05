"use client"

import { useTranslations } from "next-intl"
import { TicketForm } from "@/components/forms/TicketForm"
import { AuthGate } from "@/components/auth/AuthGate"
import { Skeleton } from "@/components/ui/Skeleton"
import { useFormUser } from "@wildgrove/core/hooks/useFormUser"

function FormSkeleton() {
    return (
        <div className="space-y-5 animate-pulse">
            <Skeleton className="h-10 w-full rounded-brand" />
            <Skeleton className="h-10 w-full rounded-brand" />
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full rounded-brand" />
                <Skeleton className="h-10 w-full rounded-brand" />
            </div>
            <Skeleton className="h-28 w-full rounded-brand" />
            <Skeleton className="h-11 w-full rounded-brand" />
        </div>
    )
}

/**
 * Resolves the signed-in user in the browser (via useFormUser) so the /contact
 * page no longer reads auth cookies on the server — keeping it statically
 * rendered and prefetchable.
 */
export function TicketFormGate() {
    const t = useTranslations("contact")
    const { user, loading } = useFormUser()

    if (loading) return <FormSkeleton />

    return (
        <AuthGate
            isAuthenticated={!!user}
            title={t("authGateTitle")}
            description={t("authGateDescription")}
            returnPath="/contact"
        >
            <TicketForm user={user} />
        </AuthGate>
    )
}
