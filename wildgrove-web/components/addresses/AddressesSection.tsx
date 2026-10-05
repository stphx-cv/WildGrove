"use client"

// ══════════════════════════════════════════════════════════════════
// AddressesSection
//
// Full CRUD for user delivery addresses — page: /[locale]/account/addresses.
// - List of saved addresses with default badge
// - Add / Edit form with AddressAutocomplete + optional MapPicker
// - Delete with confirmation
// - Set as default toggle
// ══════════════════════════════════════════════════════════════════

import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/routing"
import { APIProvider } from "@wildgrove/ui/places/maps"
import { Switch } from "@wildgrove/ui/Switch"
import { AddressAutocomplete, type PlaceDetails } from "@wildgrove/ui/places/AddressAutocomplete"
import {
    ArrowRightIcon,
    CloseIcon,
    MapPinIcon,
    PencilSquareIcon,
    PhoneFlatCornerIcon,
    PlusIcon,
    StarOutlineIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// MapPicker is lazy-loaded so the Google Maps SDK is only fetched
// when the user expands the form.
const MapPicker = lazy(() =>
  import("@wildgrove/ui/places/MapPicker").then((m) => ({ default: m.MapPicker })),
)

// ── Types ─────────────────────────────────────────────────────────

export interface UserAddress {
  id: string
  label: string | null
  recipientName: string | null
  phone: string | null
  fullAddress: string
  detail: string | null
  lat: number | null
  lng: number | null
  country: string | null
  region: string | null
  province: string | null
  district: string | null
  isDefault: boolean
  createdAt: string
}

interface AddressFormState {
  label: string
  recipientName: string
  phone: string
  fullAddress: string
  detail: string
  lat: number | null
  lng: number | null
  country: string | null
  region: string | null
  province: string | null
  district: string | null
  isDefault: boolean
}

const EMPTY_FORM: AddressFormState = {
  label: "",
  recipientName: "",
  phone: "",
  fullAddress: "",
  detail: "",
  lat: null,
  lng: null,
  country: null,
  region: null,
  province: null,
  district: null,
  isDefault: false,
}

// ── Reusable field input ──────────────────────────────────────────

function FieldInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  optional,
  maxLength,
  type = "text",
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  optional?: boolean
  maxLength?: number
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5"
      >
        {label}
        {optional && (
          <span className="ml-1 text-xs text-wg-muted dark:text-wg-dark-muted font-normal">
            (optional)
          </span>
        )}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={[
          "w-full px-4 py-2.5 rounded-brand border",
          "bg-wg-bg dark:bg-wg-dark-bg",
          "text-wg-text dark:text-wg-dark-text",
          "border-wg-border dark:border-wg-dark-border",
          "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50",
          "focus:outline-none focus:ring-2 focus:ring-wg-primary/30 dark:focus:ring-wg-dark-primary/30",
          "focus:border-wg-primary dark:focus:border-wg-dark-primary",
          "transition-colors text-sm",
        ].join(" ")}
      />
    </div>
  )
}

// ── Address card ──────────────────────────────────────────────────

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  isSettingDefault,
}: {
  address: UserAddress
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  isSettingDefault: boolean
}) {
  const t = useTranslations("addresses")

  const adminStr = [address.district, address.province, address.region]
    .filter(Boolean)
    .join(", ")

  return (
    <div
      className={[
        "relative group rounded-brand border p-4 sm:p-5 transition-all",
        address.isDefault
          ? "border-wg-primary/40 dark:border-wg-dark-primary/40 bg-wg-primary/5 dark:bg-wg-dark-primary/5"
          : "border-wg-border dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg hover:border-wg-primary/30 dark:hover:border-wg-dark-primary/30",
      ].join(" ")}
    >
      {/* Default badge */}
      {address.isDefault && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-wg-primary/15 dark:bg-wg-dark-primary/15 text-wg-primary dark:text-wg-dark-primary">
          {t("default")}
        </span>
      )}

      {/* Label */}
      {address.label && (
        <p className="text-xs font-semibold uppercase tracking-wide text-wg-muted dark:text-wg-dark-muted mb-2">
          {address.label}
        </p>
      )}

      {/* Recipient */}
      {address.recipientName && (
        <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
          {address.recipientName}
        </p>
      )}

      {/* Address */}
      <p className="text-sm text-wg-text dark:text-wg-dark-text leading-snug mt-0.5">
        {address.fullAddress}
      </p>
      {address.detail && (
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
          {address.detail}
        </p>
      )}
      {adminStr && (
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-0.5">
          {adminStr}
        </p>
      )}

      {/* Phone */}
      {address.phone && (
        <p className="text-xs text-wg-muted dark:text-wg-dark-muted mt-1 flex items-center gap-1">
          <PhoneFlatCornerIcon className="w-3 h-3" strokeWidth={2} />
          {address.phone}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-wg-border/50 dark:border-wg-dark-border/50 flex flex-wrap items-stretch gap-2">
        {!address.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            disabled={isSettingDefault}
            className="inline-flex flex-1 min-w-[8.5rem] sm:flex-initial items-center justify-center gap-1.5 px-3 py-2 rounded-brand text-xs font-semibold border border-wg-primary/35 dark:border-wg-dark-primary/35 bg-wg-primary/8 dark:bg-wg-dark-primary/10 text-wg-primary dark:text-wg-dark-primary hover:bg-wg-primary/15 dark:hover:bg-wg-dark-primary/20 transition-colors disabled:opacity-50"
          >
            <StarOutlineIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
            {isSettingDefault ? t("settingDefault") : t("setAsDefault")}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 min-w-[6rem] sm:flex-initial items-center justify-center gap-1.5 px-3 py-2 rounded-brand text-xs font-semibold border border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text hover:border-wg-accent/50 dark:hover:border-wg-dark-accent/50 hover:text-wg-accent dark:hover:text-wg-dark-accent transition-colors"
        >
          <PencilSquareIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex flex-1 min-w-[6rem] sm:flex-initial sm:ml-auto items-center justify-center gap-1.5 px-3 py-2 rounded-brand text-xs font-semibold border border-red-500/40 dark:border-red-400/35 bg-red-500/10 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/15 dark:hover:bg-red-500/20 transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
          {t("delete")}
        </button>
      </div>
    </div>
  )
}

// ── Address form modal ────────────────────────────────────────────

function AddressFormModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial: AddressFormState
  onSave: (data: AddressFormState) => void
  onClose: () => void
  isSaving: boolean
}) {
  const t = useTranslations("addresses")
  const formId = useId()
  const [form, setForm] = useState<AddressFormState>(initial)
  const [showMap, setShowMap] = useState(
    initial.lat !== null && initial.lng !== null,
  )
  const overlayRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof AddressFormState>(
    key: K,
    value: AddressFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  const handlePlaceSelect = (details: PlaceDetails) => {
    setForm((prev) => ({
      ...prev,
      fullAddress: details.fullAddress,
      lat: details.lat,
      lng: details.lng,
      country: details.country,
      region: details.region,
      province: details.province,
      district: details.district,
    }))
    if (details.lat !== null && details.lng !== null) {
      setShowMap(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullAddress.trim()) return
    onSave(form)
  }

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <div className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-card sm:rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated animate-fade-up">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface z-10">
          <h3
            id={`${formId}-title`}
            className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text"
          >
            {initial.fullAddress ? t("editAddress") : t("addAddress")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-wg-muted dark:text-wg-dark-muted hover:bg-wg-border/50 dark:hover:bg-wg-dark-border/50 transition-colors"
            aria-label={t("closeModal")}
          >
            <CloseIcon className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <form id={formId} onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Address search */}
          <AddressAutocomplete
            label={t("fullAddress")}
            value={form.fullAddress}
            onAddressSelect={handlePlaceSelect}
            placeholder={t("searchPlaceholder")}
            required
          />

          {/* Manual override note */}
          <p className="text-xs text-wg-muted dark:text-wg-dark-muted -mt-2">
            {t("manualHint")}
          </p>

          {/* Manual address input (fallback) */}
          {!form.lat && (
            <FieldInput
              id={`${formId}-manual`}
              label={t("orTypeManually")}
              value={form.fullAddress}
              onChange={(v) => set("fullAddress", v)}
              placeholder={t("fullAddressPlaceholder")}
              maxLength={255}
              optional
            />
          )}

          {/* Map */}
          {form.lat !== null && form.lng !== null && showMap && (
            <Suspense
              fallback={
                <div className="h-56 rounded-brand bg-wg-border/30 dark:bg-wg-dark-border/30 animate-pulse" />
              }
            >
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                  {t("confirmPin")}
                </p>
                <MapPicker
                  lat={form.lat}
                  lng={form.lng}
                  onChange={(lat, lng) => setForm((prev) => ({ ...prev, lat, lng }))}
                />
              </div>
            </Suspense>
          )}

          {/* Show map toggle when we have coords */}
          {form.lat !== null && form.lng !== null && !showMap && (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="text-xs text-wg-primary dark:text-wg-dark-primary hover:underline transition-colors"
            >
              {t("showMap")}
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              id={`${formId}-label`}
              label={t("label")}
              value={form.label}
              onChange={(v) => set("label", v)}
              placeholder={t("labelPlaceholder")}
              maxLength={40}
              optional
            />
            <FieldInput
              id={`${formId}-detail`}
              label={t("detail")}
              value={form.detail}
              onChange={(v) => set("detail", v)}
              placeholder={t("detailPlaceholder")}
              maxLength={140}
              optional
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              id={`${formId}-recipient`}
              label={t("recipientName")}
              value={form.recipientName}
              onChange={(v) => set("recipientName", v)}
              placeholder={t("recipientNamePlaceholder")}
              maxLength={80}
              optional
            />
            <FieldInput
              id={`${formId}-phone`}
              label={t("phone")}
              value={form.phone}
              onChange={(v) => set("phone", v)}
              placeholder="+51 987 654 321"
              type="tel"
              maxLength={20}
              optional
            />
          </div>

          {/* Default toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <Switch
              size="sm"
              checked={form.isDefault}
              onChange={(next) => set("isDefault", next)}
              label={t("setAsDefault")}
            />
            <span className="text-sm text-wg-text dark:text-wg-dark-text">
              {t("setAsDefault")}
            </span>
          </label>
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-wg-border dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/40 dark:hover:border-wg-dark-primary/40 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isSaving || !form.fullAddress.trim()}
            className="px-5 py-2 text-sm font-medium rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm dialog ─────────────────────────────────────────

function DeleteConfirmDialog({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  const t = useTranslations("addresses")
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onCancel])

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border dark:border-wg-dark-border shadow-elevated p-6 animate-fade-up">
        <h3 className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">
          {t("deleteTitle")}
        </h3>
        <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-6">
          {t("deleteDescription")}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/40 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium rounded-brand bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
          >
            {isDeleting ? t("deleting") : t("confirmDelete")}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────

function AddressesSectionInner() {
  const t = useTranslations("addresses")
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeCheckout = searchParams.get("resumeCheckout") === "1"
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<AddressFormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Default state
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/addresses")
      const json = (await res.json()) as {
        success: boolean
        data?: UserAddress[]
        error?: string
      }
      if (json.success) {
        setAddresses(json.data ?? [])
      } else {
        setError(json.error ?? "Failed to load addresses")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // ── Handlers ─────────────────────────────────────────────────────

  const handleAddClick = () => {
    setFormInitial(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const handleEditClick = (addr: UserAddress) => {
    setFormInitial({
      label: addr.label ?? "",
      recipientName: addr.recipientName ?? "",
      phone: addr.phone ?? "",
      fullAddress: addr.fullAddress,
      detail: addr.detail ?? "",
      lat: addr.lat,
      lng: addr.lng,
      country: addr.country,
      region: addr.region,
      province: addr.province,
      district: addr.district,
      isDefault: addr.isDefault,
    })
    setEditingId(addr.id)
    setShowForm(true)
  }

  const handleSave = async (data: AddressFormState) => {
    setIsSaving(true)
    try {
      const body = {
        label: data.label || null,
        recipientName: data.recipientName || null,
        phone: data.phone || null,
        fullAddress: data.fullAddress,
        detail: data.detail || null,
        lat: data.lat,
        lng: data.lng,
        country: data.country,
        region: data.region,
        province: data.province,
        district: data.district,
        isDefault: data.isDefault,
      }

      const url = editingId ? `/api/addresses/${editingId}` : "/api/addresses"
      const method = editingId ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = (await res.json()) as { success: boolean; error?: string }
      if (json.success) {
        setShowForm(false)
        await load()
        if (searchParams.get("resumeCheckout") === "1") {
          router.push({ pathname: "/checkout", query: { step: "fulfillment" } })
        }
      } else {
        setError(json.error ?? "Failed to save address")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/addresses/${deletingId}`, { method: "DELETE" })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (json.success) {
        setDeletingId(null)
        await load()
      } else {
        setError(json.error ?? "Failed to delete address")
        setDeletingId(null)
      }
    } catch {
      setError("Network error. Please try again.")
      setDeletingId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id)
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (json.success) {
        await load()
      } else {
        setError(json.error ?? "Failed to set default")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSettingDefaultId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      {resumeCheckout && (
        <div
          role="status"
          className="mb-4 rounded-card border-2 border-wg-accent/45 dark:border-wg-dark-accent/45 bg-wg-accent/8 dark:bg-wg-dark-accent/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="min-w-0">
            <p className="font-display text-sm sm:text-base font-semibold text-wg-text dark:text-wg-dark-text">
              {t("resumeFromCheckoutTitle")}
            </p>
            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-1 leading-relaxed">
              {t("resumeFromCheckoutBody")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Link
              href="/checkout?step=fulfillment"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition-opacity text-center"
            >
              {t("continueToCheckout")}
              <ArrowRightIcon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            </Link>
            <button
              type="button"
              onClick={() => router.replace("/account/addresses")}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-brand border border-wg-border dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
            >
              {t("dismissResumeBanner")}
            </button>
          </div>
        </div>
      )}

      <section
        aria-labelledby="addresses-heading"
        className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-6 sm:p-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              id="addresses-heading"
              className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text"
            >
              {t("title")}
            </h2>
            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
              {t("subtitle")}
            </p>
          </div>

          {addresses.length < 10 && (
            <button
              type="button"
              onClick={handleAddClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-brand bg-wg-accent text-white hover:bg-wg-accent-hover transition-opacity shrink-0"
            >
              <PlusIcon className="w-4 h-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">{t("addAddress")}</span>
              <span className="sm:hidden">{t("add")}</span>
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
              aria-label={t("dismissResumeBanner")}
            >
              <CloseIcon className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-36 rounded-brand bg-wg-border/30 dark:bg-wg-dark-border/30 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && addresses.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-wg-border/30 dark:bg-wg-dark-border/30 flex items-center justify-center">
              <MapPinIcon className="w-6 h-6 text-wg-muted dark:text-wg-dark-muted" />
            </div>
            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-4">
              {t("emptyState")}
            </p>
            <button
              type="button"
              onClick={handleAddClick}
              className="text-sm font-medium text-wg-primary dark:text-wg-dark-primary hover:underline transition-colors"
            >
              {t("addFirstAddress")}
            </button>
          </div>
        )}

        {/* Address list */}
        {!isLoading && addresses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <AddressCard
                key={addr.id}
                address={addr}
                onEdit={() => handleEditClick(addr)}
                onDelete={() => setDeletingId(addr.id)}
                onSetDefault={() => handleSetDefault(addr.id)}
                isSettingDefault={settingDefaultId === addr.id}
              />
            ))}
          </div>
        )}

        {/* Max limit note */}
        {addresses.length >= 10 && (
          <p className="mt-4 text-xs text-wg-muted dark:text-wg-dark-muted">
            {t("maxAddresses")}
          </p>
        )}
      </section>

      {/* Form modal — wrapped in APIProvider so AddressAutocomplete and MapPicker can use useMapsLibrary */}
      {showForm && (
        <APIProvider apiKey={MAPS_API_KEY}>
          <AddressFormModal
            initial={formInitial}
            onSave={handleSave}
            onClose={() => setShowForm(false)}
            isSaving={isSaving}
          />
        </APIProvider>
      )}

      {/* Delete confirm */}
      {deletingId && (
        <DeleteConfirmDialog
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
          isDeleting={isDeleting}
        />
      )}
    </>
  )
}

function AddressesSectionSkeleton() {
  return (
    <div
      className="rounded-card bg-wg-surface dark:bg-wg-dark-surface border border-wg-border/50 dark:border-wg-dark-border shadow-card p-6 sm:p-8 min-h-[240px] flex items-center justify-center"
      aria-hidden
    >
      <div className="h-10 w-48 rounded-brand bg-wg-border/40 dark:bg-wg-dark-border/40 animate-pulse" />
    </div>
  )
}

export function AddressesSection() {
  return (
    <Suspense fallback={<AddressesSectionSkeleton />}>
      <AddressesSectionInner />
    </Suspense>
  )
}
