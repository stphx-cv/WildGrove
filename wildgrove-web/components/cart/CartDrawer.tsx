"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { Link } from "@/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import { useCart } from "@/components/providers/CartProvider"
import { useCurrency } from "@/components/providers/CurrencyProvider"
import { getCurrencySymbol } from "@wildgrove/core/currency"
import type { DisplayCartItem } from "@/components/providers/CartProvider"
import { useDrawerFocus } from "@/components/ui/useDrawerFocus"
import {
    ArrowRightIcon,
    ArrowRightOnRectangleIcon,
    CloseIcon,
    MinusIcon,
    PlusIcon,
    ShoppingCartIcon,
} from "@wildgrove/ui/icons"

// ── Individual cart item row ─────────────────────────────────────

interface CartItemRowProps {
  item: DisplayCartItem
  currency: string
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
}

function CartItemRow({ item, currency, onUpdateQty, onRemove }: CartItemRowProps) {
  const t = useTranslations("cart")
  const locale = useLocale()
  const displayName = locale === "es" && item.nameEs ? item.nameEs : item.name
  const listUnit = currency === "USD" ? (item.listUnitPriceUSD ?? item.unitPriceUSD) : (item.listUnitPricePEN ?? item.unitPricePEN)
  const unitPrice = currency === "USD" ? item.unitPriceUSD : item.unitPricePEN
  const listLineTotal = listUnit * item.quantity
  const lineTotal = unitPrice * item.quantity
  const showListStrike = listLineTotal > lineTotal + 0.004
  const sym = getCurrencySymbol(currency)

  return (
    <li className="flex gap-3 py-3 border-b border-wg-border/50 dark:border-wg-dark-border last:border-0">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-[0.5rem] overflow-hidden flex-shrink-0 bg-wg-border/30 dark:bg-wg-dark-border/30">
        {item.imageUrl ? (
          <FadeInImage
            src={item.imageUrl}
            alt={displayName}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-wg-muted dark:text-wg-dark-muted">
            <ShoppingCartIcon className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate leading-snug">
          {displayName}
        </p>
        {item.notes && (
          <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5 truncate italic">
            {item.notes}
          </p>
        )}
        <div className="flex items-end justify-between gap-2 mt-2">
          {/* Quantity controls */}
          <div className="flex items-center gap-1 border border-wg-border dark:border-wg-dark-border rounded-[0.5rem] overflow-hidden">
            <button
              onClick={() => onUpdateQty(item.id, item.quantity - 1)}
              aria-label={t("decreaseQuantity")}
              className="w-7 h-7 flex items-center justify-center text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary hover:bg-wg-border/30 dark:hover:bg-wg-dark-border/30 transition-colors"
            >
              <MinusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <span className="w-6 text-center text-sm font-medium text-wg-text dark:text-wg-dark-text">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQty(item.id, item.quantity + 1)}
              aria-label={t("increaseQuantity")}
              className="w-7 h-7 flex items-center justify-center text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary hover:bg-wg-border/30 dark:hover:bg-wg-dark-border/30 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Line total — list struck through when automatic discount applies */}
          <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
            {showListStrike && (
              <span className="text-xs text-wg-muted dark:text-wg-dark-muted line-through tabular-nums">
                {sym}
                {listLineTotal.toFixed(2)}
              </span>
            )}
            <span className="text-sm font-semibold text-wg-accent dark:text-wg-dark-accent tabular-nums">
              {sym}
              {lineTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.id)}
        aria-label={t("removeItem")}
        className="p-1 self-start text-wg-muted/60 hover:text-red-500 dark:text-wg-dark-muted/60 dark:hover:text-red-400 transition-colors"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </li>
  )
}

// ── Empty state ──────────────────────────────────────────────────

function CartEmptyState({ onClose }: { onClose: () => void }) {
  const t = useTranslations("cart")
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/10 flex items-center justify-center mb-4">
        <ShoppingCartIcon className="w-8 h-8 text-wg-primary dark:text-wg-dark-primary" />
      </div>
      <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">
        {t("empty.title")}
      </h3>
      <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6 max-w-48">
        {t("empty.description")}
      </p>
      <Link
        href="/menu"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        {t("empty.cta")}
      </Link>
    </div>
  )
}

// ── Main Drawer ──────────────────────────────────────────────────

export function CartDrawer() {
  const [mounted, setMounted] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const {
    items,
    currency,
    subtotalPEN,
    subtotalUSD,
    listSubtotalPEN,
    listSubtotalUSD,
    automaticDiscountPEN,
    automaticDiscountUSD,
    isDrawerOpen,
    isGuest,
    closeDrawer,
    updateQuantity,
    removeItem,
    changeCurrency,
  } = useCart()
  const t = useTranslations("cart")
  // With one store currency the cart is always in it, so there is no "Pay in" choice.
  const { storeCurrency } = useCurrency()
  const dialogRef = useDrawerFocus(isDrawerOpen, closeDrawer)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Body scroll lock
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isDrawerOpen])

  const sym = getCurrencySymbol(currency)
  const subtotal = currency === "USD" ? subtotalUSD : subtotalPEN
  const listSubtotal = currency === "USD" ? listSubtotalUSD : listSubtotalPEN
  const automaticDiscount = currency === "USD" ? automaticDiscountUSD : automaticDiscountPEN
  const showDiscountBreakdown = automaticDiscount >= 0.01

  const handleCurrencySwitch = async (newCurrency: "PEN" | "USD") => {
    if (newCurrency === currency || isSwitching) return
    setIsSwitching(true)
    try {
      await changeCurrency(newCurrency)
    } finally {
      setIsSwitching(false)
    }
  }

  // Stays mounted so it can animate out; closed, it is inert: nothing inside
  // takes focus or is read by a screen reader.
  const overlay = (
    <div
      ref={dialogRef}
      className={`fixed inset-0 z-[300] transition-opacity duration-300 ${
        isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      inert={!isDrawerOpen}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={closeDrawer}
      />

      {/* Slide-in panel */}
      <div
        className={`absolute top-0 right-0 h-full w-80 sm:w-96 bg-wg-surface dark:bg-wg-dark-surface border-l border-wg-border dark:border-wg-dark-border shadow-elevated flex flex-col transform transition-transform duration-300 ease-out ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border dark:border-wg-dark-border">
          <div className="flex items-center gap-2">
            <ShoppingCartIcon className="w-5 h-5 text-wg-primary dark:text-wg-dark-primary" />
            <h2 className="font-display text-base font-semibold text-wg-text dark:text-wg-dark-text">
              {t("title")}
            </h2>
            {items.length > 0 && (
              <span className="text-xs bg-wg-accent text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <button
            onClick={closeDrawer}
            aria-label={t("close")}
            className="p-2 text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary transition-colors rounded-brand"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <CartEmptyState onClose={closeDrawer} />
        ) : (
          <>
            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              <ul>
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    onUpdateQty={updateQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </ul>

              {/* Currency switcher */}
              {!storeCurrency && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-wg-border/30 dark:border-wg-dark-border/30">
                  <span className="text-[11px] font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">
                    {t("payCurrency")}
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded-[0.5rem] bg-wg-border/20 dark:bg-wg-dark-border/20 border border-wg-border/40 dark:border-wg-dark-border/40">
                    {(["PEN", "USD"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => handleCurrencySwitch(c)}
                        disabled={isSwitching}
                        aria-pressed={currency === c}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-[0.375rem] transition-all duration-150 ${
                          currency === c
                            ? "bg-wg-accent text-white shadow-sm"
                            : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-border/30 dark:hover:bg-wg-dark-border/30"
                        } ${isSwitching ? "opacity-50 cursor-wait" : ""}`}
                      >
                        {c === "PEN" ? "S/ PEN" : "$ USD"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised space-y-3">
              {showDiscountBreakdown ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-wg-muted dark:text-wg-dark-muted">{t("listSubtotal")}</span>
                    <span className="text-wg-muted dark:text-wg-dark-muted line-through tabular-nums shrink-0">
                      {sym}
                      {listSubtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-emerald-700 dark:text-emerald-400">{t("automaticDiscount")}</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                      −{sym}
                      {automaticDiscount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-wg-border/50 dark:border-wg-dark-border/50">
                    <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">{t("total")}</span>
                    <span className="font-semibold text-wg-text dark:text-wg-dark-text tabular-nums shrink-0">
                      {sym}
                      {subtotal.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-wg-muted dark:text-wg-dark-muted">{t("subtotal")}</span>
                  <span className="font-semibold text-wg-text dark:text-wg-dark-text tabular-nums shrink-0">
                    {sym}
                    {subtotal.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Guest auth prompt */}
              {isGuest && (
                <div className="rounded-[0.5rem] bg-wg-primary/5 dark:bg-wg-dark-primary/10 border border-wg-primary/20 dark:border-wg-dark-primary/20 px-3 py-2.5">
                  <p className="text-xs text-wg-primary dark:text-wg-dark-primary font-medium mb-0.5">
                    {t("guestPrompt.title")}
                  </p>
                  <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                    {t("guestPrompt.description")}
                  </p>
                </div>
              )}

              {/* Checkout button */}
              {isGuest ? (
                <Link
                  href="/portal"
                  onClick={closeDrawer}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98]"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  {t("guestPrompt.cta")}
                </Link>
              ) : (
                <Link
                  href="/checkout"
                  onClick={closeDrawer}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98]"
                >
                  {t("checkout")}
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
              )}

              {/* Continue shopping */}
              <button
                onClick={closeDrawer}
                className="w-full text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-primary dark:hover:text-wg-dark-primary transition-colors text-center py-1"
              >
                {t("continueShopping")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return mounted ? createPortal(overlay, document.body) : null
}
