"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer"
import type { FulfillmentMethod, OrderStatus } from "@wildgrove/db"
import { createClient } from "@wildgrove/core/clients/client"
import {
  USER_ORDERS_REALTIME_EVENT,
  userOrdersChannelName,
  type UserOrderStatusPayload,
} from "@wildgrove/core/orders/userOrdersRealtimeShared"
import { publicOrderDocumentPdfUrl } from "@wildgrove/core/pdf/orderDocumentPdfUrl"
import { PDF_DOWNLOAD_LINK_CLASSNAME } from "@wildgrove/core/pdf/pdfDownloadLinkClassName"
import { ArrowDownTrayIcon, ClipboardListIcon, DocumentIcon, Spinner } from "@wildgrove/ui/icons"

interface OrderRow {
  id: string
  orderNumber: number
  status: string
  fulfillment: string
  currency: string
  total: string
  createdAt: string
  documentType: string
  documentSeries: string | null
  documentNumber: string | null
  items: { nameSnapshot: string; quantity: number }[]
}

interface OrdersListProps {
  profileId: string
  initialOrders: OrderRow[]
  initialTotal: number
  locale: string
}

type FilterKey = "all" | "active" | "completed" | "cancelled"

const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "PREPARING", "READY", "OUT_FOR_DELIVERY"]
const COMPLETED_STATUSES: OrderStatus[] = ["COMPLETED"]
const CANCELLED_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"]
const PER_PAGE = 20

export function OrdersList({ profileId, initialOrders, initialTotal, locale }: OrdersListProps) {
  const t = useTranslations("orders")
  const tStatus = useTranslations("orders.status")
  const tFulfillment = useTranslations("orders.fulfillment")

  const [allOrders, setAllOrders] = useState<OrderRow[]>(initialOrders)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  useEffect(() => {
    const insforge = createClient()
    const channel = insforge
      .channel(userOrdersChannelName(profileId))
      .on("broadcast", { event: USER_ORDERS_REALTIME_EVENT }, ({ payload }) => {
        const p = payload as Partial<UserOrderStatusPayload>
        if (!p?.orderId || !p?.status) return
        setAllOrders((prev) =>
          prev.map((o) => (o.id === p.orderId ? { ...o, status: p.status as string } : o)),
        )
      })
      .subscribe()

    return () => {
      insforge.removeChannel(channel)
    }
  }, [profileId])

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("filters.all") },
    { key: "active", label: t("filters.active") },
    { key: "completed", label: t("filters.completed") },
    { key: "cancelled", label: t("filters.cancelled") },
  ]

  const visibleOrders = allOrders.filter((o) => {
    if (filter === "all") return true
    if (filter === "active") return ACTIVE_STATUSES.includes(o.status as OrderStatus)
    if (filter === "completed") return COMPLETED_STATUSES.includes(o.status as OrderStatus)
    if (filter === "cancelled") return CANCELLED_STATUSES.includes(o.status as OrderStatus)
    return true
  })

  const hasMore = allOrders.length < total

  async function loadMore() {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetch(`/api/orders?page=${nextPage}&perPage=${PER_PAGE}`)
      if (!res.ok) throw new Error()
      const json = (await res.json()) as {
        success?: boolean
        data?: { orders: OrderRow[]; total: number }
      }
      if (!json.success || !json.data) throw new Error()
      const { orders: nextOrders, total: nextTotal } = json.data
      setAllOrders((prev) => [...prev, ...nextOrders])
      setTotal(nextTotal)
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleDrawerClose = useCallback(() => setSelectedOrderId(null), [])

  const handleCancelled = useCallback(() => {
    // Refresh the list after cancellation
    setSelectedOrderId(null)
    fetch(`/api/orders?page=1&perPage=${allOrders.length}`)
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: { orders: OrderRow[]; total: number } }) => {
        if (!json.success || !json.data) return
        setAllOrders(json.data.orders)
        setTotal(json.data.total)
      })
      .catch(() => {})
  }, [allOrders.length])

  const currencySymbol = (c: string) => (c === "USD" ? "$" : "S/")

  return (
    <>
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-brand text-sm font-medium transition-all ${
              filter === f.key
                ? "bg-wg-primary dark:bg-wg-dark-primary text-white shadow-sm"
                : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders container */}
      <div className="rounded-card border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
        {visibleOrders.length === 0 ? (
          <div className="py-16 text-center">
            {filter === "all" ? (
              <>
                <ClipboardListIcon
                  className="w-12 h-12 mx-auto mb-4 text-wg-border dark:text-wg-dark-border"
                  strokeWidth={1}
                />
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-3">
                  {t("empty")}
                </p>
                <Link
                  href="/menu"
                  className="inline-flex text-sm font-medium text-wg-accent dark:text-wg-dark-accent hover:underline"
                >
                  {t("emptyCtA")}
                </Link>
              </>
            ) : (
              <p className="text-sm text-wg-muted dark:text-wg-dark-muted">
                {t("noResultsForFilter")}
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-wg-border/30 dark:divide-wg-dark-border">
            {visibleOrders.map((order) => {
              const sym = currencySymbol(order.currency)
              const hasDoc = !!(order.documentSeries && order.documentNumber)
              const itemNames = order.items
                .map((i) => `${i.quantity}× ${i.nameSnapshot}`)
                .join(", ")

              return (
                <li
                  key={order.id}
                  className="px-5 py-4 hover:bg-wg-bg/60 dark:hover:bg-wg-dark-raised/40 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-sm text-wg-text dark:text-wg-dark-text">
                        #{order.orderNumber}
                      </span>
                      <StatusBadge
                        status={order.status}
                        label={tStatus(order.status as OrderStatus)}
                      />
                      <span className="text-xs text-wg-muted dark:text-wg-dark-muted px-1.5 py-0.5 rounded bg-wg-border/20 dark:bg-wg-dark-border/20">
                        {tFulfillment((order.fulfillment ?? "PICKUP") as FulfillmentMethod)}
                      </span>
                    </div>
                    <span className="text-xs text-wg-muted dark:text-wg-dark-muted">
                      {new Date(order.createdAt).toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Item names */}
                  <p className="text-xs text-wg-muted dark:text-wg-dark-muted mb-3 line-clamp-1">
                    {itemNames}
                  </p>

                  {/* Bottom row: total + equal-width actions */}
                  <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
                    <span className="block text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                      {sym} {Number(order.total).toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedOrderId(order.id)
                        }}
                        className="inline-flex flex-1 min-w-0 items-center justify-center gap-2 rounded-brand border-2 border-wg-border dark:border-wg-dark-border bg-transparent py-2.5 px-3 text-sm font-semibold text-wg-text dark:text-wg-dark-text shadow-none transition-colors hover:bg-wg-bg dark:hover:bg-wg-dark-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent/40 dark:focus-visible:ring-wg-dark-accent/40"
                      >
                        <DocumentIcon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{t("viewDetail")}</span>
                      </button>
                      {hasDoc && (
                        <a
                          href={publicOrderDocumentPdfUrl(order.id, locale)}
                          download
                          className={`${PDF_DOWNLOAD_LINK_CLASSNAME} flex-1 min-w-0 py-2.5 px-3 text-sm font-semibold`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ArrowDownTrayIcon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{t("downloadDocument")}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Load more */}
        {hasMore && filter === "all" && (
          <div className="px-5 py-4 border-t border-wg-border/30 dark:border-wg-dark-border text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-brand border border-wg-border dark:border-wg-dark-border text-sm font-medium text-wg-text dark:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-raised transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Spinner className="w-4 h-4 animate-spin" />
                  {t("downloadingDocument")}
                </>
              ) : (
                t("loadMore")
              )}
            </button>
          </div>
        )}

        {!hasMore && allOrders.length > 0 && (
          <p className="px-5 py-3 text-center text-xs text-wg-muted dark:text-wg-dark-muted border-t border-wg-border/30 dark:border-wg-dark-border">
            {t("noMoreOrders")}
          </p>
        )}
      </div>

      {/* Detail drawer */}
      <OrderDetailDrawer
        orderId={selectedOrderId}
        listStatusHint={
          selectedOrderId
            ? allOrders.find((o) => o.id === selectedOrderId)?.status
            : undefined
        }
        onClose={handleDrawerClose}
        locale={locale}
        onCancelled={handleCancelled}
      />
    </>
  )
}
