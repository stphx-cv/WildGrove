"use client"

// ══════════════════════════════════════════════════════════════════
// CheckoutClient — multi-step checkout flow
//
// Steps: Cart → Fulfillment → Billing → Payment → Review
// Guest users see an auth gate before step 2. With both billing documents
// switched off in the panel there is no Billing step.
// ══════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"
import { useTranslations, useLocale } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { Link } from "@/i18n/routing"
import { useCart } from "@/components/providers/CartProvider"
import {
  CHECKOUT_DRAFT_SIGNED_OUT_EVENT,
  CHECKOUT_DRAFT_STORAGE_KEY,
  clearCheckoutDraftStorage,
} from "@/components/cart/checkout-draft"
import { getCurrencySymbol } from "@wildgrove/core/currency"
import type { CheckoutSwitches } from "@wildgrove/core/settings"
import { Textarea } from "@wildgrove/ui/Textarea"
import {
    ArrowRightIcon,
    ArrowRightOnRectangleIcon,
    CheckCircleIcon,
    CheckIcon,
    CloseIcon,
    ExclamationCircleIcon,
    LockClosedIcon,
    ShoppingCartIcon,
    Spinner,
    StorefrontIcon,
    TruckIcon,
} from "@wildgrove/ui/icons"

// ── Types ─────────────────────────────────────────────────────────

type Step = "cart" | "fulfillment" | "billing" | "payment" | "review"

type FulfillmentMethod = "PICKUP" | "DELIVERY"

const FULFILLMENT_METHODS: FulfillmentMethod[] = ["PICKUP", "DELIVERY"]

function isFulfillmentOn(switches: CheckoutSwitches, method: FulfillmentMethod): boolean {
  return method === "PICKUP" ? switches.pickupEnabled : switches.deliveryEnabled
}

/** The preferred method if the owner left it on, otherwise the one that is. */
function availableFulfillment(switches: CheckoutSwitches, preferred: FulfillmentMethod): FulfillmentMethod {
  if (isFulfillmentOn(switches, preferred)) return preferred
  return FULFILLMENT_METHODS.find((m) => isFulfillmentOn(switches, m)) ?? preferred
}

/** Query on /account/addresses so we can return the user to checkout after saving. */
const ACCOUNT_ADDRESSES_RESUME_CHECKOUT = "/account/addresses?resumeCheckout=1"

interface SavedAddress {
  id: string
  label: string | null
  fullAddress: string
  detail: string | null
  isDefault: boolean
}

interface QuoteData {
  currency: string
  subtotal: string
  discountTotal: string
  discountedSubtotal: string
  deliveryFee: string
  total: string
  itemCount: number
  zone: { id: string; name: string; estimatedMinutes: number } | null
  zoneError: string | null
  walletBalance: string
  hasSufficientFunds: boolean
}

type DocumentType = "BOLETA" | "FACTURA"

const DOCUMENT_TYPES: DocumentType[] = ["BOLETA", "FACTURA"]

function isDocumentTypeOn(switches: CheckoutSwitches, type: DocumentType): boolean {
  return type === "BOLETA" ? switches.boletaEnabled : switches.facturaEnabled
}

/** The preferred document if the owner left it on, otherwise the one that is. */
function availableDocumentType(switches: CheckoutSwitches, preferred: DocumentType): DocumentType {
  if (isDocumentTypeOn(switches, preferred)) return preferred
  return DOCUMENT_TYPES.find((type) => isDocumentTypeOn(switches, type)) ?? preferred
}

interface BillingData {
  documentType: DocumentType
  buyerDni: string
  fiscalRuc: string
  fiscalLegalName: string
  fiscalAddress: string
}

// ── Step indicator ────────────────────────────────────────────────

const STEPS: Step[] = ["cart", "fulfillment", "billing", "payment", "review"]

const CHECKOUT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface CheckoutDraft {
  v: 2
  /** The account that wrote it. Guests stop at the cart step and save nothing. */
  userId: string
  locale: string
  step: Step
  fulfillment: FulfillmentMethod
  addressId: string
  billing: BillingData
  notes: string
  savedAt: number
}

function isStep(value: unknown): value is Step {
  return typeof value === "string" && (STEPS as readonly string[]).includes(value)
}

function parseCheckoutDraft(raw: string | null): CheckoutDraft | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const o = parsed as Record<string, unknown>
    if (o.v !== 2) return null
    if (typeof o.userId !== "string") return null
    if (typeof o.locale !== "string") return null
    if (!isStep(o.step)) return null
    if (o.fulfillment !== "PICKUP" && o.fulfillment !== "DELIVERY") return null
    if (typeof o.addressId !== "string") return null
    if (typeof o.savedAt !== "number") return null
    const b = o.billing
    if (!b || typeof b !== "object") return null
    const bill = b as Record<string, unknown>
    if (bill.documentType !== "BOLETA" && bill.documentType !== "FACTURA") return null
    if (typeof bill.buyerDni !== "string" || typeof bill.fiscalRuc !== "string") return null
    if (typeof bill.fiscalLegalName !== "string" || typeof bill.fiscalAddress !== "string") return null
    const billing: BillingData = {
      documentType: bill.documentType,
      buyerDni: bill.buyerDni,
      fiscalRuc: bill.fiscalRuc,
      fiscalLegalName: bill.fiscalLegalName,
      fiscalAddress: bill.fiscalAddress,
    }
    const notes = typeof o.notes === "string" ? o.notes : ""
    return {
      v: 2,
      userId: o.userId,
      locale: o.locale,
      step: o.step,
      fulfillment: o.fulfillment,
      addressId: o.addressId,
      billing,
      notes,
      savedAt: o.savedAt,
    }
  } catch {
    return null
  }
}

function saveCheckoutDraft(fields: Omit<CheckoutDraft, "v" | "savedAt">) {
  const payload: CheckoutDraft = { v: 2, ...fields, savedAt: Date.now() }
  try {
    sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode / quota */
  }
}

function pathnameWithoutLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`
  if (pathname === prefix) return "/"
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || "/"
  return pathname
}

function CheckoutLeaveModal({
  onKeepAndLeave,
  onDiscardAndLeave,
  onStay,
}: {
  onKeepAndLeave: () => void
  onDiscardAndLeave: () => void
  onStay: () => void
}) {
  const t = useTranslations("checkout")

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onStay])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-leave-title"
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onStay}
    >
      <div
        className="bg-wg-surface dark:bg-wg-dark-surface rounded-2xl shadow-elevated border border-wg-border/50 dark:border-wg-dark-border w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-wg-accent/15 dark:bg-wg-dark-accent/20 flex items-center justify-center shrink-0 mt-0.5">
              <ExclamationCircleIcon className="w-5 h-5 text-wg-accent dark:text-wg-dark-accent" strokeWidth={2} />
            </div>
            <div>
              <h3 id="checkout-leave-title" className="text-base font-semibold text-wg-text dark:text-wg-dark-text">
                {t("leaveModal.title")}
              </h3>
              <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1 leading-relaxed">{t("leaveModal.description")}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-wg-border/30 dark:bg-wg-dark-border" />

        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={onKeepAndLeave}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-brand border border-wg-accent/40 dark:border-wg-dark-accent/40 bg-wg-accent/5 dark:bg-wg-dark-accent/5 hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10 hover:border-wg-accent/60 dark:hover:border-wg-dark-accent/60 text-left transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-wg-accent/15 dark:bg-wg-dark-accent/20 flex items-center justify-center shrink-0">
              <LockClosedIcon className="w-4 h-4 text-wg-accent dark:text-wg-dark-accent" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">{t("leaveModal.keepTitle")}</p>
              <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5 leading-snug">{t("leaveModal.keepHint")}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onDiscardAndLeave}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-brand border border-red-300/55 dark:border-red-800/55 bg-wg-surface dark:bg-wg-dark-surface hover:bg-red-50 dark:hover:bg-red-900/15 hover:border-red-400/60 dark:hover:border-red-700/50 text-left transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <CloseIcon className="w-4 h-4 text-red-500 dark:text-red-400" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t("leaveModal.discardTitle")}</p>
              <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5 leading-snug">{t("leaveModal.discardHint")}</p>
            </div>
          </button>
        </div>

        <div className="px-6 pb-5">
          <button
            type="button"
            onClick={onStay}
            className="w-full py-2.5 text-sm font-medium text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors text-center rounded-brand hover:bg-wg-primary/5 dark:hover:bg-wg-dark-primary/10"
          >
            {t("leaveModal.stay")}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const t = useTranslations("checkout.steps")
  const tCheckout = useTranslations("checkout")
  const currentIdx = steps.indexOf(current)

  return (
    <nav aria-label={tCheckout("stepProgressAriaLabel")} className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const done = idx < currentIdx
        const active = step === current
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                  done
                    ? "bg-wg-accent border-wg-accent dark:border-wg-dark-accent text-white"
                    : active
                      ? "border-wg-accent dark:border-wg-dark-accent text-wg-accent dark:text-wg-dark-accent bg-transparent"
                      : "border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted bg-transparent"
                }`}
              >
                {done ? (
                  <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-[10px] font-medium hidden sm:block ${
                  active
                    ? "text-wg-accent dark:text-wg-dark-accent"
                    : done
                      ? "text-wg-text dark:text-wg-dark-text"
                      : "text-wg-muted dark:text-wg-dark-muted"
                }`}
              >
                {t(step)}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-[2px] w-8 sm:w-12 mx-1 mt-[-10px] sm:mt-[-18px] transition-all ${
                  done
                    ? "bg-wg-accent dark:bg-wg-dark-accent"
                    : "bg-wg-border dark:border-wg-dark-border"
                }`}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Cart step ─────────────────────────────────────────────────────

function CartStep({ onNext }: { onNext: () => void }) {
  const t = useTranslations("checkout")
  const tCart = useTranslations("cart")
  const locale = useLocale()
  const { items, currency, subtotalPEN, subtotalUSD, isGuest } = useCart()
  const sym = getCurrencySymbol(currency)
  const subtotal = currency === "USD" ? subtotalUSD : subtotalPEN

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-wg-primary/10 dark:bg-wg-dark-primary/10 flex items-center justify-center mb-4">
          <ShoppingCartIcon className="w-8 h-8 text-wg-primary dark:text-wg-dark-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">
          {t("emptyCart.title")}
        </h3>
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">{t("emptyCart.description")}</p>
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.02]"
        >
          {t("emptyCart.cta")}
        </Link>
      </div>
    )
  }

  if (isGuest) {
    return (
      <div className="flex flex-col items-center py-16 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 flex items-center justify-center mb-4">
          <ArrowRightOnRectangleIcon className="w-8 h-8 text-wg-accent dark:text-wg-dark-accent" />
        </div>
        <h3 className="font-display text-xl font-semibold text-wg-text dark:text-wg-dark-text mb-2">
          {t("authGate.title")}
        </h3>
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">{t("authGate.description")}</p>
        <Link
          href="/portal?mode=login"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.02]"
        >
          {t("authGate.cta")}
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-wg-border/40 dark:divide-wg-dark-border/40 mb-6">
        {items.map((item) => {
          const displayName = locale === "es" && item.nameEs ? item.nameEs : item.name
          const unitPrice = currency === "USD" ? item.unitPriceUSD : item.unitPricePEN
          return (
            <li key={item.id} className="flex gap-3 py-3">
              <div className="w-12 h-12 rounded-[0.5rem] overflow-hidden flex-shrink-0 bg-wg-border/30 dark:bg-wg-dark-border/30">
                {item.imageUrl ? (
                  <FadeInImage src={item.imageUrl} alt={displayName} width={48} height={48} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-wg-muted dark:text-wg-dark-muted">
                    <ShoppingCartIcon className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">{displayName}</p>
                {item.notes && <p className="text-xs text-wg-muted dark:text-wg-dark-muted italic truncate">{item.notes}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-wg-accent dark:text-wg-dark-accent">
                  {sym}{(unitPrice * item.quantity).toFixed(2)}
                </p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">×{item.quantity}</p>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Subtotal */}
      <div className="flex justify-between items-center pt-3 border-t border-wg-border/40 dark:border-wg-dark-border/40 mb-6">
        <span className="text-sm text-wg-muted dark:text-wg-dark-muted">{tCart("subtotal")}</span>
        <span className="font-semibold text-wg-text dark:text-wg-dark-text">{sym}{subtotal.toFixed(2)}</span>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 px-5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {t("steps.fulfillment")}
        <ArrowRightIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Fulfillment step ──────────────────────────────────────────────

function FulfillmentStep({
  fulfillment,
  setFulfillment,
  addressId,
  setAddressId,
  addresses,
  addressesLoading,
  methods,
  zoneNotice,
  nextStep,
  onNext,
  onBack,
}: {
  fulfillment: FulfillmentMethod
  setFulfillment: (v: FulfillmentMethod) => void
  addressId: string
  setAddressId: (v: string) => void
  addresses: SavedAddress[]
  addressesLoading: boolean
  methods: FulfillmentMethod[]
  zoneNotice: string | null
  nextStep: Step
  onNext: () => void
  onBack: () => void
}) {
  const t = useTranslations("checkout")
  const tAddresses = useTranslations("addresses")
  const fieldId = useId()

  const canContinue =
    methods.includes(fulfillment) &&
    (fulfillment === "PICKUP" || (fulfillment === "DELIVERY" && !!addressId))

  return (
    <div>
      <p className="text-sm font-medium text-wg-muted dark:text-wg-dark-muted mb-4">{t("fulfillment.title")}</p>

      {/* Tabs */}
      <div className={`grid gap-3 mb-6 ${methods.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {methods.map((method) => (
          <button
            key={method}
            onClick={() => setFulfillment(method)}
            className={`p-4 rounded-card border-2 text-left transition-all ${
              fulfillment === method
                ? "border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/5"
                : "border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {method === "PICKUP" ? (
                <StorefrontIcon className="w-5 h-5 text-wg-accent dark:text-wg-dark-accent" />
              ) : (
                <TruckIcon className="w-5 h-5 text-wg-accent dark:text-wg-dark-accent" />
              )}
              <span className="font-semibold text-sm text-wg-text dark:text-wg-dark-text">
                {method === "PICKUP" ? t("fulfillment.pickup") : t("fulfillment.delivery")}
              </span>
            </div>
            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
              {method === "PICKUP" ? t("fulfillment.pickupNote") : t("fulfillment.deliveryAddressLabel")}
            </p>
          </button>
        ))}
      </div>

      {/* Delivery address selector */}
      {fulfillment === "DELIVERY" && (
        <div className="mb-6">
          <p id={`${fieldId}-address`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-2">
            {t("fulfillment.deliveryAddressLabel")}
          </p>
          {addressesLoading ? (
            <div
              className="rounded-card border border-wg-border dark:border-wg-dark-border p-6 flex flex-col items-center justify-center gap-2"
              aria-busy="true"
            >
              <div className="h-4 w-48 rounded bg-wg-border/50 dark:bg-wg-dark-border/50 animate-pulse" />
              <div className="h-4 w-36 rounded bg-wg-border/40 dark:bg-wg-dark-border/40 animate-pulse" />
              <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-2">{t("fulfillment.addressesLoading")}</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="rounded-card border border-wg-border dark:border-wg-dark-border p-4 sm:p-5 text-center space-y-4">
              <p className="text-sm text-wg-text dark:text-wg-dark-text leading-relaxed">{t("fulfillment.noSavedAddressesHint")}</p>
              <Link
                href={ACCOUNT_ADDRESSES_RESUME_CHECKOUT}
                className="inline-flex w-full sm:w-auto min-w-[min(100%,14rem)] mx-auto items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {t("fulfillment.manageAddressesCta")}
                <ArrowRightIcon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <div role="group" aria-labelledby={`${fieldId}-address`} className="space-y-2">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => setAddressId(addr.id)}
                  className={`w-full text-left p-3 rounded-card border-2 transition-all ${
                    addressId === addr.id
                      ? "border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/5"
                      : "border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface hover:border-wg-accent/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {addr.label && (
                        <p className="text-xs font-semibold text-wg-accent dark:text-wg-dark-accent mb-0.5">{addr.label}</p>
                      )}
                      <p className="text-sm text-wg-text dark:text-wg-dark-text truncate">{addr.fullAddress}</p>
                      {addr.detail && <p className="text-xs text-wg-muted dark:text-wg-dark-muted">{addr.detail}</p>}
                    </div>
                    {addr.isDefault && (
                      <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent">
                        {tAddresses("default")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <Link
                href={ACCOUNT_ADDRESSES_RESUME_CHECKOUT}
                className="block text-xs text-center text-wg-accent dark:text-wg-dark-accent hover:underline mt-2"
              >
                {t("fulfillment.newAddress")}
              </Link>
            </div>
          )}
        </div>
      )}

      {zoneNotice && (
        <div className="mb-4 rounded-[0.5rem] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{zoneNotice}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 transition-all"
        >
          {t("back")}
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="flex-[2] py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {t(`steps.${nextStep}`)}
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Billing step ──────────────────────────────────────────────────

function BillingStep({
  billing,
  setBilling,
  documentTypes,
  onNext,
  onBack,
}: {
  billing: BillingData
  setBilling: (v: BillingData) => void
  documentTypes: DocumentType[]
  onNext: () => void
  onBack: () => void
}) {
  const t = useTranslations("checkout")
  const fieldId = useId()

  const canContinue =
    billing.documentType === "BOLETA" ||
    (billing.fiscalRuc.length === 11 && billing.fiscalLegalName.trim().length > 0)

  return (
    <div>
      <p className="text-sm font-medium text-wg-muted dark:text-wg-dark-muted mb-4">{t("billing.subtitle")}</p>

      {/* Document type selector */}
      <div className={`grid gap-3 mb-6 ${documentTypes.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {documentTypes.map((type) => (
          <button
            key={type}
            onClick={() => setBilling({ ...billing, documentType: type })}
            className={`p-4 rounded-card border-2 text-left transition-all ${
              billing.documentType === type
                ? "border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/5"
                : "border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface hover:border-wg-accent/50"
            }`}
          >
            <p className="font-semibold text-sm text-wg-text dark:text-wg-dark-text mb-1">
              {type === "BOLETA" ? t("billing.boleta") : t("billing.factura")}
            </p>
            <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
              {type === "BOLETA" ? t("billing.boletaDesc") : t("billing.facturaDesc")}
            </p>
          </button>
        ))}
      </div>

      {/* Boleta fields */}
      {billing.documentType === "BOLETA" && (
        <div className="mb-6">
          <label htmlFor={`${fieldId}-buyer-dni`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5">
            {t("billing.buyerDni")}
          </label>
          <input
            id={`${fieldId}-buyer-dni`}
            type="text"
            value={billing.buyerDni}
            onChange={(e) => setBilling({ ...billing, buyerDni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
            placeholder={t("billing.buyerDniPlaceholder")}
            maxLength={8}
            className="w-full px-3 py-2 text-sm rounded-[0.5rem] border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder-wg-muted dark:placeholder-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-accent/40 transition-all"
          />
        </div>
      )}

      {/* Factura fields */}
      {billing.documentType === "FACTURA" && (
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor={`${fieldId}-fiscal-ruc`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5">
              {t("billing.fiscalRuc")} *
            </label>
            <input
              id={`${fieldId}-fiscal-ruc`}
              type="text"
              value={billing.fiscalRuc}
              onChange={(e) => setBilling({ ...billing, fiscalRuc: e.target.value.replace(/\D/g, "").slice(0, 11) })}
              placeholder={t("billing.fiscalRucPlaceholder")}
              maxLength={11}
              className="w-full px-3 py-2 text-sm rounded-[0.5rem] border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder-wg-muted dark:placeholder-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-accent/40 transition-all"
            />
            {billing.fiscalRuc.length > 0 && billing.fiscalRuc.length !== 11 && (
              <p className="text-xs text-red-500 mt-1">{t("billing.fiscalRucInvalid")}</p>
            )}
          </div>
          <div>
            <label htmlFor={`${fieldId}-fiscal-legal-name`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5">
              {t("billing.fiscalLegalName")} *
            </label>
            <input
              id={`${fieldId}-fiscal-legal-name`}
              type="text"
              value={billing.fiscalLegalName}
              onChange={(e) => setBilling({ ...billing, fiscalLegalName: e.target.value })}
              placeholder={t("billing.fiscalLegalNamePlaceholder")}
              maxLength={200}
              className="w-full px-3 py-2 text-sm rounded-[0.5rem] border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder-wg-muted dark:placeholder-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-accent/40 transition-all"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-fiscal-address`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5">
              {t("billing.fiscalAddress")}
            </label>
            <input
              id={`${fieldId}-fiscal-address`}
              type="text"
              value={billing.fiscalAddress}
              onChange={(e) => setBilling({ ...billing, fiscalAddress: e.target.value })}
              placeholder={t("billing.fiscalAddressPlaceholder")}
              maxLength={255}
              className="w-full px-3 py-2 text-sm rounded-[0.5rem] border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder-wg-muted dark:placeholder-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-accent/40 transition-all"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 transition-all"
        >
          {t("back")}
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="flex-[2] py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {t("steps.payment")}
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Payment step ──────────────────────────────────────────────────

function PaymentStep({
  walletBalance,
  currency,
  quoteTotal,
  walletEnabled,
  onNext,
  onBack,
}: {
  walletBalance: string
  currency: string
  quoteTotal: string
  walletEnabled: boolean
  onNext: () => void
  onBack: () => void
}) {
  const t = useTranslations("checkout")
  const sym = getCurrencySymbol(currency)
  const balance = parseFloat(walletBalance)
  const total = parseFloat(quoteTotal)
  const hasFunds = balance >= total

  return (
    <div>
      <p className="text-sm font-medium text-wg-muted dark:text-wg-dark-muted mb-4">{t("payment.title")}</p>

      {/* The wallet is the only payment method, so with it off nothing can be paid. */}
      {!walletEnabled ? (
        <div className="rounded-card border border-wg-border dark:border-wg-dark-border p-4 mb-4">
          <p className="text-sm text-wg-text dark:text-wg-dark-text leading-relaxed">{t("payment.walletDisabled")}</p>
        </div>
      ) : (
        <div className="rounded-card border-2 border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/5 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-wg-accent/10 dark:bg-wg-dark-accent/10 flex items-center justify-center">
                <span className="text-sm font-bold text-wg-accent dark:text-wg-dark-accent">{sym}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                  {currency === "USD" ? t("payment.walletUsd") : t("payment.walletPen")}
                </p>
                <p className="text-xs text-wg-muted dark:text-wg-dark-muted">
                  {t("payment.balance", { amount: `${sym}${balance.toFixed(2)}` })}
                </p>
              </div>
            </div>
            <CheckIcon className="w-5 h-5 text-wg-accent dark:text-wg-dark-accent" strokeWidth={2} />
          </div>
          {!hasFunds && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-3 pt-3 border-t border-red-200 dark:border-red-900/50">
              {t("payment.insufficientFunds")}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 transition-all"
        >
          {t("back")}
        </button>
        <button
          onClick={onNext}
          disabled={!walletEnabled || !hasFunds}
          className="flex-[2] py-3 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {t("steps.review")}
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Review step ───────────────────────────────────────────────────

function ReviewStep({
  quote,
  fulfillment,
  addressLabel,
  billing,
  notes,
  setNotes,
  onConfirm,
  onBack,
  isSubmitting,
  error,
}: {
  quote: QuoteData | null
  fulfillment: FulfillmentMethod
  addressLabel: string
  billing: BillingData | null
  notes: string
  setNotes: (v: string) => void
  onConfirm: () => void
  onBack: () => void
  isSubmitting: boolean
  error: string | null
}) {
  const t = useTranslations("checkout")
  const tWallet = useTranslations("wallet")
  const fieldId = useId()
  const sym = getCurrencySymbol(quote?.currency ?? "PEN")
  const walletBalanceNum = quote ? parseFloat(quote.walletBalance) : 0
  const orderTotalNum = quote ? parseFloat(quote.total) : 0
  const walletAfterPayment = walletBalanceNum - orderTotalNum
  // An address outside every zone has no delivery, so there is no fee to show.
  const noZone = fulfillment === "DELIVERY" && quote?.zoneError === "no_zone"
  const minOrder = fulfillment === "DELIVERY" && quote?.zoneError === "min_order"

  return (
    <div>
      {/* Order summary — single accent on amount to pay; wallet framed as remaining balance */}
      <div className="rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/40 dark:border-wg-dark-border/40 p-4 mb-4">
        <h3 className="text-xs font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-3">
          {t("review.orderSummary")}
        </h3>

        <p className="text-[11px] font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-2">
          {t("review.orderBreakdownTitle")}
        </p>
        <div className="space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between gap-3">
            <span className="text-wg-muted dark:text-wg-dark-muted">{t("review.subtotal")}</span>
            <span className="text-wg-text dark:text-wg-dark-text shrink-0">{sym}{quote?.subtotal ?? "0.00"}</span>
          </div>
          {quote && parseFloat(quote.discountTotal) > 0 && (
            <div className="flex justify-between gap-3 text-wg-accent dark:text-wg-dark-accent">
              <span>{t("review.discount")}</span>
              <span className="shrink-0">−{sym}{quote.discountTotal}</span>
            </div>
          )}
          {fulfillment === "DELIVERY" && !noZone && (
            <div className="flex justify-between gap-3">
              <span className="text-wg-muted dark:text-wg-dark-muted">{t("review.deliveryFee")}</span>
              <span className="text-wg-text dark:text-wg-dark-text shrink-0">
                {quote && parseFloat(quote.deliveryFee) === 0 ? t("review.deliveryFree") : `${sym}${quote?.deliveryFee ?? "0.00"}`}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-wg-border/50 dark:border-wg-dark-border/50">
          <div className="flex justify-between items-end gap-3">
            <span className="text-sm font-semibold text-wg-text dark:text-wg-dark-text leading-tight">
              {t("review.totalToPay")}
            </span>
            <span className="text-xl font-bold tabular-nums text-wg-accent dark:text-wg-dark-accent shrink-0 tracking-tight">
              {sym}
              {quote?.total ?? "0.00"}
            </span>
          </div>
        </div>

        {quote && (
          <div className="mt-4 pt-4 border-t border-wg-border/40 dark:border-wg-dark-border/40">
            <div className="rounded-[0.65rem] bg-wg-primary/[0.06] dark:bg-wg-dark-primary/[0.12] border border-wg-border/30 dark:border-wg-dark-border/30 px-3 py-3">
              <p className="text-[10px] font-semibold text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide">
                {t("review.walletSection")}
              </p>
              <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1.5 leading-snug">{t("review.walletIntro")}</p>
              <p className="text-[10px] text-wg-muted dark:text-wg-dark-muted mt-1 leading-snug">{tWallet("testNote")}</p>

              <div className="mt-3 space-y-2 tabular-nums">
                <div className="flex justify-between gap-3 text-xs text-wg-muted dark:text-wg-dark-muted">
                  <span>{t("review.walletCurrent")}</span>
                  <span className="text-wg-text/80 dark:text-wg-dark-text/80 shrink-0">{sym}{walletBalanceNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end gap-3 pt-2 border-t border-dashed border-wg-border/50 dark:border-wg-dark-border/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text leading-snug">
                      {t("review.walletAfterShort")}
                    </p>
                    <p className="text-[10px] text-wg-muted dark:text-wg-dark-muted mt-0.5">{t("review.walletAfter")}</p>
                  </div>
                  <span
                    className={`text-lg font-semibold shrink-0 tracking-tight ${
                      walletAfterPayment < 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-wg-text dark:text-wg-dark-text"
                    }`}
                  >
                    {sym}
                    {walletAfterPayment.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fulfillment summary */}
      <div className="rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/40 dark:border-wg-dark-border/40 p-4 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-wg-muted dark:text-wg-dark-muted">{t("review.fulfillmentLabel")}</span>
          <span className="text-wg-text dark:text-wg-dark-text font-medium">
            {fulfillment === "PICKUP" ? t("review.pickupAt") : addressLabel || t("review.deliverTo")}
          </span>
        </div>
        {quote?.zone && fulfillment === "DELIVERY" && (
          <div className="flex justify-between text-sm mt-1.5">
            <span className="text-wg-muted dark:text-wg-dark-muted">{t("fulfillment.estimatedTime")}</span>
            <span className="text-wg-text dark:text-wg-dark-text">{t("fulfillment.minutes", { n: quote.zone.estimatedMinutes })}</span>
          </div>
        )}
        {noZone && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{t("fulfillment.noZone")}</p>
        )}
        {minOrder && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{t("errors.minOrder")}</p>
        )}
      </div>

      {/* Billing document summary */}
      {billing && (
        <div className="rounded-card bg-wg-bg dark:bg-wg-dark-raised border border-wg-border/40 dark:border-wg-dark-border/40 p-4 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-wg-muted dark:text-wg-dark-muted">{t("review.billingDocumentLabel")}</span>
            <span className="text-wg-text dark:text-wg-dark-text font-medium text-right">
              {billing.documentType === "BOLETA" ? t("billing.boleta") : t("billing.factura")}
            </span>
          </div>
          {billing.documentType === "FACTURA" && (
            <div className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1">
              {billing.fiscalRuc} — {billing.fiscalLegalName}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="mb-5">
        <label htmlFor={`${fieldId}-notes`} className="block text-xs font-medium text-wg-muted dark:text-wg-dark-muted uppercase tracking-wide mb-1.5">
          {t("review.notesLabel")}
        </label>
        <Textarea
          id={`${fieldId}-notes`}
            maxHeight={160}
          value={notes}
          onChange={setNotes}
          placeholder={t("review.notesPlaceholder")}
          maxLength={280}
          minRows={2}
          className="px-3 py-2 text-sm rounded-[0.5rem] border border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-raised text-wg-text dark:text-wg-dark-text placeholder-wg-muted dark:placeholder-wg-dark-muted focus:outline-none focus:ring-2 focus:ring-wg-accent/40 transition-all"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-[0.5rem] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-center mb-4">
        {t.rich("review.termsNote", {
          terms: (chunks) => (
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              title={t("review.termsOpensNewTab")}
              className="font-medium text-wg-accent dark:text-wg-dark-accent underline decoration-wg-accent/60 dark:decoration-wg-dark-accent/60 underline-offset-2 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-wg-accent/40 dark:focus-visible:ring-wg-dark-accent/40 rounded-sm"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 py-3 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 transition-all disabled:opacity-40"
        >
          {t("back")}
        </button>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex-[2] py-3 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner className="w-4 h-4 animate-spin" />
              {t("review.processing")}
            </>
          ) : (
            <>
              {t("review.confirmPay")}
              <CheckCircleIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main checkout component ───────────────────────────────────────

function CheckoutClientInner({ switches }: { switches: CheckoutSwitches }) {
  const t = useTranslations("checkout")
  const locale = useLocale() as "en" | "es"
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkoutDraftHydratedRef = useRef(false)
  const stepRef = useRef<Step>("cart")

  // State
  const [step, setStep] = useState<Step>("cart")
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>(() => availableFulfillment(switches, "PICKUP"))
  const [addressId, setAddressId] = useState("")
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const documentTypes = DOCUMENT_TYPES.filter((type) => isDocumentTypeOn(switches, type))
  const hasBillingStep = documentTypes.length > 0
  const steps = hasBillingStep ? STEPS : STEPS.filter((s) => s !== "billing")
  const [billing, setBilling] = useState<BillingData>(() => ({
    documentType: availableDocumentType(switches, "BOLETA"),
    buyerDni: "",
    fiscalRuc: "",
    fiscalLegalName: "",
    fiscalAddress: "",
  }))
  const [notes, setNotes] = useState("")
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaveModalDestination, setLeaveModalDestination] = useState<string | null>(null)
  // The address the payment was refused for with NO_ZONE or MIN_ORDER, and
  // which of the two. The delivery step says so while that address is still
  // the one selected.
  const [zoneRefusal, setZoneRefusal] = useState<{ addressId: string; notice: "noZone" | "minOrder" } | null>(null)
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const { isGuest, userId, isLoading: cartLoading } = useCart()

  stepRef.current = step

  const persistFieldsRef = useRef({
    userId,
    locale,
    step,
    fulfillment,
    addressId,
    billing,
    notes,
  })
  persistFieldsRef.current = { userId, locale, step, fulfillment, addressId, billing, notes }
  // The account the form was restored for. A sign in or out on this tab while
  // the page is open must not file what is on screen under another account.
  const draftOwnerRef = useRef<string | null>(null)

  const persistDraft = useCallback(() => {
    const { userId: current, ...fields } = persistFieldsRef.current
    if (!checkoutDraftHydratedRef.current || !current || current !== draftOwnerRef.current) return
    saveCheckoutDraft({ userId: current, ...fields })
  }, [])

  // Load saved addresses on mount (and when returning from account with a fresh session tab)
  useEffect(() => {
    if (isGuest) {
      setAddressesLoading(false)
      return
    }
    setAddressesLoading(true)
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setAddresses(d.data)
          setAddressId((prev) => {
            if (prev && d.data.some((a: SavedAddress) => a.id === prev)) return prev
            const defaultAddr = d.data.find((a: SavedAddress) => a.isDefault)
            return defaultAddr?.id ?? ""
          })
        }
      })
      .catch(() => null)
      .finally(() => setAddressesLoading(false))
  }, [isGuest])

  const fetchQuote = useCallback(
    async (overrides?: { fulfillment?: FulfillmentMethod; addressId?: string }) => {
      const f = overrides?.fulfillment ?? fulfillment
      const addr = overrides?.addressId ?? addressId
      setIsLoadingQuote(true)
      setError(null)
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fulfillment: f,
            addressId: f === "DELIVERY" ? addr : undefined,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setQuote(data.data)
        } else {
          setError(data.error ?? t("errors.generic"))
        }
      } catch {
        setError(t("errors.generic"))
      } finally {
        setIsLoadingQuote(false)
      }
    },
    [fulfillment, addressId, t],
  )

  // Restore draft + deep-link before first paint (avoids overwriting sessionStorage with defaults)
  useLayoutEffect(() => {
    if (cartLoading) return
    if (checkoutDraftHydratedRef.current) return
    checkoutDraftHydratedRef.current = true
    draftOwnerRef.current = userId

    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)
    } catch {
      raw = null
    }
    let draft = parseCheckoutDraft(raw)
    if (draft && Date.now() - draft.savedAt > CHECKOUT_DRAFT_MAX_AGE_MS) {
      clearCheckoutDraftStorage()
      draft = null
    }
    // Written by another account: the session ended without the sign out
    // button, and this tab is now a guest or someone else.
    if (draft && draft.userId !== userId) {
      clearCheckoutDraftStorage()
      draft = null
    }

    const stepParam = searchParams.get("step")
    if (stepParam === "fulfillment") {
      setStep("fulfillment")
      setFulfillment(availableFulfillment(switches, "DELIVERY"))
      if (draft) {
        if (draft.addressId) setAddressId(draft.addressId)
        setBilling({ ...draft.billing, documentType: availableDocumentType(switches, draft.billing.documentType) })
        setNotes(draft.notes)
      }
      router.replace("/checkout")
      return
    }

    // Restore regardless of stored locale so switching en ↔ es keeps step + form data
    if (!draft || isGuest) return

    // A draft saved before the owner switched something off resumes on what
    // is still on: the other fulfillment method, the other billing document or
    // no Billing step at all, and no review without a way to pay.
    const restoredFulfillment = availableFulfillment(switches, draft.fulfillment)
    const restoredDocumentType = availableDocumentType(switches, draft.billing.documentType)
    const billingStepOn = switches.boletaEnabled || switches.facturaEnabled
    let nextStep = draft.step
    if (!isStep(nextStep)) nextStep = "cart"
    if (restoredFulfillment !== draft.fulfillment && nextStep !== "cart") nextStep = "fulfillment"
    if (billingStepOn && restoredDocumentType !== draft.billing.documentType && (nextStep === "payment" || nextStep === "review")) {
      nextStep = "billing"
    }
    if (!billingStepOn && nextStep === "billing") nextStep = "payment"
    if (!switches.walletEnabled && nextStep === "review") nextStep = "payment"
    setStep(nextStep)
    setFulfillment(restoredFulfillment)
    if (draft.addressId) setAddressId(draft.addressId)
    setBilling({ ...draft.billing, documentType: restoredDocumentType })
    setNotes(draft.notes)

    if (nextStep === "payment" || nextStep === "review") {
      void fetchQuote({ fulfillment: restoredFulfillment, addressId: draft.addressId })
    }
  }, [cartLoading, fetchQuote, isGuest, locale, router, searchParams, switches, userId])

  // Persist checkout draft (session tab) after hydration
  useEffect(() => {
    if (cartLoading) return
    persistDraft()
  }, [persistDraft, cartLoading, userId, locale, step, fulfillment, addressId, billing, notes])

  // Drop invalid restored address once the list is available
  useEffect(() => {
    if (addressesLoading || !addressId || addresses.length === 0) return
    if (!addresses.some((a) => a.id === addressId)) setAddressId("")
  }, [addressId, addresses, addressesLoading])

  // Signing out from this page: nothing on screen belongs to anyone any more
  useEffect(() => {
    const disown = () => {
      draftOwnerRef.current = null
    }
    window.addEventListener(CHECKOUT_DRAFT_SIGNED_OUT_EVENT, disown)
    return () => window.removeEventListener(CHECKOUT_DRAFT_SIGNED_OUT_EVENT, disown)
  }, [])

  // Flush draft on tab close / refresh / mobile background (best-effort)
  useEffect(() => {
    window.addEventListener("pagehide", persistDraft)
    return () => window.removeEventListener("pagehide", persistDraft)
  }, [persistDraft])

  // Confirm before leaving checkout via in-app links (refresh/close only saves; no blocking dialog)
  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (stepRef.current === "cart" || isGuest) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const el = event.target
      if (!(el instanceof Element)) return
      const a = el.closest("a[href]")
      if (!a || !(a instanceof HTMLAnchorElement)) return
      if (a.target === "_blank" || a.hasAttribute("download")) return
      const hrefAttr = a.getAttribute("href")
      if (!hrefAttr || hrefAttr.startsWith("#")) return
      if (hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) return

      let url: URL
      try {
        url = new URL(a.href, window.location.origin)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      const path = pathnameWithoutLocale(url.pathname, locale)
      if (path === "/checkout") return
      if (path.startsWith("/account/addresses") && url.searchParams.get("resumeCheckout") === "1") return

      event.preventDefault()
      event.stopPropagation()
      const dest = `${path}${url.search}${url.hash}`
      setLeaveModalDestination(dest)
    }

    document.addEventListener("click", onClickCapture, true)
    return () => document.removeEventListener("click", onClickCapture, true)
  }, [isGuest, locale, router])

  const goToStep = useCallback(
    async (next: Step) => {
      // Fetch quote when entering payment step (to show balance + total)
      // or review step (final summary)
      if (next === "payment" || next === "review") {
        await fetchQuote()
      }
      setStep(next)
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [fetchQuote],
  )

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment,
          idempotencyKey: idempotencyKeyRef.current,
          paymentMethod: "WALLET",
          addressId: fulfillment === "DELIVERY" ? addressId : undefined,
          notes: notes || undefined,
          locale,
          // Without a Billing step the order is placed without a document.
          billing: !hasBillingStep
            ? undefined
            : billing.documentType === "BOLETA"
              ? { documentType: "BOLETA", buyerDni: billing.buyerDni || undefined }
              : {
                  documentType: "FACTURA",
                  fiscalRuc: billing.fiscalRuc,
                  fiscalLegalName: billing.fiscalLegalName,
                  fiscalAddress: billing.fiscalAddress || undefined,
                },
        }),
      })
      const data = await res.json()
      if (data.success) {
        clearCheckoutDraftStorage()
        router.push(`/order-confirmation/${data.data.orderNumber}`)
      } else {
        if (data.code === "IDEMPOTENCY_CONFLICT") {
          idempotencyKeyRef.current = crypto.randomUUID()
        }
        if (data.code === "INSUFFICIENT_BALANCE") {
          setError(t("errors.insufficientBalance"))
        } else if (data.code === "NO_ZONE") {
          setError(t("errors.noZone"))
          setZoneRefusal({ addressId, notice: "noZone" })
          setStep("fulfillment")
        } else if (data.code === "MIN_ORDER") {
          setError(t("errors.minOrder"))
          setZoneRefusal({ addressId, notice: "minOrder" })
          setStep("fulfillment")
        } else if (data.code === "CART_EMPTY") {
          setError(t("errors.cartEmpty"))
        } else if (data.code === "ITEM_UNAVAILABLE") {
          setError(t("errors.itemUnavailable"))
        } else if (data.code === "PAYMENT_METHOD_DISABLED") {
          setError(t("payment.walletDisabled"))
        } else if (data.code === "FULFILLMENT_DISABLED") {
          setError(t("errors.fulfillmentUnavailable"))
        } else if (data.code === "DOCUMENT_TYPE_DISABLED") {
          setError(t("errors.documentTypeUnavailable"))
        } else if (data.code === "CURRENCY_UNAVAILABLE") {
          // The quote moves the cart to the store currency, so the review shows what will be charged.
          await fetchQuote()
          setError(t("errors.currencyUnavailable"))
        } else if (data.code === "CART_CHANGED" || data.code === "IDEMPOTENCY_CONFLICT") {
          setError(t("errors.generic"))
        } else {
          setError(data.error ?? t("errors.generic"))
        }
      }
    } catch {
      setError(t("errors.generic"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedAddress = addresses.find((a) => a.id === addressId)
  const addressLabel = selectedAddress
    ? [selectedAddress.label, selectedAddress.fullAddress].filter(Boolean).join(", ")
    : ""

  return (
    <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        {/* Title */}
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-wg-text dark:text-wg-dark-text text-center mb-2">
          {t("title")}
        </h1>

        <StepIndicator current={step} steps={steps} />

        {/* Card */}
        <div className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-5 sm:p-7">
          {/* Step title */}
          <h2 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-4 capitalize">
            {t(`steps.${step}`)}
          </h2>

          {step === "cart" && <CartStep onNext={() => goToStep("fulfillment")} />}

          {step === "fulfillment" && (
            <FulfillmentStep
              fulfillment={fulfillment}
              setFulfillment={setFulfillment}
              addressId={addressId}
              setAddressId={setAddressId}
              addresses={addresses}
              addressesLoading={addressesLoading}
              methods={FULFILLMENT_METHODS.filter((m) => isFulfillmentOn(switches, m))}
              zoneNotice={
                fulfillment === "DELIVERY" && addressId !== "" && addressId === zoneRefusal?.addressId
                  ? t(`errors.${zoneRefusal.notice}`)
                  : null
              }
              nextStep={hasBillingStep ? "billing" : "payment"}
              onNext={() => goToStep(hasBillingStep ? "billing" : "payment")}
              onBack={() => setStep("cart")}
            />
          )}

          {step === "billing" && (
            <BillingStep
              billing={billing}
              setBilling={setBilling}
              documentTypes={documentTypes}
              onNext={() => goToStep("payment")}
              onBack={() => setStep("fulfillment")}
            />
          )}

          {step === "payment" && (
            <PaymentStep
              walletBalance={quote?.walletBalance ?? "0.00"}
              currency={quote?.currency ?? "PEN"}
              quoteTotal={quote?.total ?? "0.00"}
              walletEnabled={switches.walletEnabled}
              onNext={() => goToStep("review")}
              onBack={() => setStep(hasBillingStep ? "billing" : "fulfillment")}
            />
          )}

          {step === "review" && (
            <>
              {isLoadingQuote ? (
                <div className="flex justify-center py-12">
                  <Spinner className="w-7 h-7 animate-spin text-wg-accent dark:text-wg-dark-accent" />
                </div>
              ) : (
                <ReviewStep
                  quote={quote}
                  fulfillment={fulfillment}
                  addressLabel={addressLabel}
                  billing={hasBillingStep ? billing : null}
                  notes={notes}
                  setNotes={setNotes}
                  onConfirm={handleConfirm}
                  onBack={() => setStep("payment")}
                  isSubmitting={isSubmitting}
                  error={error}
                />
              )}
            </>
          )}
        </div>
      </div>

      {leaveModalDestination && (
        <CheckoutLeaveModal
          onStay={() => setLeaveModalDestination(null)}
          onKeepAndLeave={() => {
            const dest = leaveModalDestination
            persistDraft()
            router.push(dest)
            setLeaveModalDestination(null)
          }}
          onDiscardAndLeave={() => {
            const dest = leaveModalDestination
            clearCheckoutDraftStorage()
            router.push(dest)
            setLeaveModalDestination(null)
          }}
        />
      )}
    </div>
  )
}

function CheckoutClientFallback() {
  const t = useTranslations("checkout")
  return (
    <div className="min-h-screen bg-wg-bg dark:bg-wg-dark-bg pt-28 pb-20 flex flex-col items-center justify-center gap-4 px-4">
      <Spinner className="w-9 h-9 animate-spin text-wg-accent dark:text-wg-dark-accent" />
      <p className="text-sm text-wg-muted dark:text-wg-dark-muted">{t("loading")}</p>
    </div>
  )
}

export function CheckoutClient({ switches }: { switches: CheckoutSwitches }) {
  return (
    <Suspense fallback={<CheckoutClientFallback />}>
      <CheckoutClientInner switches={switches} />
    </Suspense>
  )
}
