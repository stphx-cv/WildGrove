"use client"

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { CategoryRevenue } from "@/lib/admin/dashboard-types"

const COLORS = ["#5a7a4a", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"]

interface Props {
    data: CategoryRevenue[]
}

export function CategoriesPie({ data }: Props) {
    if (data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-sm text-wg-muted dark:text-wg-dark-muted">
                No category data
            </div>
        )
    }

    const total = data.reduce((s, d) => s + d.revenue, 0)
    const summary = data.map((d) => `${d.name}: S/${d.revenue.toFixed(2)}`).join(", ")

    return (
        <figure role="img" aria-label={`Revenue by category: ${summary}`} className="h-52">
            <figcaption className="sr-only">Revenue by category: {summary}</figcaption>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        paddingAngle={2}
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(rawValue, name) => {
                            const value = Number(rawValue)
                            return [`S/${value.toFixed(2)} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, String(name)]
                        }}
                        contentStyle={{
                            backgroundColor: "var(--wg-chart-surface, #fff)",
                            color: "var(--wg-chart-text, #111827)",
                            border: "1px solid var(--wg-chart-border, #e5e7eb)",
                            borderRadius: "8px",
                            fontSize: 12,
                        }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--wg-chart-text, #111827)" }} />
                </PieChart>
            </ResponsiveContainer>
            <table className="sr-only">
                <caption>Revenue by Category</caption>
                <thead><tr><th>Category</th><th>Revenue</th></tr></thead>
                <tbody>
                    {data.map((r) => (
                        <tr key={r.categoryId}><td>{r.name}</td><td>S/{r.revenue.toFixed(2)}</td></tr>
                    ))}
                </tbody>
            </table>
        </figure>
    )
}
