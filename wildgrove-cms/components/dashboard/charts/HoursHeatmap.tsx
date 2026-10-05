"use client"

import type { HourlyHeatCell } from "@/lib/admin/dashboard-types"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getIntensity(value: number, max: number): number {
    if (max === 0) return 0
    return Math.round((value / max) * 100)
}

interface Props {
    data: HourlyHeatCell[]
}

export function HoursHeatmap({ data }: Props) {
    const cellMap = new Map<string, number>()
    for (const cell of data) {
        cellMap.set(`${cell.day}-${cell.hour}`, cell.revenue)
    }
    const max = Math.max(0, ...data.map((c) => c.revenue))

    return (
        <div className="overflow-x-auto">
            <table
                className="text-[10px] border-separate border-spacing-0.5"
                aria-label="Revenue heatmap by day and hour (last 7 days)"
            >
                <caption className="sr-only">Revenue heatmap — last 7 days × 24 hours. Higher intensity = more revenue.</caption>
                <thead>
                    <tr>
                        <th scope="col" className="w-8" />
                        {HOURS.filter((h) => h % 3 === 0).map((h) => (
                            <th
                                key={h}
                                scope="col"
                                colSpan={3}
                                className="text-center font-normal text-wg-muted dark:text-wg-dark-muted pb-1"
                            >
                                {String(h).padStart(2, "0")}h
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {DAYS.map((day, di) => (
                        <tr key={day}>
                            <th
                                scope="row"
                                className="text-right pr-1.5 font-normal text-wg-muted dark:text-wg-dark-muted w-8 whitespace-nowrap"
                            >
                                {day}
                            </th>
                            {HOURS.map((hour) => {
                                const value = cellMap.get(`${di}-${hour}`) ?? 0
                                const intensity = getIntensity(value, max)
                                return (
                                    <td
                                        key={hour}
                                        className="w-4 h-4 rounded-sm transition-opacity"
                                        style={{
                                            backgroundColor: `color-mix(in srgb, var(--wg-chart-accent, #5a7a4a) ${intensity}%, transparent)`,
                                            opacity: intensity === 0 ? 0.15 : undefined,
                                        }}
                                        aria-label={`${day} ${String(hour).padStart(2, "0")}:00, S/${value.toFixed(0)}`}
                                        title={`${day} ${String(hour).padStart(2, "0")}:00 — S/${value.toFixed(2)}`}
                                    />
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
