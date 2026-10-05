"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { StatusBadge } from "@wildgrove/ui/StatusBadge"
import type { FulfillmentMethod, OrderStatus } from "@wildgrove/db"
import { billingDocumentTypeLabel } from "@wildgrove/core/orders/billingDocumentTypeLabel"
import { publicOrderDocumentPdfUrl } from "@wildgrove/core/pdf/orderDocumentPdfUrl"
import { PDF_DOWNLOAD_LINK_CLASSNAME } from "@wildgrove/core/pdf/pdfDownloadLinkClassName"
import { Textarea } from "@wildgrove/ui/Textarea"
import { useDrawerFocus } from "@/components/ui/useDrawerFocus"
import { ArrowDownTrayIcon, CloseIcon, MapPinIcon } from "@wildgrove/ui/icons"

interface OrderDetail {
  id: string
  orderNumber: number
  status: string
  fulfillment: string
  currency: string
  subtotal: string
  discountTotal: string
  deliveryFee: string
  total: string
  paidAt: string | null
  scheduledFor: string | null
  deliveryAddress: string | null
  deliveryAddressDetail: string | null
  customerName: string | null
  customerPhone: string | null
  notes: string | null
  documentType: string
  documentSeries: string | null
  documentNumber: string | null
  createdAt: string
  items: { id: string; nameSnapshot: string; quantity: number; unitPrice: string; lineTotal: string; notes: string | null }[]
  appliedDiscounts: { id: string; amount: string; codeUsed: string | null }[]
}

interface OrderDetailDrawerProps {
  orderId: string | null
  /** When the parent list row updates (e.g. realtime), sync status into the open drawer */
  listStatusHint?: string
  onClose: () => void
  locale: string
  onCancelled?: () => void
}

const USER_CANCELLABLE: OrderStatus[] = ["PENDING", "PREPARING"]

export function OrderDetailDrawer({ orderId, listStatusHint, onClose, locale, onCancelled }: OrderDetailDrawerProps) {
  const t = useTranslations("orders")
  const tStatus = useTranslations("orders.status")
  const tFulfillment = useTranslations("orders.fulfillment")
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelStep, setCancelStep] = useState<"idle" | "confirm">("idle")
  const [cancelReason, setCancelReason] = useState("")

  const isOpen = !!orderId

  const fetchOrder = useCallback(async (id: string) => {
    setLoading(true)
    setError(false)
    setOrder(null)
    setCancelStep("idle")
    setCancelReason("")
    try {
      const res = await fetch(`/api/orders/${id}`)
      if (!res.ok) throw new Error()
      const json = (await res.json()) as {
        success?: boolean
        data?: OrderDetail
        error?: string
      }
      if (!json.success || !json.data) throw new Error()
      setOrder(json.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (orderId) fetchOrder(orderId)
  }, [orderId, fetchOrder])

  useEffect(() => {
    if (listStatusHint === undefined || !orderId) return
    setOrder((prev) =>
      prev && prev.id === orderId && listStatusHint !== prev.status
        ? { ...prev, status: listStatusHint }
        : prev,
    )
  }, [listStatusHint, orderId])

  // Focus moves in on open, Tab stays inside, Escape closes and focus returns
  // to the row that opened it, as in the cart drawer.
  const panelRef = useDrawerFocus(isOpen, onClose)

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  async function handleCancel() {
    if (!order) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      })
      if (!res.ok) throw new Error()
      onCancelled?.()
      onClose()
    } catch {
      setCancelling(false)
    }
  }

  const currencySymbol = (c: string) => (c === "USD" ? "$" : "S/")

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })

  const canCancel = order && USER_CANCELLABLE.includes(order.status as OrderStatus)
  const hasDoc = !!(order?.documentSeries && order?.documentNumber)
  const hasDiscount = order && Number(order.discountTotal) > 0
  const hasDeliveryFee = order && Number(order.deliveryFee) > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — stays mounted to animate out; closed, it is inert: nothing
          inside takes focus or is read by a screen reader. */}
      <div
        ref={panelRef}
        inert={!isOpen}
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col
          bg-wg-surface dark:bg-wg-dark-raised shadow-elevated
          transform transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label={order ? t("drawerTitle", { number: order.orderNumber }) : t("title")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border/30 dark:border-wg-dark-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {order && (
              <>
                <span className="font-display font-semibold text-sm text-wg-text dark:text-wg-dark-text">
                  #{order.orderNumber}
                </span>
                <StatusBadge status={order.status} label={tStatus(order.status as OrderStatus)} />
              </>
            )}
            {loading && (
              <span className="text-sm text-wg-muted dark:text-wg-dark-muted animate-pulse">
                {t("downloadingDocument")}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors flex-shrink-0"
            aria-label={t("close")}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error && (
            <p className="text-sm text-red-500 text-center py-8">
              Error al cargar el pedido. Intenta de nuevo.
            </p>
          )}

          {order && (
            <>
              {/* Meta info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-wg-muted dark:text-wg-dark-muted">
                <span>{tFulfillment((order.fulfillment ?? "PICKUP") as FulfillmentMethod)}</span>
                <span>{formatDate(order.createdAt)}</span>
                {order.scheduledFor && (
                  <span>
                    Programado: {new Date(order.scheduledFor).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              {/* Items */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-wg-muted dark:text-wg-dark-muted mb-2.5">
                  {t("itemsTitle")}
                </h3>
                <ul className="space-y-2">
                  {order.items.map((item) => {
                    const sym = currencySymbol(order.currency)
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="flex-shrink-0 w-5 h-5 rounded-brand bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {item.quantity}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-wg-text dark:text-wg-dark-text truncate">{item.nameSnapshot}</p>
                            {item.notes && (
                              <p className="text-xs text-wg-muted dark:text-wg-dark-muted italic truncate">{item.notes}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-wg-text dark:text-wg-dark-text flex-shrink-0">
                          {sym} {Number(item.lineTotal).toFixed(2)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Divider */}
              <hr className="border-wg-border/30 dark:border-wg-dark-border" />

              {/* Totals */}
              <div className="space-y-1.5">
                {(() => {
                  const sym = currencySymbol(order.currency)
                  return (
                    <>
                      <div className="flex justify-between text-sm text-wg-muted dark:text-wg-dark-muted">
                        <span>{t("subtotal")}</span>
                        <span>{sym} {Number(order.subtotal).toFixed(2)}</span>
                      </div>
                      {hasDeliveryFee && (
                        <div className="flex justify-between text-sm text-wg-muted dark:text-wg-dark-muted">
                          <span>{t("deliveryFee")}</span>
                          <span>+ {sym} {Number(order.deliveryFee).toFixed(2)}</span>
                        </div>
                      )}
                      {hasDiscount && (
                        <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                          <span>{t("discount")}</span>
                          <span>− {sym} {Number(order.discountTotal).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold text-wg-text dark:text-wg-dark-text pt-1.5 border-t border-wg-border/30 dark:border-wg-dark-border">
                        <span>{t("total")}</span>
                        <span>{sym} {Number(order.total).toFixed(2)}</span>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Delivery address */}
              {order.fulfillment === "DELIVERY" && order.deliveryAddress && (
                <div className="rounded-brand bg-wg-bg dark:bg-wg-dark-bg border border-wg-border/30 dark:border-wg-dark-border px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <MapPinIcon className="w-4 h-4 text-wg-muted dark:text-wg-dark-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-wg-muted dark:text-wg-dark-muted mb-0.5">{t("address")}</p>
                      <p className="text-sm text-wg-text dark:text-wg-dark-text">{order.deliveryAddress}</p>
                      {order.deliveryAddressDetail && (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{order.deliveryAddressDetail}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="text-xs text-wg-muted dark:text-wg-dark-muted italic">
                  Notas: {order.notes}
                </div>
              )}

              {/* Document (PDF download lives in footer to avoid duplicate controls) */}
              {hasDoc && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-wg-muted dark:text-wg-dark-muted">
                    {t("billingDocument")}
                  </p>
                  <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                    {billingDocumentTypeLabel(order.documentType, locale)}{" "}
                    {order.documentSeries}-{order.documentNumber}
                  </p>
                </div>
              )}

              {/* Cancel confirm step */}
              {cancelStep === "confirm" && (
                <div className="rounded-card border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 px-4 py-4 space-y-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    {t("cancelTitle")}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {t("cancelConfirmBody")}
                  </p>
                  <Textarea
                    maxHeight={160}
                    aria-label={t("cancelReason")}
                    value={cancelReason}
                    onChange={setCancelReason}
                    placeholder={t("cancelReasonPlaceholder")}
                    minRows={2}
                    className="text-sm rounded-brand border border-red-200 dark:border-red-800/40 bg-white dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text placeholder:text-wg-muted/60 dark:placeholder:text-wg-dark-muted/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelStep("idle")}
                      disabled={cancelling}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors disabled:opacity-50"
                    >
                      {t("keepOrder")}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-brand bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                    >
                      {cancelling ? t("cancelling") : t("confirmCancel")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: single download + cancel (no duplicate link in scroll body) */}
        {order && cancelStep === "idle" && (hasDoc || canCancel) && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-wg-border/30 dark:border-wg-dark-border flex items-center gap-3">
            {hasDoc && (
              <a
                href={publicOrderDocumentPdfUrl(order.id, locale)}
                download
                className={`${PDF_DOWNLOAD_LINK_CLASSNAME} inline-flex flex-1 min-w-0 px-4 py-2.5 text-sm font-semibold`}
              >
                <ArrowDownTrayIcon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                {t("downloadDocument")}
              </a>
            )}
            {canCancel && (
              <button
                onClick={() => setCancelStep("confirm")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-brand border border-red-200 dark:border-red-800/40 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ml-auto"
              >
                {t("cancelOrder")}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
