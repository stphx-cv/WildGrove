"use client"

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import type { DailyRevenue } from "@/lib/admin/dashboard-types"

interface Props {
    data: DailyRevenue[]
}

export function RevenueLineChart({ data }: Props) {
    const summary = data.length > 0
        ? `Revenue trend over ${data.length} days. Peak PEN: S/${Math.max(...data.map((d) => d.revenuePen)).toFixed(2)}.`
        : "No revenue data for this period."

    return (
        <figure role="img" aria-label={summary} className="h-64">
            <figcaption className="sr-only">{summary}</figcaption>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--wg-chart-border, #e5e7eb)" opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--wg-chart-muted, #6b7280)" }}
                        tickFormatter={(v: string) => v.slice(5)} // "MM-DD"
                        stroke="var(--wg-chart-muted, #6b7280)"
                    />
                    <YAxis
                        yAxisId="pen"
                        orientation="left"
                        tick={{ fontSize: 10, fill: "var(--wg-chart-muted, #6b7280)" }}
                        stroke="var(--wg-chart-muted, #6b7280)"
                        tickFormatter={(v: number) => `S/${v}`}
                        width={52}
                    />
                    <YAxis
                        yAxisId="usd"
                        orientation="right"
                        tick={{ fontSize: 10, fill: "var(--wg-chart-muted, #6b7280)" }}
                        stroke="var(--wg-chart-muted, #6b7280)"
                        tickFormatter={(v: number) => `$${v}`}
                        width={44}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "var(--wg-chart-surface, #fff)",
                            color: "var(--wg-chart-text, #111827)",
                            border: "1px solid var(--wg-chart-border, #e5e7eb)",
                            borderRadius: "8px",
                            fontSize: 12,
                        }}
                        formatter={(rawValue, name) => {
                            const value = Number(rawValue)
                            return name === "PEN" ? [`S/${value.toFixed(2)}`, "PEN"] : [`$${value.toFixed(2)}`, "USD"]
                        }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--wg-chart-text, #111827)" }} />
                    <Line
                        yAxisId="pen"
                        type="monotone"
                        dataKey="revenuePen"
                        name="PEN"
                        stroke="var(--wg-chart-accent, #5a7a4a)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                    <Line
                        yAxisId="usd"
                        type="monotone"
                        dataKey="revenueUsd"
                        name="USD"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>

            {/* Accessible data table for screen readers */}
            <table className="sr-only">
                <caption>Daily Revenue Data</caption>
                <thead><tr><th>Date</th><th>Revenue PEN</th><th>Revenue USD</th><th>Orders</th></tr></thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.date}>
                            <td>{row.date}</td>
                            <td>S/{row.revenuePen.toFixed(2)}</td>
                            <td>${row.revenueUsd.toFixed(2)}</td>
                            <td>{row.orderCount}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    )
}
