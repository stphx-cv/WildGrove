"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getLimaDayBounds } from "@wildgrove/core/app-datetime-format"

export type DatePreset =
    | "today"
    | "yesterday"
    | "last7d"
    | "last30d"
    | "thisMonth"
    | "lastMonth"
    | "custom"

export interface DateRange {
    from: Date
    to: Date
}

export function getPresetRange(preset: DatePreset): DateRange {
    const now = new Date()
    const { start: todayStart, end: todayEnd } = getLimaDayBounds(now)

    switch (preset) {
        case "today":
            return { from: todayStart, to: todayEnd }
        case "yesterday": {
            const yStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
            return { from: yStart, to: todayStart }
        }
        case "last7d":
            return { from: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000), to: todayEnd }
        case "last30d":
            return { from: new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000), to: todayEnd }
        case "thisMonth": {
            const { start: ms } = getLimaDayBounds(new Date(now.getFullYear(), now.getMonth(), 1))
            return { from: ms, to: todayEnd }
        }
        case "lastMonth": {
            const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const { start: lmStart } = getLimaDayBounds(firstOfLastMonth)
            const { start: lmEnd } = getLimaDayBounds(firstOfThisMonth)
            return { from: lmStart, to: lmEnd }
        }
        default:
            return { from: todayStart, to: todayEnd }
    }
}

const LS_KEY = "wg:dashboard:preset"

export function useDashboardDateRange(defaultPreset: DatePreset = "today") {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [preset, setPresetState] = useState<DatePreset>(() => {
        const urlPreset = searchParams.get("preset") as DatePreset | null
        if (urlPreset) return urlPreset
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(LS_KEY) as DatePreset | null
            if (stored) return stored
        }
        return defaultPreset
    })

    const [customRange, setCustomRange] = useState<DateRange | null>(null)

    const range: DateRange = preset === "custom" && customRange
        ? customRange
        : getPresetRange(preset)

    const setPreset = useCallback((p: DatePreset) => {
        setPresetState(p)
        if (typeof window !== "undefined") localStorage.setItem(LS_KEY, p)
        const params = new URLSearchParams(searchParams.toString())
        params.set("preset", p)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [router, searchParams])

    // Sync preset from URL on mount
    useEffect(() => {
        const urlPreset = searchParams.get("preset") as DatePreset | null
        if (urlPreset && urlPreset !== preset) setPresetState(urlPreset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const rangeQuery = `from=${range.from.toISOString()}&to=${range.to.toISOString()}`

    return { preset, setPreset, range, rangeQuery, setCustomRange }
}
