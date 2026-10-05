"use client"

// ══════════════════════════════════════════════════════════════════
// Admin Wallet Detail — /wallets/[profileId]
// Two wallet cards (PEN/USD), recharge / deduct / set-balance modals (OWNER only),
// paginated ledger (OWNER may delete rows / clear history — balances unchanged)
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { DataTable, type Column } from "@/components/DataTable"
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/Pagination"
import { AdminSelect } from "@/components/AdminSelect"
import { AdminNumberInput } from "@/components/AdminNumberInput"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useAdminAppDateTime } from "@/components/AdminAppDateTimeContext"
import { LoadingState } from "@/components/LoadingState"
import { Textarea } from "@wildgrove/ui/Textarea"
import { useCmsQuery } from "@/lib/cms-query"
import { ArrowLeftIcon, TrashSlatsIcon } from "@wildgrove/ui/icons"

// ── Types ──

interface PerformerInfo {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
}

interface TxRow {
    id: string
    type: string
    direction: string
    currency: string
    amount: string
    balanceAfter: string
    reference: string | null
    note: string | null
    createdAt: string
    performer: PerformerInfo | null
}

interface WalletInfo {
    id: string
    currency: string
    balance: string
    isActive: boolean
    updatedAt: string
}

interface ProfileInfo {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    avatarUrl: string | null
    role: string
    createdAt: string
}

interface WalletDetailData {
    profile: ProfileInfo
    wallets: { PEN: WalletInfo | null; USD: WalletInfo | null }
    ledger: {
        currency: string
        transactions: TxRow[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
    }
}

// ── Transaction type labels and colors ──

const TX_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    RECHARGE:      { label: "Recharge",   color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" },
    ADJUST_ADD:    { label: "Adjust +",   color: "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20" },
    ADJUST_DEDUCT: { label: "Adjust −",   color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
    ADJUST_SET:    { label: "Set balance", color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20" },
    PURCHASE:      { label: "Purchase",   color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
    REFUND:        { label: "Refund",     color: "text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20" },
    INITIAL_BALANCE: { label: "Initial balance", color: "text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20" },
}

// ── Helpers ──

function generateIdempotencyKey(): string {
    return `recharge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Wallet Card ──

function WalletCard({
    wallet,
    currency,
    isOwner,
    onAction,
    formatDate,
}: {
    wallet: WalletInfo | null
    currency: "PEN" | "USD"
    isOwner: boolean
    onAction: (type: "recharge" | "deduct" | "set", currency: "PEN" | "USD") => void
    formatDate: (d: Date | string) => string
}) {
    const symbol = currency === "PEN" ? "S/" : "$"
    const balance = wallet?.balance ?? "0.00"
    const isEmpty = parseFloat(balance) === 0

    return (
        <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-wg-accent dark:text-wg-dark-accent">{symbol}</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">{currency}</p>
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{currency === "PEN" ? "Peruvian Sol" : "US Dollar"}</p>
                    </div>
                </div>
                {wallet && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wallet.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-wg-border/30 text-wg-muted dark:bg-wg-dark-border/30 dark:text-wg-dark-muted"}`}>
                        {wallet.isActive ? "Active" : "Inactive"}
                    </span>
                )}
            </div>

            <div>
                <p className={`font-display text-3xl font-bold tabular-nums ${isEmpty ? "text-wg-muted dark:text-wg-dark-muted" : "text-wg-text dark:text-wg-dark-text"}`}>
                    {symbol} {balance}
                </p>
                {wallet && (
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
                        Last update: {formatDate(wallet.updatedAt)}
                    </p>
                )}
                {!wallet && (
                    <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">No wallet created yet</p>
                )}
            </div>

            {isOwner && (
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-wg-border/30 dark:border-wg-dark-border/50">
                    <button
                        type="button"
                        onClick={() => onAction("recharge", currency)}
                        className="h-8 px-1.5 sm:px-2 text-[11px] sm:text-xs font-medium rounded-brand border border-emerald-700/40 dark:border-emerald-500/35 bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:border-emerald-600/60 dark:hover:border-emerald-400/45 transition-colors"
                    >
                        Recharge
                    </button>
                    <button
                        type="button"
                        onClick={() => onAction("set", currency)}
                        className="h-8 px-1.5 sm:px-2 text-[11px] sm:text-xs font-medium rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition-opacity"
                    >
                        Set balance
                    </button>
                    <button
                        type="button"
                        onClick={() => onAction("deduct", currency)}
                        className="h-8 px-1.5 sm:px-2 text-[11px] sm:text-xs font-medium rounded-brand border border-rose-600/50 dark:border-rose-500/40 bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:border-rose-600 dark:hover:border-rose-500 transition-colors"
                    >
                        Deduct
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Main Page ──

export default function AdminWalletDetailPage() {
    const { profileId } = useParams<{ profileId: string }>()
    const { formatDate, formatTime } = useAdminAppDateTime()

    const [data, setData] = useState<WalletDetailData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    // Shared with every other `/api/role` reader in the panel: one request,
    // and it no longer runs before the wallet's own query as it used to.
    const { data: roleData } = useCmsQuery<{ role?: "ADMIN" | "OWNER" }>("/api/role")
    const isOwner = roleData?.role === "OWNER"
    const [ledgerCurrency, setLedgerCurrency] = useState<"PEN" | "USD" | "ALL">("PEN")
    const [ledgerPage, setLedgerPage] = useState(1)

    // Recharge modal state
    const [rechargeOpen, setRechargeOpen] = useState(false)
    const [rechargeCurrency, setRechargeCurrency] = useState<"PEN" | "USD">("PEN")
    const [rechargeAmount, setRechargeAmount] = useState("")
    const [rechargeNote, setRechargeNote] = useState("")
    const [rechargeLoading, setRechargeLoading] = useState(false)
    const [rechargeError, setRechargeError] = useState("")

    // Deduct modal (subtract — uses negative delta; cannot go below 0)
    const [deductModalOpen, setDeductModalOpen] = useState(false)
    const [deductCurrency, setDeductCurrency] = useState<"PEN" | "USD">("PEN")
    const [deductAmount, setDeductAmount] = useState("")
    const [deductNote, setDeductNote] = useState("")
    const [deductLoading, setDeductLoading] = useState(false)
    const [deductError, setDeductError] = useState("")

    // Set balance modal (exact target balance)
    const [setBalModalOpen, setSetBalModalOpen] = useState(false)
    const [setBalCurrency, setSetBalCurrency] = useState<"PEN" | "USD">("PEN")
    const [setBalTarget, setSetBalTarget] = useState("")
    const [setBalNote, setSetBalNote] = useState("")
    const [setBalLoading, setSetBalLoading] = useState(false)
    const [setBalError, setSetBalError] = useState("")

    const [confirmDeleteTx, setConfirmDeleteTx] = useState<TxRow | null>(null)
    const [deleteTxLoadingId, setDeleteTxLoadingId] = useState<string | null>(null)
    const [clearLedgerOpen, setClearLedgerOpen] = useState(false)
    const [clearLedgerLoading, setClearLedgerLoading] = useState(false)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                currency: ledgerCurrency,
                page: String(ledgerPage),
                limit: String(DEFAULT_PAGE_SIZE),
            })
            const res = await fetch(`/api/wallets/${profileId}?${params}`)
            const json = await res.json()
            if (json.success) {
                setData(json.data)
            }
        } catch (error) {
            console.error("Failed to fetch wallet data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [profileId, ledgerCurrency, ledgerPage])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setLedgerPage(1) }, [ledgerCurrency])

    useEffect(() => {
        const p = data?.ledger.pagination
        if (!p || p.totalPages < 1) return
        if (p.page > p.totalPages) {
            setLedgerPage(p.totalPages)
        }
    }, [data?.ledger.pagination])

    const handleConfirmDeleteTx = useCallback(async () => {
        if (!confirmDeleteTx) return
        setDeleteTxLoadingId(confirmDeleteTx.id)
        try {
            const res = await fetch(`/api/wallets/${profileId}/transactions/${confirmDeleteTx.id}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!res.ok) {
                console.error(json.error ?? "Delete failed")
                return
            }
            setConfirmDeleteTx(null)
            await fetchData()
        } catch (e) {
            console.error(e)
        } finally {
            setDeleteTxLoadingId(null)
        }
    }, [confirmDeleteTx, profileId, fetchData])

    const handleClearAllLedger = useCallback(async () => {
        setClearLedgerLoading(true)
        try {
            const res = await fetch(`/api/wallets/${profileId}/transactions`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!res.ok) {
                console.error(json.error ?? "Clear failed")
                return
            }
            setClearLedgerOpen(false)
            setLedgerPage(1)
            await fetchData()
        } catch (e) {
            console.error(e)
        } finally {
            setClearLedgerLoading(false)
        }
    }, [profileId, fetchData])

    function handleOpenAction(type: "recharge" | "deduct" | "set", currency: "PEN" | "USD") {
        if (type === "recharge") {
            setRechargeCurrency(currency)
            setRechargeAmount("")
            setRechargeNote("")
            setRechargeError("")
            setRechargeOpen(true)
        } else if (type === "deduct") {
            setDeductCurrency(currency)
            setDeductAmount("")
            setDeductNote("")
            setDeductError("")
            setDeductModalOpen(true)
        } else {
            setSetBalCurrency(currency)
            setSetBalTarget("")
            setSetBalNote("")
            setSetBalError("")
            setSetBalModalOpen(true)
        }
    }

    async function handleRecharge() {
        const amount = parseFloat(rechargeAmount)
        if (!rechargeAmount || isNaN(amount) || amount <= 0) {
            setRechargeError("Enter a valid positive amount.")
            return
        }
        setRechargeLoading(true)
        setRechargeError("")
        try {
            const res = await fetch(`/api/wallets/${profileId}/recharge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currency: rechargeCurrency,
                    amount,
                    note: rechargeNote.trim() || undefined,
                    idempotencyKey: generateIdempotencyKey(),
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                setRechargeError(json.error ?? "Failed to recharge.")
                return
            }
            setRechargeOpen(false)
            await fetchData()
        } catch {
            setRechargeError("Network error. Please try again.")
        } finally {
            setRechargeLoading(false)
        }
    }

    async function handleDeduct() {
        const amount = parseFloat(deductAmount)
        if (!deductAmount || isNaN(amount) || amount <= 0) {
            setDeductError("Enter a valid positive amount.")
            return
        }
        setDeductLoading(true)
        setDeductError("")
        try {
            const res = await fetch(`/api/wallets/${profileId}/adjust`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currency: deductCurrency,
                    delta: -amount,
                    note: deductNote.trim() || undefined,
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                setDeductError(json.error ?? "Failed to deduct.")
                return
            }
            setDeductModalOpen(false)
            await fetchData()
        } catch {
            setDeductError("Network error. Please try again.")
        } finally {
            setDeductLoading(false)
        }
    }

    async function handleSetBalanceSubmit() {
        const raw = parseFloat(setBalTarget)
        if (setBalTarget.trim() === "" || Number.isNaN(raw) || raw < 0) {
            setSetBalError("Enter a valid balance (0 or greater).")
            return
        }
        setSetBalLoading(true)
        setSetBalError("")
        try {
            const res = await fetch(`/api/wallets/${profileId}/set-balance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currency: setBalCurrency,
                    balance: raw,
                    note: setBalNote.trim() || undefined,
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                setSetBalError(json.error ?? "Failed to set balance.")
                return
            }
            setSetBalModalOpen(false)
            await fetchData()
        } catch {
            setSetBalError("Network error. Please try again.")
        } finally {
            setSetBalLoading(false)
        }
    }

    const txColumns: Column<TxRow>[] = useMemo(() => {
        const currencyCol: Column<TxRow> | null =
            ledgerCurrency === "ALL"
                ? {
                      key: "currency",
                      label: "Currency",
                      className: "w-[4.5rem]",
                      render: (item) => (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-wg-muted dark:text-wg-dark-muted">
                              {item.currency}
                          </span>
                      ),
                  }
                : null

        const cols: Column<TxRow>[] = [
            ...(currencyCol ? [currencyCol] : []),
            {
                key: "type",
                label: "Type",
                render: (item) => {
                    const cfg = TX_TYPE_CONFIG[item.type] ?? { label: item.type, color: "text-wg-muted bg-wg-border/20" }
                    return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            {cfg.label}
                        </span>
                    )
                },
            },
            {
                key: "amount",
                label: "Amount",
                render: (item) => {
                    const sym = item.currency === "PEN" ? "S/" : "$"
                    const isCredit = item.direction === "CREDIT"
                    return (
                        <span className={`font-semibold tabular-nums text-sm ${isCredit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {isCredit ? "+" : "−"}{sym} {item.amount}
                        </span>
                    )
                },
            },
            {
                key: "balanceAfter",
                label: "Balance After",
                className: "hidden sm:table-cell",
                render: (item) => {
                    const sym = item.currency === "PEN" ? "S/" : "$"
                    return (
                        <span className="text-sm tabular-nums text-wg-muted dark:text-wg-dark-muted">
                            {sym} {item.balanceAfter}
                        </span>
                    )
                },
            },
            {
                key: "performer",
                label: "By",
                className: "hidden md:table-cell",
                render: (item) => {
                    if (!item.performer) return <span className="text-xs text-wg-muted dark:text-wg-dark-muted">System</span>
                    const name = [item.performer.firstName, item.performer.lastName].filter(Boolean).join(" ")
                        || item.performer.email || "Staff"
                    return <span className="text-xs text-wg-muted dark:text-wg-dark-muted truncate block max-w-[120px]">{name}</span>
                },
            },
            {
                key: "note",
                label: "Note",
                className: "hidden lg:table-cell",
                render: (item) => (
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted line-clamp-1 max-w-[160px]">
                        {item.note || "—"}
                    </span>
                ),
            },
            {
                key: "createdAt",
                label: "Date",
                render: (item) => (
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted tabular-nums whitespace-nowrap">
                        {formatDate(new Date(item.createdAt))} · {formatTime(new Date(item.createdAt))}
                    </span>
                ),
            },
            ...(isOwner
                ? [
                      {
                          key: "actions",
                          label: "",
                          className: "w-12 text-right",
                          render: (item: TxRow) => (
                              <button
                                  type="button"
                                  onClick={(e) => {
                                      e.stopPropagation()
                                      setConfirmDeleteTx(item)
                                  }}
                                  disabled={deleteTxLoadingId === item.id}
                                  className="inline-flex items-center justify-center p-1.5 rounded-brand border border-transparent text-wg-muted hover:text-red-600 hover:bg-red-500/10 hover:border-red-500/25 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                                  aria-label="Delete ledger entry"
                              >
                                  <TrashSlatsIcon className="w-4 h-4" aria-hidden />
                              </button>
                          ),
                      } as Column<TxRow>,
                  ]
                : []),
        ]
        return cols
    }, [ledgerCurrency, formatDate, formatTime, isOwner, deleteTxLoadingId])

    if (isLoading && !data) {
        return (
            <LoadingState size="page" message="Loading wallet…" />
        )
    }

    if (!data) {
        return (
            <div className="space-y-4">
                <Link href="/wallets" className="inline-flex items-center gap-1.5 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors">
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to Wallets
                </Link>
                <p className="text-wg-muted dark:text-wg-dark-muted">Wallet not found.</p>
            </div>
        )
    }

    const { profile, wallets, ledger } = data
    const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Unknown"

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            <Link href="/wallets" className="inline-flex items-center gap-1.5 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors">
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Wallets
            </Link>

            {/* Profile header */}
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {profile.avatarUrl ? (
                        <FadeInImage
                            src={profile.avatarUrl}
                            alt=""
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-lg font-bold text-wg-accent dark:text-wg-dark-accent">
                            {(profile.firstName?.[0] ?? profile.email?.[0] ?? "?").toUpperCase()}
                        </span>
                    )}
                </div>
                <div>
                    <h1 className="font-display text-2xl font-bold text-wg-text dark:text-wg-dark-text">{profileName}</h1>
                    <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">{profile.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-wg-border/30 dark:bg-wg-dark-border/30 text-wg-muted dark:text-wg-dark-muted">
                            {profile.role}
                        </span>
                        <Link
                            href={`/customers/${profile.id}`}
                            className="text-xs text-wg-accent dark:text-wg-dark-accent hover:underline"
                        >
                            View profile
                        </Link>
                    </div>
                </div>
            </div>

            {/* Wallet cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <WalletCard
                    wallet={wallets.PEN}
                    currency="PEN"
                    isOwner={isOwner}
                    onAction={handleOpenAction}
                    formatDate={formatDate}
                />
                <WalletCard
                    wallet={wallets.USD}
                    currency="USD"
                    isOwner={isOwner}
                    onAction={handleOpenAction}
                    formatDate={formatDate}
                />
            </div>

            {/* Ledger */}
            <div className="space-y-4">
                <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">Transaction History</h2>
                        <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                            {isOwner
                                ? "Ledger records only — removing entries does not change current wallet balances."
                                : "Immutable ledger of all wallet operations"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {isOwner && (
                            <button
                                type="button"
                                onClick={() => setClearLedgerOpen(true)}
                                disabled={ledger.pagination.total === 0}
                                className="h-9 px-3 text-xs font-medium rounded-brand border border-red-500/35 text-red-700 bg-transparent hover:bg-red-500/10 dark:text-red-400 dark:border-red-500/40 dark:hover:bg-red-500/10 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
                            >
                                Clear all history
                            </button>
                        )}
                        <AdminSelect
                            value={ledgerCurrency}
                            onChange={(v) => setLedgerCurrency(v as "PEN" | "USD" | "ALL")}
                            required
                            options={[
                                { value: "ALL", label: "All — PEN + USD" },
                                { value: "PEN", label: "PEN — Soles" },
                                { value: "USD", label: "USD — Dollars" },
                            ]}
                            className="w-52 sm:w-56"
                        />
                    </div>
                </div>

                <DataTable
                    columns={txColumns}
                    data={ledger.transactions}
                    isLoading={isLoading}
                    loadingMessage="Loading transactions…"
                    emptyMessage="No transactions yet"
                />

                <Pagination
                    currentPage={ledger.pagination.page}
                    totalPages={ledger.pagination.totalPages}
                    totalItems={ledger.pagination.total}
                    onPageChange={setLedgerPage}
                />
            </div>

            {/* Recharge Modal */}
            {rechargeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !rechargeLoading) setRechargeOpen(false) }}>
                    <div className="w-full max-w-md rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6 space-y-5">
                        <div>
                            <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">Recharge {rechargeCurrency} Wallet</h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                                Add balance to {profileName}&apos;s {rechargeCurrency} wallet. Logged and cannot be undone.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Amount ({rechargeCurrency})</p>
                                <AdminNumberInput value={rechargeAmount} onChange={setRechargeAmount} min={0.01} max={99999.99} step={1} decimals={2} prefix={rechargeCurrency === "PEN" ? "S/" : "$"} placeholder="0.00" nullable className="w-full" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Note (optional)</p>
                                <Textarea
                                    maxHeight={160} value={rechargeNote} onChange={setRechargeNote} placeholder="Reason for recharge…" minRows={2} maxLength={280}
                                    className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50" />
                            </div>
                            {rechargeError && <p className="text-xs text-red-600 dark:text-red-400">{rechargeError}</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setRechargeOpen(false)} disabled={rechargeLoading} className="h-9 px-4 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:border-wg-accent/50 transition-colors disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={() => void handleRecharge()} disabled={rechargeLoading} className="h-9 px-4 text-sm font-medium rounded-brand bg-emerald-700 text-white shadow-sm shadow-emerald-950/20 ring-1 ring-inset ring-white/10 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:shadow-emerald-950/35 dark:ring-white/5 transition-colors disabled:opacity-50">
                                {rechargeLoading ? "Processing…" : "Recharge"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deduct Modal */}
            {deductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !deductLoading) setDeductModalOpen(false) }}>
                    <div className="w-full max-w-md rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6 space-y-5">
                        <div>
                            <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">Deduct from {deductCurrency} Wallet</h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                                Subtract balance from {profileName}&apos;s {deductCurrency} wallet. Balance cannot go below zero. Logged in the transaction history.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Amount ({deductCurrency})</p>
                                <AdminNumberInput value={deductAmount} onChange={setDeductAmount} min={0.01} max={99999.99} step={1} decimals={2} prefix={deductCurrency === "PEN" ? "S/" : "$"} placeholder="0.00" nullable className="w-full" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Note (optional)</p>
                                <Textarea
                                    maxHeight={160} value={deductNote} onChange={setDeductNote} placeholder="Reason for deduction…" minRows={2} maxLength={280}
                                    className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-rose-600/35 dark:focus:ring-rose-500/35" />
                            </div>
                            {deductError && <p className="text-xs text-red-600 dark:text-red-400">{deductError}</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setDeductModalOpen(false)} disabled={deductLoading} className="h-9 px-4 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:border-wg-accent/50 transition-colors disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={() => void handleDeduct()} disabled={deductLoading} className="h-9 px-4 text-sm font-medium rounded-brand bg-rose-700 text-white shadow-sm shadow-rose-950/25 ring-1 ring-inset ring-white/10 hover:bg-rose-600 dark:bg-[#9F4A4A] dark:hover:bg-[#B55858] dark:shadow-rose-950/40 dark:ring-white/5 transition-colors disabled:opacity-50">
                                {deductLoading ? "Processing…" : "Deduct"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Set balance Modal */}
            {setBalModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !setBalLoading) setSetBalModalOpen(false) }}>
                    <div className="w-full max-w-md rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6 space-y-5">
                        <div>
                            <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text">Set {setBalCurrency} Wallet Balance</h2>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1">
                                Set {profileName}&apos;s {setBalCurrency} wallet to an exact balance (not added or subtracted). Logged in the transaction history.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">New balance ({setBalCurrency})</p>
                                <AdminNumberInput value={setBalTarget} onChange={setSetBalTarget} min={0} max={99999.99} step={1} decimals={2} prefix={setBalCurrency === "PEN" ? "S/" : "$"} placeholder="0.00" nullable className="w-full" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text mb-2">Note (optional)</p>
                                <Textarea
                                    maxHeight={160} value={setBalNote} onChange={setSetBalNote} placeholder="Reason for balance change…" minRows={2} maxLength={280}
                                    className="px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-wg-accent/50 dark:focus:ring-wg-dark-accent/50" />
                            </div>
                            {setBalError && <p className="text-xs text-red-600 dark:text-red-400">{setBalError}</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setSetBalModalOpen(false)} disabled={setBalLoading} className="h-9 px-4 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text hover:border-wg-accent/50 transition-colors disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={() => void handleSetBalanceSubmit()} disabled={setBalLoading} className="h-9 px-4 text-sm font-medium rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition-opacity disabled:opacity-50">
                                {setBalLoading ? "Processing…" : "Set balance"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmDeleteTx !== null}
                onClose={() => { if (!deleteTxLoadingId) setConfirmDeleteTx(null) }}
                onConfirm={() => { void handleConfirmDeleteTx() }}
                title="Delete ledger entry?"
                message={
                    confirmDeleteTx
                        ? `${TX_TYPE_CONFIG[confirmDeleteTx.type]?.label ?? confirmDeleteTx.type} · ${confirmDeleteTx.currency} · ${
                              confirmDeleteTx.currency === "PEN" ? "S/" : "$"
                          }${confirmDeleteTx.amount}. This removes the record from the database only. Current wallet balances are not changed.`
                        : ""
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={deleteTxLoadingId !== null}
            />

            <ConfirmDialog
                isOpen={clearLedgerOpen}
                onClose={() => { if (!clearLedgerLoading) setClearLedgerOpen(false) }}
                onConfirm={() => { void handleClearAllLedger() }}
                title="Clear all transaction history?"
                message={`Permanently delete every ledger entry for ${profileName} (PEN and USD wallets). Current wallet balances are not changed.`}
                confirmLabel="Clear all"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={clearLedgerLoading}
            />
        </div>
    )
}
