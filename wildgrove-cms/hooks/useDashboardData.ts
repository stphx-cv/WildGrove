"use client"

// ══════════════════════════════════════════════════════════════════
// The dashboard sections' polling read.
//
// Kept as its own hook because the sections want `lastUpdatedAt` and a plain
// `error` string, but the fetching, the deduplication and the interval are
// `swr`'s now (D6): four sections polling four endpoints used to mean four
// hand-rolled abort controllers and four timers.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react"
import { useCmsQuery } from "@/lib/cms-query"

interface UseDashboardDataOptions {
    endpoint: string
    intervalMs: number
    enabled?: boolean
}

interface UseDashboardDataResult<T> {
    data: T | null
    isLoading: boolean
    error: string | null
    lastUpdatedAt: Date | null
    refresh: () => void
}

export function useDashboardData<T>({
    endpoint,
    intervalMs,
    enabled = true,
}: UseDashboardDataOptions): UseDashboardDataResult<T> {
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

    const onSuccess = useCallback(() => setLastUpdatedAt(new Date()), [])

    const { data, error, isLoading, mutate } = useCmsQuery<T>(enabled ? endpoint : null, {
        refreshInterval: intervalMs,
        // The old hook skipped its timer tick while the tab was hidden and
        // refetched when it came back. These two options are the same policy.
        refreshWhenHidden: false,
        revalidateOnFocus: true,
        onSuccess,
    })

    const refresh = useCallback(() => {
        void mutate()
    }, [mutate])

    return {
        data: data ?? null,
        isLoading,
        error: error ? error.message : null,
        lastUpdatedAt,
        refresh,
    }
}
