"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Link } from "@/i18n/routing"
import { getCurrencySymbol } from "@wildgrove/core/currency"
import { billingDocumentTypeLabel } from "@wildgrove/core/orders/billingDocumentTypeLabel"
import { publicOrderDocumentPdfUrl } from "@wildgrove/core/pdf/orderDocumentPdfUrl"
import { PDF_DOWNLOAD_LINK_CLASSNAME } from "@wildgrove/core/pdf/pdfDownloadLinkClassName"
import { ArrowDownTrayIcon, ArrowRightIcon, CheckCircleIcon } from "@wildgrove/ui/icons"

interface OrderItem {
  id: string
  nameSnapshot: string
  quantity: number
  unitPrice: string
  lineTotal: string
  notes: string | null
}

interface OrderConfirmationProps {
  order: {
    id: string
    orderNumber: number
    status: string
    fulfillment: string
    currency: string
    total: string
    deliveryFee: string
    subtotal: string
    discountTotal: string
    paymentMethod: string
    paidAt: string | null
    scheduledFor: string | null
    estimatedReadyAt: string | null
    deliveryAddress: string | null
    deliveryZoneName: string | null
    documentType: string
    documentSeries: string | null
    documentNumber: string | null
    createdAt: string
    items: OrderItem[]
  }
}

export function OrderConfirmationClient({ order }: OrderConfirmationProps) {
  const t = useTranslations("orderConfirmation")
  const locale = useLocale()
  const sym = getCurrencySymbol(order.currency)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const documentLabel =
    order.documentSeries && order.documentNumber
      ? `${order.documentSeries}-${order.documentNumber}`
      : null

  return (
    <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
      <div className="max-w-xl mx-auto px-4 sm:px-6">

        {/* Success card */}
        <div
          className={`rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card overflow-hidden transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Green top bar */}
          <div className="h-1.5 bg-wg-accent dark:bg-wg-dark-accent" />

          <div className="p-6 sm:p-8">
            {/* Icon + title */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 flex items-center justify-center mb-4">
                <CheckCircleIcon className="w-8 h-8 text-wg-accent dark:text-wg-dark-accent" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text mb-1">
                {t("title")}
              </h1>
              <p className="text-sm text-wg-muted dark:text-wg-dark-muted">{t("subtitle")}</p>
            </div>

            {/* Order number badge */}
            <div className="bg-wg-accent/10 dark:bg-wg-dark-accent/10 rounded-[0.75rem] px-4 py-3 text-center mb-6">
              <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-0.5">{t("orderNumberLabel")}</p>
              <p className="font-display text-2xl font-bold text-wg-accent dark:text-wg-dark-accent">
                #{order.orderNumber}
              </p>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-wg-muted dark:text-wg-dark-muted">{t("fulfillment")}</span>
                <span className="font-medium text-wg-text dark:text-wg-dark-text">
                  {order.fulfillment === "PICKUP" ? t("pickup") : t("delivery")}
                </span>
              </div>
              {order.deliveryAddress && (
                <div className="flex justify-between gap-4">
                  <span className="text-wg-muted dark:text-wg-dark-muted flex-shrink-0">{t("deliveryAddress")}</span>
                  <span className="text-wg-text dark:text-wg-dark-text text-right">{order.deliveryAddress}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-wg-muted dark:text-wg-dark-muted">{t("total")}</span>
                <span className="font-semibold text-wg-accent dark:text-wg-dark-accent">
                  {sym}{order.total}
                </span>
              </div>
              {documentLabel && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-wg-muted dark:text-wg-dark-muted flex-shrink-0">
                      {t("document")}
                    </span>
                    <span className="text-right font-medium text-wg-text dark:text-wg-dark-text">
                      {billingDocumentTypeLabel(order.documentType, locale)} {documentLabel}
                    </span>
                  </div>
                  <a
                    href={publicOrderDocumentPdfUrl(order.id, locale)}
                    download
                    className={`${PDF_DOWNLOAD_LINK_CLASSNAME} w-full py-3 text-sm font-semibold`}
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                    {t("downloadPdf")}
                  </a>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="rounded-[0.75rem] border border-wg-border/40 dark:border-wg-dark-border/40 overflow-hidden mb-6">
              <ul className="divide-y divide-wg-border/30 dark:divide-wg-dark-border/30">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-wg-text dark:text-wg-dark-text">
                      <span className="font-medium">{item.quantity}×</span> {item.nameSnapshot}
                    </span>
                    <span className="text-wg-muted dark:text-wg-dark-muted">{sym}{item.lineTotal}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <Link
                href="/orders"
                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01]"
              >
                {t("viewOrders")}
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <Link
                href="/menu"
                className="flex items-center justify-center w-full py-3 text-sm font-medium text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors"
              >
                {t("backToMenu")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
