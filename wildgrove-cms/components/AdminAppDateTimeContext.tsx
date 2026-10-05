"use client"

// ══════════════════════════════════════════════════════════════════
// Admin — CMS date/time display preferences (AppSettings)
// Reads /api/settings through the shared cache, so the settings page and any
// other reader in the same panel load share one request. Refetches when
// settings are saved (wg:admin-settings-updated).
// ══════════════════════════════════════════════════════════════════

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    type ReactNode,
} from "react"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"
import {
    formatAppDate,
    formatAppTime,
    normalizeDateFormatPreference,
    normalizeTimeFormatPreference,
} from "@wildgrove/core/app-datetime-format"

function coerceDate(d: Date | string): Date {
    return typeof d === "string" ? new Date(d) : d
}

export interface AdminAppDateTimeContextValue {
    ready: boolean
    dateFormat: string
    timeFormat: string
    formatDate: (d: Date | string) => string
    formatTime: (d: Date | string) => string
}

const fallback: AdminAppDateTimeContextValue = {
    ready: false,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    formatDate: (d) => formatAppDate(coerceDate(d), "DD/MM/YYYY"),
    formatTime: (d) => formatAppTime(coerceDate(d), "24h"),
}

const AdminAppDateTimeContext = createContext<AdminAppDateTimeContextValue>(fallback)

export function useAdminAppDateTime(): AdminAppDateTimeContextValue {
    return useContext(AdminAppDateTimeContext)
}

type SettingsSlice = { dateFormat?: string; timeFormat?: string }

export function AdminAppDateTimeProvider({ children }: { children: ReactNode }) {
    // An error is not a failure state here: the fallback formats are correct,
    // they are just not the owner's preference, so `ready` flips either way.
    const { data, isLoading } = useCmsQuery<SettingsSlice>("/api/settings")

    useEffect(() => {
        function onUpdated() {
            void invalidateCms("/api/settings")
        }
        window.addEventListener("wg:admin-settings-updated", onUpdated)
        return () => window.removeEventListener("wg:admin-settings-updated", onUpdated)
    }, [])

    const value = useMemo<AdminAppDateTimeContextValue>(() => {
        const df = normalizeDateFormatPreference(data?.dateFormat)
        const tf = normalizeTimeFormatPreference(data?.timeFormat)
        return {
            ready: !isLoading,
            dateFormat: df,
            timeFormat: tf,
            formatDate: (d) => formatAppDate(coerceDate(d), df),
            formatTime: (d) => formatAppTime(coerceDate(d), tf),
        }
    }, [isLoading, data?.dateFormat, data?.timeFormat])

    return <AdminAppDateTimeContext.Provider value={value}>{children}</AdminAppDateTimeContext.Provider>
}
