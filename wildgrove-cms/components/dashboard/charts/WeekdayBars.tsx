"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { WeekdayBar } from "@/lib/admin/dashboard-types"

interface Props {
    data: WeekdayBar[]
}

export function WeekdayBars({ data }: Props) {
    const summary = data.map((d) => `${d.day}: ${d.orders} orders`).join(", ")

    return (
        <figure role="img" aria-label={`Orders by weekday: ${summary}`} className="h-52">
            <figcaption className="sr-only">Orders by day of week: {summary}</figcaption>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--wg-chart-border, #e5e7eb)" opacity={0.5} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--wg-chart-muted, #6b7280)" }} stroke="var(--wg-chart-muted, #6b7280)" />
                    <YAxis tick={{ fontSize: 11, fill: "var(--wg-chart-muted, #6b7280)" }} stroke="var(--wg-chart-muted, #6b7280)" />
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
                            return name === "orders" ? [value, "Orders"] : [`S/${value.toFixed(2)}`, "Revenue"]
                        }}
                    />
                    <Bar dataKey="orders" fill="var(--wg-chart-accent, #5a7a4a)" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            <table className="sr-only">
                <caption>Orders by Day of Week</caption>
                <thead><tr><th>Day</th><th>Orders</th><th>Revenue</th></tr></thead>
                <tbody>
                    {data.map((r) => (
                        <tr key={r.day}><td>{r.day}</td><td>{r.orders}</td><td>S/{r.revenue.toFixed(2)}</td></tr>
                    ))}
                </tbody>
            </table>
        </figure>
    )
}
