"use client"

import { useState, useCallback, useReducer, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { AdminSelect } from "@/components/AdminSelect"
import { AdminDatePicker } from "@/components/AdminDatePicker"
import { AdminNumberInput } from "@/components/AdminNumberInput"
import { Switch } from "@wildgrove/ui/Switch"
import { DraftGuardModal } from "@/components/DraftGuardModal"
import { useDraftGuard } from "@/hooks/useDraftGuard"
import { getDiscountPublishBlockedReason } from "@wildgrove/core/admin-validation"
import { getCurrencySymbol, type SupportedCurrency } from "@wildgrove/core/currency"
import { Textarea } from "@wildgrove/ui/Textarea"
import {
    CalendarBandIcon,
    ChartBarIcon,
    CheckCompactIcon,
    ClipboardListIcon,
    ClockRightAngleIcon,
    CloseIcon,
    DocumentTextIcon,
    KeyIcon,
    Spinner,
    UserIcon,
} from "@wildgrove/ui/icons"

// ── Types ──

interface DiscountDraftContent {
    formState: FormState
    savedAt: string
}

interface DiscountData {
    id?: string
    name: string
    description: string | null
    type: "COUPON" | "AUTOMATIC"
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    valueUsd?: number | null
    code: string | null
    menuItemId: string | null
    categoryId?: string | null
    categoryIds?: string[]
    validFrom: string | null
    validUntil: string | null
    usageLimit: number | null
    perUserLimit: number | null
    active: boolean
    applyToNone?: boolean
    excludedItemIds?: string[]
    isDraft?: boolean
    draftData?: DiscountDraftContent | null
}

interface CategoryOption {
    id: string
    name: string
    items: { id: string; name: string; nameEs: string | null }[]
}

interface DiscountFormProps {
    initialData?: DiscountData
    categories?: CategoryOption[]
}

// ── Form state ──

interface FormState {
    name: string
    description: string
    type: "COUPON" | "AUTOMATIC"
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: string
    valueUsd: string
    code: string
    targetType: "none" | "all" | "allExcept" | "category" | "item"
    menuItemId: string
    categoryIds: string[]
    excludedItemIds: string[]
    validFrom: string
    validUntil: string
    usageLimit: string
    perUserLimit: string
    active: boolean
}

type FormAction =
    | { type: "SET_FIELD"; field: keyof FormState; value: FormState[keyof FormState] }
    | { type: "TOGGLE_EXCLUDED_ITEM"; itemId: string }
    | { type: "SET_EXCLUDED_ITEMS"; ids: string[] }
    | { type: "TOGGLE_CATEGORY"; categoryId: string }
    | { type: "SET_CATEGORIES"; ids: string[] }
    | { type: "RESTORE_STATE"; state: FormState }

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case "SET_FIELD":
            return { ...state, [action.field]: action.value }
        case "TOGGLE_EXCLUDED_ITEM":
            return {
                ...state,
                excludedItemIds: state.excludedItemIds.includes(action.itemId)
                    ? state.excludedItemIds.filter((id) => id !== action.itemId)
                    : [...state.excludedItemIds, action.itemId],
            }
        case "SET_EXCLUDED_ITEMS":
            return { ...state, excludedItemIds: action.ids }
        case "TOGGLE_CATEGORY":
            return {
                ...state,
                categoryIds: state.categoryIds.includes(action.categoryId)
                    ? state.categoryIds.filter((id) => id !== action.categoryId)
                    : [...state.categoryIds, action.categoryId],
            }
        case "SET_CATEGORIES":
            return { ...state, categoryIds: action.ids }
        case "RESTORE_STATE":
            return {
                ...action.state,
                valueUsd: action.state.valueUsd ?? "",
                categoryIds: action.state.categoryIds ?? [],
                excludedItemIds: action.state.excludedItemIds ?? [],
            }
        default:
            return state
    }
}

function getInitialState(data?: DiscountData): FormState {
    // Draft items: restore from draftData.formState if present
    if (data?.isDraft && data?.draftData?.formState) {
        const restored = data.draftData.formState
        return {
            ...restored,
            valueUsd: restored.valueUsd
                ?? (restored.valueType === "FIXED_AMOUNT" ? restored.value : ""),
            categoryIds: restored.categoryIds ?? [],
            excludedItemIds: restored.excludedItemIds ?? [],
        }
    }
    const savedCategoryIds = data?.categoryIds?.length
        ? data.categoryIds
        : data?.categoryId
            ? [data.categoryId]
            : []
    const targetType = data?.applyToNone
        ? "none"
        : data?.menuItemId
            ? "item"
            : savedCategoryIds.length > 0
                ? "category"
                : (data?.excludedItemIds?.length ?? 0) > 0
                    ? "allExcept"
                    : "all"
    return {
        name: data?.name ?? "",
        description: data?.description ?? "",
        type: data?.type === "COUPON" ? "COUPON" : "AUTOMATIC",
        valueType: data?.valueType ?? "PERCENTAGE",
        value: data?.value !== undefined ? String(data.value) : "",
        valueUsd: data?.valueUsd != null
            ? String(data.valueUsd)
            : (data?.valueType === "FIXED_AMOUNT" && data?.value !== undefined ? String(data.value) : ""),
        code: data?.code ?? "",
        targetType,
        menuItemId: data?.menuItemId ?? "",
        categoryIds: savedCategoryIds,
        excludedItemIds: data?.excludedItemIds ?? [],
        validFrom: data?.validFrom ? data.validFrom.slice(0, 16) : "",
        validUntil: data?.validUntil ? data.validUntil.slice(0, 16) : "",
        usageLimit: data?.usageLimit ? String(data.usageLimit) : "",
        perUserLimit: data?.perUserLimit ? String(data.perUserLimit) : "",
        active: data?.active ?? true,
    }
}

// Shared input class
const inputCls =
    "w-full px-3 py-2 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface text-wg-text dark:text-wg-dark-text focus:outline-none focus:ring-2 focus:ring-wg-accent/30 focus:border-wg-accent dark:focus:border-wg-dark-accent"

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <div className="pb-2 border-b border-wg-border/30 dark:border-wg-dark-border">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                {children}
            </h3>
        </div>
    )
}

function CouponCodeField({
    value,
    onChange,
    inputCls,
}: {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    inputCls: string
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                Coupon Code <span className="text-red-500">*</span>
            </label>
            <input
                type="text" value={value} onChange={onChange}
                required minLength={3} maxLength={20}
                className={`${inputCls} uppercase font-mono`}
                placeholder="e.g. WILDGROVE20"
            />
        </div>
    )
}

// ── Type config for preview panel ──

const TYPE_CONFIG = {
    COUPON: {
        label: "Coupon",
        gradient: "from-amber-600/90 to-amber-900",
        badge: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    },
    AUTOMATIC: {
        label: "Automatic",
        gradient: "from-emerald-600/90 to-emerald-900",
        badge: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    },
} as const

// ── Live Preview Panel ──

function DiscountPreview({ state, categories }: { state: FormState; categories: CategoryOption[] }) {
    const rawValue = parseFloat(state.value)
    const hasValue = state.value.length > 0 && !isNaN(rawValue) && rawValue > 0
    const rawUsd = parseFloat(state.valueUsd)
    const hasUsd = state.valueUsd.length > 0 && !isNaN(rawUsd) && rawUsd > 0
    const config = TYPE_CONFIG[state.type]

    const pctLabel = hasValue
        ? `${Number.isInteger(rawValue) ? rawValue : rawValue.toFixed(2)}% OFF`
        : null
    const penLabel = hasValue ? `${getCurrencySymbol("PEN")}${rawValue.toFixed(2)} OFF` : null
    const usdLabel = hasUsd ? `${getCurrencySymbol("USD")}${rawUsd.toFixed(2)} OFF` : null

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

    const targetLabel = (() => {
        if (state.targetType === "none") return "None (parked)"
        if (state.targetType === "allExcept") {
            const n = state.excludedItemIds.length
            return n === 0 ? "All items, Except…" : `All items (${n} excluded)`
        }
        if (state.targetType === "item" && state.menuItemId) {
            const item = categories.flatMap((c) => c.items).find((i) => i.id === state.menuItemId)
            return item?.name ?? "Specific item"
        }
        if (state.targetType === "category") {
            const n = state.categoryIds.length
            if (n === 0) return "Specific categories"
            if (n === 1) {
                return categories.find((c) => c.id === state.categoryIds[0])?.name ?? "1 category"
            }
            return `${n} categories`
        }
        return "All items"
    })()

    const restrictionRows = [
        {
            label: "Applies to",
            value: targetLabel,
            icon: (
                <ClipboardListIcon className="w-3.5 h-3.5" strokeWidth={2} />
            ),
        },
        {
            label: "Total uses",
            value: state.usageLimit ? `${state.usageLimit}×` : "Unlimited",
            icon: (
                <ChartBarIcon className="w-3.5 h-3.5" strokeWidth={2} />
            ),
        },
        {
            label: "Per customer",
            value: state.perUserLimit ? `${state.perUserLimit}×` : "Unlimited",
            icon: (
                <UserIcon className="w-3.5 h-3.5" strokeWidth={2} />
            ),
        },
        {
            label: "Validity",
            value: state.validFrom || state.validUntil
                ? `${state.validFrom ? fmtDate(state.validFrom) : "Now"} → ${state.validUntil ? fmtDate(state.validUntil) : "∞"}`
                : "Always active",
            icon: (
                <CalendarBandIcon className="w-3.5 h-3.5" strokeWidth={2} />
            ),
        },
    ]

    return (
        <div className="sticky top-6 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                Live Preview
            </p>

            {/* Discount card */}
            <div className="rounded-card overflow-hidden border border-wg-border/40 dark:border-wg-dark-border shadow-card">
                {/* Gradient header */}
                <div className={`bg-gradient-to-br ${config.gradient} px-6 py-6 relative overflow-hidden`}>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
                    <div className="absolute right-4 -bottom-6 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-2 mb-5">
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${config.badge}`}>
                                {config.label}
                            </span>
                            <span className={`text-[11px] px-2.5 py-1 rounded-full border ${
                                state.active
                                    ? "bg-green-400/15 text-green-300 border-green-400/30"
                                    : "bg-gray-400/15 text-gray-400 border-gray-400/30"
                            }`}>
                                {state.active ? "● Active" : "○ Inactive"}
                            </span>
                        </div>

                        {state.valueType === "PERCENTAGE" ? (
                            pctLabel ? (
                                <p className="text-5xl font-extrabold text-white tracking-tight leading-none">
                                    {pctLabel}
                                </p>
                            ) : (
                                <p className="text-5xl font-extrabold text-white/20 tracking-tight leading-none select-none">
                                    ??% OFF
                                </p>
                            )
                        ) : penLabel || usdLabel ? (
                            <div>
                                <p className="text-4xl font-extrabold text-white tracking-tight leading-none">
                                    {penLabel ?? usdLabel}
                                </p>
                                {penLabel && usdLabel && (
                                    <p className="text-xl font-bold text-white/80 tracking-tight mt-2">
                                        {usdLabel}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-4xl font-extrabold text-white/20 tracking-tight leading-none select-none">
                                S/0.00 OFF
                            </p>
                        )}

                        <p className={`text-sm mt-3 truncate ${state.name ? "text-white/70" : "text-white/25 italic"}`}>
                            {state.name || "Discount name…"}
                        </p>
                    </div>
                </div>

                {/* Card body */}
                <div className="bg-wg-surface dark:bg-wg-dark-surface px-5 py-4 min-h-[60px]">
                    {state.description ? (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted line-clamp-2 italic">
                            &ldquo;{state.description}&rdquo;
                        </p>
                    ) : (
                        <p className="text-xs text-wg-muted/30 dark:text-wg-dark-muted/30 italic">No customer description</p>
                    )}

                    {/* Coupon code display */}
                    {state.type === "COUPON" && (
                        <div className="mt-3">
                            <p className="text-[10px] uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mb-1.5">
                                Code to enter
                            </p>
                            <div className="flex items-center justify-between gap-2 border border-dashed border-wg-border dark:border-wg-dark-border rounded-brand px-3 py-2 bg-wg-bg dark:bg-wg-dark-bg">
                                <code className={`text-sm font-mono font-bold tracking-widest ${
                                    state.code
                                        ? "text-wg-text dark:text-wg-dark-text"
                                        : "text-wg-muted/40 dark:text-wg-dark-muted/40"
                                }`}>
                                    {state.code || "YOUR CODE"}
                                </code>
                                <KeyIcon className="w-3.5 h-3.5 shrink-0 text-wg-muted/40" strokeWidth={2} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Restrictions summary */}
            <div className="rounded-card border border-wg-border/40 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface overflow-hidden">
                <div className="px-4 py-2.5 border-b border-wg-border/20 dark:border-wg-dark-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                        Summary
                    </p>
                </div>
                <div className="divide-y divide-wg-border/20 dark:divide-wg-dark-border/50">
                    {restrictionRows.map((row) => (
                        <div key={row.label} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-wg-muted dark:text-wg-dark-muted shrink-0">
                                {row.icon}
                                <span className="text-xs">{row.label}</span>
                            </div>
                            <span className="text-xs font-medium text-wg-text dark:text-wg-dark-text text-right">
                                {row.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Main form component ──

export function DiscountForm({ initialData, categories = [] }: DiscountFormProps) {
    const router = useRouter()
    const isEditMode = !!initialData?.id
    const isDraftItem = !!initialData?.isDraft

    const [state, dispatch] = useReducer(formReducer, getInitialState(initialData))
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [excludeSearch, setExcludeSearch] = useState("")
    const [categorySearch, setCategorySearch] = useState("")

    // ── Dirty tracking ──
    const initialStateRef = useRef(getInitialState(initialData))
    const isDirty = useMemo(
        () => JSON.stringify(state) !== JSON.stringify(initialStateRef.current),
        [state]
    )

    // ── localStorage auto-save ──
    const localKey = `wg_draft_discount_${initialData?.id ?? "new"}`

    useEffect(() => {
        if (!isDirty) return
        const timeout = setTimeout(() => {
            try {
                const draft: DiscountDraftContent = {
                    formState: state,
                    savedAt: new Date().toISOString(),
                }
                localStorage.setItem(localKey, JSON.stringify(draft))
            } catch {}
        }, 600)
        return () => clearTimeout(timeout)
    }, [state, isDirty, localKey])

    // ── Local draft restore banner ──
    const [localDraft, setLocalDraft] = useState<DiscountDraftContent | null>(null)
    const [showLocalRestore, setShowLocalRestore] = useState(false)

    useEffect(() => {
        try {
            const stored = localStorage.getItem(localKey)
            if (stored) {
                const draft = JSON.parse(stored) as DiscountDraftContent
                setLocalDraft(draft)
                setShowLocalRestore(true)
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── DB draftData restore banner ──
    const hasDbDraft = !isDraftItem && !!initialData?.draftData
    const [showDbRestore, setShowDbRestore] = useState(hasDbDraft)

    const clearLocalDraft = useCallback(() => {
        try { localStorage.removeItem(localKey) } catch {}
    }, [localKey])

    const handleRestoreLocal = useCallback(() => {
        if (!localDraft) return
        dispatch({ type: "RESTORE_STATE", state: localDraft.formState })
        setShowLocalRestore(false)
    }, [localDraft])

    const handleDismissLocal = useCallback(() => {
        clearLocalDraft()
        setShowLocalRestore(false)
        setLocalDraft(null)
    }, [clearLocalDraft])

    const handleRestoreDb = useCallback(() => {
        if (!initialData?.draftData) return
        dispatch({ type: "RESTORE_STATE", state: initialData.draftData.formState })
        setShowDbRestore(false)
    }, [initialData?.draftData])

    // ── Draft guard ──
    const guard = useDraftGuard(isDirty)
    const [guardSavingDraft, setGuardSavingDraft] = useState(false)
    const [guardSaving, setGuardSaving] = useState(false)

    const allItems = useMemo(
        () => categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name, categoryId: c.id }))),
        [categories]
    )

    useEffect(() => {
        if (state.type !== "COUPON") {
            dispatch({ type: "SET_FIELD", field: "code", value: "" })
        }
    }, [state.type])

    const handleFieldChange = useCallback(
        (field: keyof FormState) =>
            (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                dispatch({ type: "SET_FIELD", field, value: e.target.value })
            },
        []
    )

    // ── Build publish payload ──
    const buildPayload = useCallback(() => {
        const categoryIds = state.targetType === "category" ? state.categoryIds : []
        return {
            name: state.name,
            description: state.description || undefined,
            type: state.type,
            valueType: state.valueType,
            value: parseFloat(state.value),
            valueUsd: state.valueType === "FIXED_AMOUNT"
                ? (parseFloat(state.valueUsd) || undefined)
                : null,
            code: state.type === "COUPON" ? state.code || undefined : undefined,
            applyToNone: state.targetType === "none",
            categoryId: categoryIds.length === 1 ? categoryIds[0] : null,
            categoryIds,
            menuItemId: state.targetType === "item" ? state.menuItemId || undefined : null,
            excludedItemIds: state.targetType === "allExcept" ? state.excludedItemIds : [],
            validFrom: state.validFrom ? new Date(state.validFrom).toISOString() : undefined,
            validUntil: state.validUntil ? new Date(state.validUntil).toISOString() : undefined,
            usageLimit: state.usageLimit ? parseInt(state.usageLimit) : undefined,
            perUserLimit: state.perUserLimit ? parseInt(state.perUserLimit) : undefined,
            active: state.active,
        }
    }, [state])

    const saveAndLeaveBlockedReason = useMemo(() => {
        if (state.targetType === "category" && state.categoryIds.length === 0) {
            return "Select at least one category."
        }
        if (state.targetType === "item" && !state.menuItemId) {
            return "Select a menu item."
        }
        return getDiscountPublishBlockedReason(buildPayload())
    }, [state.targetType, state.categoryIds.length, state.menuItemId, buildPayload])

    // ── Save as Draft ──
    const handleSaveDraft = useCallback(async () => {
        setIsSavingDraft(true)
        setError(null)
        const draftContent: DiscountDraftContent = {
            formState: state,
            savedAt: new Date().toISOString(),
        }
        try {
            if (isEditMode) {
                if (isDraftItem) {
                    const res = await fetch(`/api/discounts/${initialData!.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...buildPayload(), isDraft: true, draftData: draftContent }),
                    })
                    const json = await res.json()
                    if (!json.success) { setError(json.error || "Something went wrong"); return }
                } else {
                    const res = await fetch(`/api/discounts/${initialData!.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ saveDraftData: true, draftData: draftContent }),
                    })
                    const json = await res.json()
                    if (!json.success) { setError(json.error || "Something went wrong"); return }
                }
            } else {
                const res = await fetch("/api/discounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        isDraft: true,
                        name: state.name,
                        type: state.type,
                        valueType: state.valueType,
                        value: parseFloat(state.value) || 0,
                        valueUsd: state.valueType === "FIXED_AMOUNT"
                            ? (parseFloat(state.valueUsd) || null)
                            : null,
                        draftData: draftContent,
                    }),
                })
                const json = await res.json()
                if (!json.success) { setError(json.error || "Something went wrong"); return }
            }
            clearLocalDraft()
            guard.disableGuard()
            router.push("/discounts")
            router.refresh()
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setIsSavingDraft(false)
        }
    }, [state, isEditMode, isDraftItem, initialData, buildPayload, clearLocalDraft, guard, router])

    // ── Submit (publish) ──
    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            setError(null)

            if (state.targetType === "category" && state.categoryIds.length === 0) {
                setError("Select at least one category.")
                return
            }
            if (state.targetType === "item" && !state.menuItemId) {
                setError("Select a menu item.")
                return
            }

            setIsSubmitting(true)

            const payload = {
                ...buildPayload(),
                isDraft: false,
                clearDraft: true,
            }

            try {
                const url = isEditMode ? `/api/discounts/${initialData!.id}` : "/api/discounts"
                const method = isEditMode ? "PUT" : "POST"

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })

                const json = await res.json()
                if (!json.success) {
                    setError(json.error || "Something went wrong")
                    return
                }

                clearLocalDraft()
                guard.disableGuard()
                router.push("/discounts")
                router.refresh()
            } catch {
                setError("Network error. Please try again.")
            } finally {
                setIsSubmitting(false)
            }
        },
        [buildPayload, isEditMode, initialData, clearLocalDraft, guard, router, state.targetType, state.categoryIds, state.menuItemId]
    )

    // ── Guard modal handlers ──
    const handleGuardSaveDraft = useCallback(async () => {
        setGuardSavingDraft(true)
        const draftContent: DiscountDraftContent = { formState: state, savedAt: new Date().toISOString() }
        try {
            if (isEditMode) {
                if (isDraftItem) {
                    await fetch(`/api/discounts/${initialData!.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...buildPayload(), isDraft: true, draftData: draftContent }),
                    })
                } else {
                    await fetch(`/api/discounts/${initialData!.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ saveDraftData: true, draftData: draftContent }),
                    })
                }
            } else {
                await fetch("/api/discounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        isDraft: true,
                        name: state.name,
                        type: state.type,
                        valueType: state.valueType,
                        value: parseFloat(state.value) || 0,
                        valueUsd: state.valueType === "FIXED_AMOUNT"
                            ? (parseFloat(state.valueUsd) || null)
                            : null,
                        draftData: draftContent,
                    }),
                })
            }
            clearLocalDraft()
            guard.disableGuard()
            router.push("/discounts")
            router.refresh()
        } catch {
            setGuardSavingDraft(false)
        }
    }, [state, isEditMode, isDraftItem, initialData, buildPayload, clearLocalDraft, guard, router])

    const handleGuardSave = useCallback(async () => {
        setGuardSaving(true)
        const payload = { ...buildPayload(), isDraft: false, clearDraft: true }
        try {
            const url = isEditMode ? `/api/discounts/${initialData!.id}` : "/api/discounts"
            const res = await fetch(url, {
                method: isEditMode ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (json.success) {
                clearLocalDraft()
                guard.disableGuard()
                router.push("/discounts")
                router.refresh()
            } else {
                setError(json.error || "Something went wrong")
                setGuardSaving(false)
                guard.closeModal()
            }
        } catch {
            setGuardSaving(false)
            guard.closeModal()
        }
    }, [buildPayload, isEditMode, initialData, clearLocalDraft, guard, router])

    const handleGuardDiscard = useCallback(() => {
        clearLocalDraft()
        guard.discardAndNavigate()
    }, [clearLocalDraft, guard])

    const handleCancel = useCallback(() => {
        clearLocalDraft()
        guard.disableGuard()
        router.back()
    }, [clearLocalDraft, guard, router])

    function formatDraftAge(iso: string) {
        const diff = Date.now() - new Date(iso).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return "just now"
        if (mins < 60) return `${mins} min ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return new Date(iso).toLocaleDateString()
    }

    return (
        <form onSubmit={handleSubmit}>

            {/* ── Draft item banner ── */}
            {isDraftItem && (
                <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-brand bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                    <DocumentTextIcon className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                        <span className="font-semibold">Draft discount</span> — not visible to customers. Publish it when it&apos;s ready.
                    </p>
                </div>
            )}

            {/* ── DB draft restore banner (published discount with pending changes) ── */}
            {showDbRestore && initialData?.draftData && (
                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-brand bg-wg-primary/5 dark:bg-wg-dark-primary/8 border border-wg-primary/20 dark:border-wg-dark-primary/20">
                    <ClockRightAngleIcon className="w-4 h-4 shrink-0 text-wg-primary dark:text-wg-dark-primary mt-0.5" strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-wg-primary dark:text-wg-dark-primary">
                            You have saved draft changes
                            {initialData.draftData.savedAt && (
                                <span className="font-normal text-wg-muted dark:text-wg-dark-muted"> · {formatDraftAge(initialData.draftData.savedAt)}</span>
                            )}
                        </p>
                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                            Restore your draft edits or continue with the current published version.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleRestoreDb}
                            className="text-xs font-semibold px-3 py-1.5 rounded-brand bg-wg-primary text-white hover:bg-wg-primary/90 transition-colors"
                        >
                            Restore
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDbRestore(false)}
                            className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* ── Local draft restore banner ── */}
            {showLocalRestore && localDraft && !showDbRestore && (
                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-brand bg-wg-primary/5 dark:bg-wg-dark-primary/8 border border-wg-primary/20 dark:border-wg-dark-primary/20">
                    <ClockRightAngleIcon className="w-4 h-4 shrink-0 text-wg-primary dark:text-wg-dark-primary mt-0.5" strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-wg-primary dark:text-wg-dark-primary">
                            Unsaved local changes found
                            {localDraft.savedAt && (
                                <span className="font-normal text-wg-muted dark:text-wg-dark-muted"> · {formatDraftAge(localDraft.savedAt)}</span>
                            )}
                        </p>
                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                            Restore your unsaved edits from your last session.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleRestoreLocal}
                            className="text-xs font-semibold px-3 py-1.5 rounded-brand bg-wg-primary text-white hover:bg-wg-primary/90 transition-colors"
                        >
                            Restore
                        </button>
                        <button
                            type="button"
                            onClick={handleDismissLocal}
                            className="text-xs text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="grid lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_400px] gap-8 items-start">

                {/* ── Left: Form fields ── */}
                <div className="min-w-0 space-y-7">

                    {error && (
                        <div className="px-4 py-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {/* ── Basic Info ── */}
                    <div className="space-y-4">
                        <SectionHeading>Basic Info</SectionHeading>

                        <div>
                            <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                Internal Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text" value={state.name} onChange={handleFieldChange("name")}
                                required minLength={2} maxLength={100}
                                className={inputCls}
                                placeholder="e.g. Weekend Special 20%"
                            />
                            <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-1">
                                Admin-only name, not visible to customers
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                Customer Description
                            </label>
                            <Textarea
                                maxHeight={200}
                                value={state.description} onChange={(v) => dispatch({ type: "SET_FIELD", field: "description", value: v })}
                                maxLength={500} minRows={2}
                                className={inputCls}
                                placeholder="Visible to customers (optional)"
                            />
                        </div>
                    </div>

                    {/* ── Discount Configuration ── */}
                    <div className="space-y-4">
                        <SectionHeading>Discount Configuration</SectionHeading>

                        {/* Type + Value Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    Discount Type <span className="text-red-500">*</span>
                                </label>
                                <AdminSelect
                                    value={state.type}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "type", value: v })}
                                    required
                                    placeholder="Select type…"
                                    options={[
                                        { value: "COUPON", label: "Coupon Code", hint: "Requires a code at checkout" },
                                        { value: "AUTOMATIC", label: "Automatic", hint: "Applied automatically" },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    Value Type <span className="text-red-500">*</span>
                                </label>
                                <AdminSelect
                                    value={state.valueType}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "valueType", value: v })}
                                    required
                                    placeholder="Select value type…"
                                    options={[
                                        { value: "PERCENTAGE", label: "Percentage (%)" },
                                        { value: "FIXED_AMOUNT", label: "Fixed Amount" },
                                    ]}
                                />
                            </div>
                        </div>

                        {state.valueType === "PERCENTAGE" ? (
                            state.type === "COUPON" ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                            Percentage <span className="text-red-500">*</span>
                                        </label>
                                        <AdminNumberInput
                                            value={state.value}
                                            onChange={(v) => dispatch({ type: "SET_FIELD", field: "value", value: v })}
                                            min={0.01}
                                            max={100}
                                            step={1}
                                            decimals={2}
                                            suffix="%"
                                            placeholder="20"
                                            required
                                            nullable={false}
                                        />
                                    </div>
                                    <CouponCodeField
                                        value={state.code}
                                        onChange={handleFieldChange("code")}
                                        inputCls={inputCls}
                                    />
                                </div>
                            ) : (
                                <div className="max-w-[calc(50%-8px)]">
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                        Percentage <span className="text-red-500">*</span>
                                    </label>
                                    <AdminNumberInput
                                        value={state.value}
                                        onChange={(v) => dispatch({ type: "SET_FIELD", field: "value", value: v })}
                                        min={0.01}
                                        max={100}
                                        step={1}
                                        decimals={2}
                                        suffix="%"
                                        placeholder="20"
                                        required
                                        nullable={false}
                                    />
                                </div>
                            )
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                        Amounts by Currency <span className="text-red-500">*</span>
                                    </label>
                                    <p className="mt-1.5 mb-3 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                        Same as menu prices: set the off amount in PEN and in USD independently. One is not converted from the other.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(["PEN", "USD"] as SupportedCurrency[]).map((code) => (
                                            <div key={code}>
                                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                                    {code} <span className="text-red-500">*</span>
                                                </label>
                                                <AdminNumberInput
                                                    value={code === "PEN" ? state.value : state.valueUsd}
                                                    onChange={(v) =>
                                                        dispatch({
                                                            type: "SET_FIELD",
                                                            field: code === "PEN" ? "value" : "valueUsd",
                                                            value: v,
                                                        })
                                                    }
                                                    min={0.01}
                                                    max={9999}
                                                    step={1}
                                                    decimals={2}
                                                    integerStepper
                                                    prefix={getCurrencySymbol(code)}
                                                    placeholder="0.00"
                                                    required
                                                    nullable={false}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {state.type === "COUPON" && (
                                    <CouponCodeField
                                        value={state.code}
                                        onChange={handleFieldChange("code")}
                                        inputCls={inputCls}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Applies To ── */}
                    {categories.length > 0 && (
                        <div className="space-y-4">
                            <SectionHeading>Applies To</SectionHeading>

                            {/* Target type selector */}
                            <div className="flex gap-2 flex-wrap">
                                {(["none", "all", "allExcept", "category", "item"] as const).map((t) => {
                                    const labels = {
                                        none: "None",
                                        all: "All items",
                                        allExcept: "All items, Except…",
                                        category: "Specific categories",
                                        item: "Specific item",
                                    }
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => {
                                                dispatch({ type: "SET_FIELD", field: "targetType", value: t })
                                                if (t === "none" || t === "all") {
                                                    dispatch({ type: "SET_FIELD", field: "menuItemId", value: "" })
                                                    dispatch({ type: "SET_EXCLUDED_ITEMS", ids: [] })
                                                    dispatch({ type: "SET_CATEGORIES", ids: [] })
                                                }
                                                if (t === "item") {
                                                    dispatch({ type: "SET_EXCLUDED_ITEMS", ids: [] })
                                                    dispatch({ type: "SET_CATEGORIES", ids: [] })
                                                }
                                                if (t === "category") {
                                                    dispatch({ type: "SET_FIELD", field: "menuItemId", value: "" })
                                                    dispatch({ type: "SET_EXCLUDED_ITEMS", ids: [] })
                                                }
                                                if (t === "allExcept") {
                                                    dispatch({ type: "SET_FIELD", field: "menuItemId", value: "" })
                                                    dispatch({ type: "SET_CATEGORIES", ids: [] })
                                                }
                                                if (t !== "allExcept") setExcludeSearch("")
                                                if (t !== "category") setCategorySearch("")
                                            }}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-brand border transition-colors ${
                                                state.targetType === t
                                                    ? t === "none"
                                                        ? "bg-gray-500 text-white border-gray-500 dark:bg-gray-600 dark:border-gray-600"
                                                        : "bg-wg-primary text-white border-wg-primary dark:bg-wg-dark-primary dark:border-wg-dark-primary"
                                                    : "border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary dark:hover:border-wg-dark-primary"
                                            }`}
                                        >
                                            {labels[t]}
                                        </button>
                                    )
                                })}
                            </div>

                            {state.targetType === "none" && (
                                <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    This discount is saved but won&apos;t be applied to any product until you change this setting.
                                </p>
                            )}

                            {/* All items, Except — item exclusion selector */}
                            {state.targetType === "allExcept" && (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                        Applies to all menu items <strong>except</strong> the ones selected below.
                                        {state.excludedItemIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => dispatch({ type: "SET_EXCLUDED_ITEMS", ids: [] })}
                                                className="ml-2 text-wg-accent dark:text-wg-dark-accent hover:underline"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </p>
                                    <input
                                        type="text"
                                        placeholder="Search items…"
                                        value={excludeSearch}
                                        onChange={(e) => setExcludeSearch(e.target.value)}
                                        className={inputCls}
                                    />
                                    <div className="max-h-52 overflow-y-auto rounded-brand border border-wg-border/40 dark:border-wg-dark-border divide-y divide-wg-border/20 dark:divide-wg-dark-border/40">
                                        {allItems.length === 0 && (
                                            <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted py-3">No items available</p>
                                        )}
                                        {allItems
                                            .filter((item) =>
                                                item.name.toLowerCase().includes(excludeSearch.toLowerCase()) ||
                                                item.categoryName.toLowerCase().includes(excludeSearch.toLowerCase())
                                            )
                                            .map((item) => {
                                                const checked = state.excludedItemIds.includes(item.id)
                                                return (
                                                    <label
                                                        key={item.id}
                                                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors select-none ${
                                                            checked
                                                                ? "bg-red-50 dark:bg-red-900/15"
                                                                : "hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => dispatch({ type: "TOGGLE_EXCLUDED_ITEM", itemId: item.id })}
                                                            className="wg-check wg-control-danger w-3.5 h-3.5"
                                                        />
                                                        <span className="flex-1 text-xs text-wg-text dark:text-wg-dark-text">{item.name}</span>
                                                        <span className="text-[10px] text-wg-muted dark:text-wg-dark-muted">{item.categoryName}</span>
                                                    </label>
                                                )
                                            })
                                        }
                                    </div>
                                    {state.excludedItemIds.length > 0 && (
                                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                            {state.excludedItemIds.length} item{state.excludedItemIds.length !== 1 ? "s" : ""} excluded
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Specific categories — category selector */}
                            {state.targetType === "category" && (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                        Applies only to items in the selected categories.
                                        {state.categoryIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => dispatch({ type: "SET_CATEGORIES", ids: [] })}
                                                className="ml-2 text-wg-accent dark:text-wg-dark-accent hover:underline"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </p>
                                    <input
                                        type="text"
                                        placeholder="Search categories…"
                                        value={categorySearch}
                                        onChange={(e) => setCategorySearch(e.target.value)}
                                        className={inputCls}
                                    />
                                    <div className="max-h-52 overflow-y-auto rounded-brand border border-wg-border/40 dark:border-wg-dark-border divide-y divide-wg-border/20 dark:divide-wg-dark-border/40">
                                        {categories.length === 0 && (
                                            <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted py-3">No categories available</p>
                                        )}
                                        {categories
                                            .filter((cat) =>
                                                cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                                            )
                                            .map((cat) => {
                                                const checked = state.categoryIds.includes(cat.id)
                                                return (
                                                    <label
                                                        key={cat.id}
                                                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors select-none ${
                                                            checked
                                                                ? "bg-wg-primary/8 dark:bg-wg-dark-primary/15"
                                                                : "hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => dispatch({ type: "TOGGLE_CATEGORY", categoryId: cat.id })}
                                                            className="wg-check w-3.5 h-3.5"
                                                        />
                                                        <span className="flex-1 text-xs text-wg-text dark:text-wg-dark-text">{cat.name}</span>
                                                        <span className="text-[10px] text-wg-muted dark:text-wg-dark-muted">
                                                            {cat.items.length} item{cat.items.length !== 1 ? "s" : ""}
                                                        </span>
                                                    </label>
                                                )
                                            })
                                        }
                                    </div>
                                    {state.categoryIds.length > 0 && (
                                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                            {state.categoryIds.length} categor{state.categoryIds.length !== 1 ? "ies" : "y"} selected
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Item selector */}
                            {state.targetType === "item" && (
                                <div>
                                    <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                        Menu Item <span className="text-red-500">*</span>
                                    </label>
                                    <AdminSelect
                                        value={state.menuItemId}
                                        onChange={(v) => {
                                            dispatch({ type: "SET_FIELD", field: "menuItemId", value: v })
                                        }}
                                        placeholder="Select an item…"
                                        required
                                        options={categories.flatMap((c) =>
                                            c.items.map((i) => ({
                                                value: i.id,
                                                label: i.name,
                                                hint: c.name,
                                            }))
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Validity Period ── */}
                    <div className="space-y-4">
                        <SectionHeading>Validity Period</SectionHeading>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    Valid From
                                </label>
                                <AdminDatePicker
                                    value={state.validFrom}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "validFrom", value: v })}
                                    mode="datetime"
                                    placeholder="No start date"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    Valid Until
                                </label>
                                <AdminDatePicker
                                    value={state.validUntil}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "validUntil", value: v })}
                                    mode="datetime"
                                    placeholder="No end date"
                                    alignRight
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                            Leave both blank to make this discount available indefinitely.
                        </p>
                    </div>

                    {/* ── Restrictions ── */}
                    <div className="space-y-4">
                        <SectionHeading>Restrictions</SectionHeading>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    Usage Limit
                                </label>
                                <AdminNumberInput
                                    value={state.usageLimit}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "usageLimit", value: v })}
                                    min={1}
                                    placeholder="Unlimited"
                                />
                                <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-1">Total redemptions</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wg-text dark:text-wg-dark-text mb-1.5">
                                    Per User
                                </label>
                                <AdminNumberInput
                                    value={state.perUserLimit}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "perUserLimit", value: v })}
                                    min={1}
                                    placeholder="Unlimited"
                                />
                                <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-1">Per customer</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Status + Submit ── */}
                    <div className="pt-2 space-y-5">
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={state.active}
                                onChange={(next) => dispatch({ type: "SET_FIELD", field: "active", value: next })}
                                label={state.active ? "Deactivate discount" : "Activate discount"}
                            />
                            <span className="text-sm text-wg-text dark:text-wg-dark-text">
                                {state.active ? "Active" : "Inactive"}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 pt-2 border-t border-wg-border/30 dark:border-wg-dark-border flex-wrap">
                            {/* Publish / Save */}
                            <button
                                type="submit"
                                disabled={isSubmitting || isSavingDraft}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Spinner className="w-4 h-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <CheckCompactIcon className="w-4 h-4" strokeWidth={2} />
                                        {isDraftItem ? "Publish Discount" : isEditMode ? "Update Discount" : "Create Discount"}
                                    </>
                                )}
                            </button>

                            {/* Save as Draft */}
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={isSubmitting || isSavingDraft}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-text dark:text-wg-dark-text hover:bg-wg-surface dark:hover:bg-wg-dark-surface hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingDraft ? (
                                    <>
                                        <Spinner className="w-4 h-4 animate-spin" />
                                        Saving draft…
                                    </>
                                ) : (
                                    <>
                                        <DocumentTextIcon className="w-4 h-4" strokeWidth={2} />
                                        Save as Draft
                                    </>
                                )}
                            </button>

                            {/* Cancel */}
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={isSubmitting || isSavingDraft}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" strokeWidth={2} />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Right: Live preview panel (lg+) ── */}
                <div className="hidden lg:block">
                    <DiscountPreview state={state} categories={categories} />
                </div>

            </div>

            {/* Draft guard modal */}
            <DraftGuardModal
                isOpen={guard.modalOpen}
                onSaveDraft={handleGuardSaveDraft}
                onSave={handleGuardSave}
                onDiscard={handleGuardDiscard}
                onStay={guard.closeModal}
                isSavingDraft={guardSavingDraft}
                isSaving={guardSaving}
                saveAndLeaveBlockedReason={saveAndLeaveBlockedReason}
            />
        </form>
    )
}
