"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Delivery Zones List — /delivery-zones
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { SearchInput } from "@/components/SearchInput"
import { AdminSelect } from "@/components/AdminSelect"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useCmsQuery, invalidateCms } from "@/lib/cms-query"

// ─── Types ────────────────────────────────────────────────────────

interface ZoneRow {
    id: string
    name: string
    type: "AREA" | "POLYGON" | "RADIUS"
    fee: string
    feeUsd: string
    minOrder: string
    estimatedMinutes: number
    active: boolean
    priority: number
    country: string | null
    region: string | null
    province: string | null
    district: string | null
    createdAt: string
}

interface PaginationData {
    page: number
    limit: number
    total: number
    totalPages: number
}

// ─── Helpers ──────────────────────────────────────────────────────

function areaLabel(zone: ZoneRow) {
    const parts = [zone.district, zone.province, zone.region, zone.country].filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
}

function typeLabel(type: ZoneRow["type"]) {
    return { AREA: "Area", POLYGON: "Polygon", RADIUS: "Radius" }[type]
}

// ─── Page ─────────────────────────────────────────────────────────

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

type ZoneListPayload = { items: ZoneRow[]; pagination: PaginationData }

export default function AdminDeliveryZonesPage() {
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("")
    const [activeFilter, setActiveFilter] = useState("")
    const [page, setPage] = useState(1)
    const [toggleTarget, setToggleTarget] = useState<ZoneRow | null>(null)
    const [isToggling, setIsToggling] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<ZoneRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const listKey = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) })
        if (search) params.set("search", search)
        if (typeFilter) params.set("type", typeFilter)
        if (activeFilter) params.set("active", activeFilter)
        return `/api/delivery-zones?${params}`
    }, [page, search, typeFilter, activeFilter])

    const { data: list, isLoading, mutate: mutateList } = useCmsQuery<ZoneListPayload>(listKey)

    const items = list?.items ?? []
    const pagination = list?.pagination ?? EMPTY_PAGINATION

    const refreshList = useCallback(() => { void invalidateCms("/api/delivery-zones") }, [])

    useEffect(() => { setPage(1) }, [search, typeFilter, activeFilter])

    // ── Toggle active ──

    const handleToggle = useCallback(async () => {
        if (!toggleTarget) return
        setIsToggling(true)
        try {
            const res = await fetch(`/api/delivery-zones/${toggleTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !toggleTarget.active }),
            })
            if (res.ok) {
                // The row stays; only its flag changes.
                void mutateList(
                    (current) =>
                        current && {
                            ...current,
                            items: current.items.map((z) =>
                                z.id === toggleTarget.id ? { ...z, active: !z.active } : z,
                            ),
                        },
                    { revalidate: false },
                )
            }
        } catch (error) {
            console.error("Toggle failed:", error)
        } finally {
            setIsToggling(false)
            setToggleTarget(null)
        }
    }, [toggleTarget, mutateList])

    // ── Delete ──

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/delivery-zones/${deleteTarget.id}`, { method: "DELETE" })
            // The row is gone and so is one from the total: let the server say so.
            if (res.ok) refreshList()
        } catch (error) {
            console.error("Delete failed:", error)
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }, [deleteTarget, refreshList])

    // ── Columns ──

    const columns = useMemo<Column<ZoneRow>[]>(
        () => [
            {
                key: "name",
                label: "Zone name",
                sortable: true,
                render: (z) => (
                    <div>
                        <p className="font-medium text-wg-text dark:text-wg-dark-text">{z.name}</p>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
                            {z.type === "AREA" ? areaLabel(z) : z.type === "RADIUS" ? "Radius zone" : "Polygon zone"}
                        </p>
                    </div>
                ),
            },
            {
                key: "type",
                label: "Type",
                render: (z) => (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-wg-surface dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text border border-wg-border dark:border-wg-dark-border">
                        {typeLabel(z.type)}
                    </span>
                ),
            },
            {
                key: "fee",
                label: "Fee",
                render: (z) => (
                    <div className="text-sm">
                        <span className="text-wg-text dark:text-wg-dark-text">S/ {parseFloat(z.fee).toFixed(2)}</span>
                        <span className="text-wg-muted dark:text-wg-dark-muted"> · </span>
                        <span className="text-wg-text dark:text-wg-dark-text">$ {parseFloat(z.feeUsd).toFixed(2)}</span>
                    </div>
                ),
            },
            {
                key: "estimatedMinutes",
                label: "ETA",
                render: (z) => (
                    <span className="text-sm text-wg-text dark:text-wg-dark-text">{z.estimatedMinutes} min</span>
                ),
                hideOnMobile: true,
            },
            {
                key: "priority",
                label: "Priority",
                sortable: true,
                render: (z) => (
                    <span className="text-sm text-wg-text dark:text-wg-dark-text">{z.priority}</span>
                ),
                hideOnMobile: true,
            },
            {
                key: "active",
                label: "Status",
                render: (z) => <StatusBadge status={z.active ? "ACTIVE" : "INACTIVE"} />,
            },
            {
                key: "actions",
                label: "",
                render: (z) => (
                    <div className="flex items-center gap-2 justify-end">
                        <button
                            onClick={(e) => { e.stopPropagation(); setToggleTarget(z) }}
                            className="px-2.5 py-1.5 text-xs rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                        >
                            {z.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(z) }}
                            className="px-2.5 py-1.5 text-xs rounded-brand border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                ),
            },
        ],
        [],
    )

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">
                        Delivery Zones
                    </h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                        {pagination.total} zone{pagination.total !== 1 ? "s" : ""} configured
                    </p>
                </div>
                <Link
                    href="/delivery-zones/new"
                    className="px-4 py-2.5 rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white text-sm font-semibold transition-all hover:scale-[1.02]"
                >
                    + New zone
                </Link>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                    <SearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder="Search zones…" />
                </div>
                <div className="w-full sm:w-44">
                    <AdminSelect
                        value={typeFilter}
                        onChange={setTypeFilter}
                        placeholder="All types"
                        options={[
                            { value: "AREA", label: "Area" },
                            { value: "POLYGON", label: "Polygon" },
                            { value: "RADIUS", label: "Radius" },
                        ]}
                    />
                </div>
                <div className="w-full sm:w-40">
                    <AdminSelect
                        value={activeFilter}
                        onChange={setActiveFilter}
                        placeholder="All statuses"
                        options={[
                            { value: "true", label: "Active" },
                            { value: "false", label: "Inactive" },
                        ]}
                    />
                </div>
            </div>

            {/* ── Table ── */}
            <DataTable
                columns={columns}
                data={items}
                isLoading={isLoading}
                loadingMessage="Loading delivery zones…"
                rowHref={(z) => `/delivery-zones/${z.id}`}
                emptyMessage="No delivery zones found"
                emptyAction={{ label: "Create first zone", href: "/delivery-zones/new" }}
            />

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && (
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={setPage}
                />
            )}

            {/* ── Toggle confirm ── */}
            <ConfirmDialog
                isOpen={!!toggleTarget}
                title={toggleTarget?.active ? "Deactivate zone" : "Activate zone"}
                message={`${toggleTarget?.active ? "Deactivate" : "Activate"} "${toggleTarget?.name}"?`}
                confirmLabel={toggleTarget?.active ? "Deactivate" : "Activate"}
                variant={toggleTarget?.active ? "warning" : "danger"}
                isLoading={isToggling}
                onConfirm={handleToggle}
                onClose={() => setToggleTarget(null)}
            />

            {/* ── Delete confirm ── */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete delivery zone"
                message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={handleDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    )
}
