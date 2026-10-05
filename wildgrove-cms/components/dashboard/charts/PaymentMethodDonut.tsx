"use client"

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { PaymentMethodBreakdown } from "@/lib/admin/dashboard-types"

const COLORS = ["#5a7a4a", "#3b82f6", "#f59e0b", "#8b5cf6"]

const METHOD_LABELS: Record<string, string> = {
    WALLET: "Wallet",
    MANUAL: "Manual",
}

interface Props {
    data: PaymentMethodBreakdown[]
}

export function PaymentMethodDonut({ data }: Props) {
    const summary = data.map((d) => `${METHOD_LABELS[d.method] ?? d.method}: ${d.pct}%`).join(", ")

    if (data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-sm text-wg-muted dark:text-wg-dark-muted">
                No payment data
            </div>
        )
    }

    const displayData = data.map((d) => ({ ...d, label: METHOD_LABELS[d.method] ?? d.method }))

    return (
        <figure role="img" aria-label={`Payment methods: ${summary}`} className="h-52">
            <figcaption className="sr-only">Payment methods breakdown: {summary}</figcaption>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={displayData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                    >
                        {displayData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(rawValue, name) => [`${Number(rawValue)} orders`, String(name)]}
                        contentStyle={{
                            backgroundColor: "var(--wg-chart-surface, #fff)",
                            color: "var(--wg-chart-text, #111827)",
                            border: "1px solid var(--wg-chart-border, #e5e7eb)",
                            borderRadius: "8px",
                            fontSize: 12,
                        }}
                    />
                    <Legend
                        formatter={(value, entry) => {
                            const pct = (entry.payload as (PaymentMethodBreakdown & { label: string }) | undefined)?.pct ?? 0
                            return `${value} (${pct}%)`
                        }}
                        wrapperStyle={{ fontSize: 11, color: "var(--wg-chart-text, #111827)" }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <table className="sr-only">
                <caption>Payment Method Breakdown</caption>
                <thead><tr><th>Method</th><th>Orders</th><th>Percentage</th></tr></thead>
                <tbody>
                    {displayData.map((r) => (
                        <tr key={r.method}><td>{r.label}</td><td>{r.count}</td><td>{r.pct}%</td></tr>
                    ))}
                </tbody>
            </table>
        </figure>
    )
}
