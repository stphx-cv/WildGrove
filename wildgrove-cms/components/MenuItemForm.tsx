"use client"

// ══════════════════════════════════════════════════════════════════
// MenuItemForm — Redesigned form for creating/editing menu items
// Two-column layout on large screens, with discount integration
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useReducer, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ImageUploader } from "@/components/ImageUploader"
import { AdminSelect, type SelectOption } from "@/components/AdminSelect"
import { AdminNumberInput } from "@/components/AdminNumberInput"
import { getCurrencySymbol, type SupportedCurrency } from "@wildgrove/core/currency"
import { ColorPicker } from "@/components/ColorPicker"
import { DraftGuardModal } from "@/components/DraftGuardModal"
import { PromoteDraftDialog } from "@/components/PromoteDraftDialog"
import { DuplicateDraftDialog, type DuplicateMode } from "@/components/DuplicateDraftDialog"
import { useDraftGuard } from "@/hooks/useDraftGuard"
import { getMenuItemPublishBlockedReason } from "@wildgrove/core/admin-validation"
import { getCategoryIconByKey } from "@/lib/category-icons"
import { Textarea } from "@wildgrove/ui/Textarea"
import { slugify } from "@wildgrove/core/slug"
import {
    ArrowsPointingOutIcon,
    CheckCompactIcon,
    ChevronUpDownIcon,
    ClockRightAngleIcon,
    CloseCircleSolidIcon,
    CloseIcon,
    CloseSolidIcon,
    DocumentDuplicateIcon,
    DocumentTextIcon,
    GripDotsIcon,
    LinkIcon,
    PencilIcon,
    PencilShortSeamIcon,
    PlusIcon,
    PlusWideIcon,
    Spinner,
    StarOutlineIcon,
} from "@wildgrove/ui/icons"

// ── Types ──

/**
 * Whether the file behind an image address is gone. A browser draft can outlive
 * the files it lists, because an upload that no dish uses can be deleted by the
 * storage cleanup. Only a 404 counts: a network error keeps the image.
 */
async function isImageGone(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, { method: "HEAD", credentials: "omit", cache: "no-store" })
        return res.status === 404
    } catch {
        return false
    }
}

// Shape used only for the localStorage auto-save (not persisted to the DB).
interface MenuDraftContent {
    formState: FormState
    galleryImages: (string | null)[]
    savedAt: string
}

interface MenuItemData {
    id?: string
    sku?: string | null
    slug?: string
    slugEs?: string | null
    name: string
    nameEs?: string | null
    description: string
    descriptionEs?: string | null
    prices?: Partial<Record<SupportedCurrency, number>> | null
    price?: number
    priceEs?: number | null
    currency?: string
    currencyEs?: string | null
    categoryId: string | null
    imageUrl: string | null
    images?: string[]
    tags: string[]
    tagsEs?: string[]
    tagColors?: Record<string, string>
    ingredients?: string[]
    ingredientsEs?: string[]
    available: boolean
    featured: boolean
    featuredOrder: number
    order: number
    isDraft?: boolean
    parentId?: string | null
}

interface DraftSibling {
    id: string
    name: string
    updatedAt: string
}

interface ParentInfo {
    id: string
    slug: string
    slugEs: string | null
    name: string
    sku: string | null
}

type CurrencyPriceMap = Record<SupportedCurrency, string>

interface Category {
    id: string
    name: string
    nameEs?: string | null
    slug: string
    icon: string
}

export interface LinkedDiscount {
    id: string
    name: string
    type: "COUPON" | "AUTOMATIC"
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    valueUsd?: number | null
    code: string | null
    active: boolean
    /** How this discount reaches the item */
    scope: "direct" | "category" | "global"
    /** Item IDs excluded from this discount (needed for smart detach) */
    excludedItemIds: string[]
}

// Raw discount returned by the /api/discounts list endpoint
interface AvailableDiscount {
    id: string
    name: string
    type: "COUPON" | "AUTOMATIC"
    valueType: "PERCENTAGE" | "FIXED_AMOUNT"
    value: number
    valueUsd?: number | null
    code: string | null
    active: boolean
}

interface MenuItemFormProps {
    /** If provided, the form is in edit mode */
    initialData?: MenuItemData
    /** All discounts currently affecting this menu item (edit mode only) */
    linkedDiscounts?: LinkedDiscount[]
    /** Set when editing a child draft — provides the parent's slug/name to display. */
    parent?: ParentInfo
    /** Set when editing a published parent — lists its existing draft siblings. */
    drafts?: DraftSibling[]
    /**
     * The published categories for the dropdown. The server page reads them and
     * passes them in; the form used to fetch `/api/categories` on mount, which
     * left the dropdown empty for a round trip after the page had arrived.
     */
    categories?: Category[]
    /** `AppSettings.productImageLimit`, read by the server page for the same reason. */
    imageLimit?: number
}

// ── Form state ──

type FormState = {
    // EN fields (canonical DB fields)
    nameEn: string
    slugEn: string
    descriptionEn: string
    prices: CurrencyPriceMap
    tagsEn: string[]
    // ES fields (translation)
    nameEs: string
    slugEs: string
    descriptionEs: string
    tagsEs: string[]
    tagColors: Record<string, string>
    // Shared fields
    categoryId: string
    imageUrl: string | null
    available: boolean
    featured: boolean
    featuredOrder: string
    order: string
    tagInput: string
    sku: string
    // Ingredients — per language
    ingredientsEn:   string[]
    ingredientsEs:   string[]
    ingredientInput: string
}

type FormAction =
    | { type: "SET_FIELD"; field: keyof FormState; value: FormState[keyof FormState] }
    | { type: "ADD_TAG"; tag: string; lang: "en" | "es" }
    | { type: "REMOVE_TAG"; tag: string; lang: "en" | "es" }
    | { type: "SET_TAG_COLOR"; tag: string; color: string }
    | { type: "SET_IMAGE"; url: string | null }
    | { type: "RESTORE_STATE"; state: FormState }
    | { type: "ADD_INGREDIENT"; ingredient: string; lang: "en" | "es" }
    | { type: "REMOVE_INGREDIENT"; index: number; lang: "en" | "es" }

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case "SET_FIELD":
            return { ...state, [action.field]: action.value }
        case "ADD_TAG": {
            const field = action.lang === "en" ? "tagsEn" : "tagsEs"
            const normalizedTag = action.tag.toLowerCase().trim()
            if (!normalizedTag || state[field].includes(normalizedTag)) return state
            return { ...state, [field]: [...state[field], normalizedTag], tagInput: "" }
        }
        case "REMOVE_TAG": {
            const field = action.lang === "en" ? "tagsEn" : "tagsEs"
            const newColors = { ...state.tagColors }
            delete newColors[action.tag]
            return { ...state, [field]: state[field].filter((t) => t !== action.tag), tagColors: newColors }
        }
        case "SET_TAG_COLOR": {
            const updated = { ...state.tagColors }
            if (action.color) {
                updated[action.tag] = action.color
            } else {
                delete updated[action.tag]
            }
            return { ...state, tagColors: updated }
        }
        case "SET_IMAGE":
            return { ...state, imageUrl: action.url }
        case "RESTORE_STATE":
            return action.state
        case "ADD_INGREDIENT": {
            const field = action.lang === "en" ? "ingredientsEn" : "ingredientsEs"
            const trimmed = action.ingredient.trim()
            if (!trimmed) return state
            return { ...state, [field]: [...state[field], trimmed], ingredientInput: "" }
        }
        case "REMOVE_INGREDIENT": {
            const field = action.lang === "en" ? "ingredientsEn" : "ingredientsEs"
            return { ...state, [field]: state[field].filter((_, i) => i !== action.index) }
        }
        default:
            return state
    }
}

function getInitialState(data?: MenuItemData): FormState {
    const fallbackPrices: CurrencyPriceMap = { PEN: "", USD: "" }
    const prices: CurrencyPriceMap = { ...fallbackPrices }
    if (data?.prices) {
        if (typeof data.prices.PEN === "number") prices.PEN = String(data.prices.PEN)
        if (typeof data.prices.USD === "number") prices.USD = String(data.prices.USD)
    } else if (data?.price != null) {
        const primaryCurrency = (data.currency as SupportedCurrency) ?? "USD"
        if (primaryCurrency === "PEN" || primaryCurrency === "USD") {
            prices[primaryCurrency] = String(data.price)
        }
    }
    if (data?.priceEs != null) {
        const secondaryCurrency = (data.currencyEs as SupportedCurrency) ?? "PEN"
        if (secondaryCurrency === "PEN" || secondaryCurrency === "USD") {
            prices[secondaryCurrency] = String(data.priceEs)
        }
    }

    return {
        // EN (canonical DB fields)
        nameEn:        data?.name ?? "",
        slugEn:        data?.slug ?? "",
        descriptionEn: data?.description ?? "",
        prices,
        tagsEn:        data?.tags ?? [],
        // ES (translations)
        nameEs:        data?.nameEs ?? "",
        slugEs:        data?.slugEs ?? "",
        descriptionEs: data?.descriptionEs ?? "",
        tagsEs:        data?.tagsEs ?? [],
        tagColors:     data?.tagColors ?? {},
        // Shared
        categoryId:    data?.categoryId ?? "",
        imageUrl:      data?.imageUrl ?? null,
        available:     data?.available ?? true,
        featured:      data?.featured ?? false,
        featuredOrder: data?.featuredOrder !== undefined ? String(data.featuredOrder) : "0",
        order:         data?.order !== undefined ? String(data.order) : "0",
        tagInput:      "",
        sku:           data?.sku ?? "",
        // Ingredients
        ingredientsEn:   data?.ingredients   ?? [],
        ingredientsEs:   data?.ingredientsEs ?? [],
        ingredientInput: "",
    }
}

// getCategoryIcon removed — icons now stored in DB via lib/category-icons

// ── Constants ──

const TAG_PRESETS = {
    en: ["vegan", "vegetarian", "gluten-free", "organic", "spicy", "seasonal", "chef-special", "dairy-free", "nut-free", "low-carb", "high-protein", "popular", "new", "kids-menu", "house-special"],
    es: ["vegano", "vegetariano", "sin-gluten", "orgánico", "picante", "de-temporada", "especial-del-chef", "sin-lactosa", "sin-nueces", "bajo-carb", "alto-proteína", "popular", "nuevo", "menú-niños", "especialidad-casa"],
}

const TAG_COLOR_PRESETS = [
    "#10b981", // emerald — vegan
    "#22c55e", // green — vegetarian
    "#f59e0b", // amber — gluten-free
    "#84cc16", // lime — organic
    "#ef4444", // red — spicy
    "#f97316", // orange — seasonal
    "#8b5cf6", // violet — chef-special
    "#0ea5e9", // sky — dairy-free
    "#eab308", // yellow — nut-free
    "#14b8a6", // teal — low-carb
    "#3b82f6", // blue — high-protein
    "#ec4899", // pink — popular
    "#06b6d4", // cyan — new
    "#a855f7", // purple — kids
    "#f43f5e", // rose — house-special
]

const PALETTE_STORAGE_KEY = "wg-tag-color-palette"

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
    COUPON: "Coupon",
    AUTOMATIC: "Auto",
}

const DISCOUNT_TYPE_COLORS: Record<string, string> = {
    COUPON: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    AUTOMATIC: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
}

function formatDiscountValue(d: Pick<LinkedDiscount, "valueType" | "value" | "valueUsd">): string {
    if (d.valueType === "PERCENTAGE") return `${d.value}% off`
    const usd = d.valueUsd ?? d.value
    return `${getCurrencySymbol("PEN")}${Number(d.value).toFixed(2)} / ${getCurrencySymbol("USD")}${Number(usd).toFixed(2)} off`
}

// ── Shared input style ──

const inputCls =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border " +
    "bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text " +
    "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 " +
    "focus:outline-none focus:ring-2 focus:ring-wg-accent/20 focus:border-wg-accent dark:focus:border-wg-dark-accent " +
    "transition-colors"

// ── Small reusable pieces ──

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-card border border-wg-border/40 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface">
            <div className="flex items-center justify-between px-5 py-3 border-b border-wg-border/30 dark:border-wg-dark-border/60 bg-wg-bg/50 dark:bg-wg-dark-bg/40">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-wg-muted dark:text-wg-dark-muted">
                    {title}
                </h2>
                {badge}
            </div>
            <div className="p-5">{children}</div>
        </div>
    )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{children}</label>
            {hint && <span className="text-[11px] text-wg-muted dark:text-wg-dark-muted tabular-nums">{hint}</span>}
        </div>
    )
}

// ── Main component ──

export function MenuItemForm({ initialData, linkedDiscounts = [], parent, drafts = [], categories = [], imageLimit = 4 }: MenuItemFormProps) {
    const router = useRouter()
    const isEditMode = !!initialData?.id
    const isDraftItem = !!initialData?.isDraft
    const isChildDraft = isDraftItem && !!initialData?.parentId
    const isOrphanDraft = isDraftItem && !initialData?.parentId
    const isPublishedParent = isEditMode && !isDraftItem
    // Slug field is locked on child drafts — it always mirrors the parent's slug.
    const parentSlug = parent?.slug ?? initialData?.slug ?? ""
    const parentSlugEs = parent?.slugEs ?? initialData?.slugEs ?? ""

    // A child draft shows its parent's slugs, and without a SKU of its own
    // uses its parent's. The form state and the dirty-check baseline both
    // start from this, so an untouched draft does not open as modified.
    const [formSource] = useState(() =>
        isChildDraft && parent
            ? { ...initialData!, slug: parent.slug, slugEs: parent.slugEs, sku: initialData?.sku || parent.sku }
            : initialData
    )
    const [state, dispatch] = useReducer(formReducer, formSource, getInitialState)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const [isPromoting, setIsPromoting] = useState(false)
    const [showPromoteDialog, setShowPromoteDialog] = useState(false)
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState(false)
    const [pendingDuplicateDraftId, setPendingDuplicateDraftId] = useState<string | null>(null)
    const [draftSiblings, setDraftSiblings] = useState<DraftSibling[]>(drafts)
    const [error, setError] = useState<string | null>(null)

    // Language toggle — EN is default
    const [lang, setLang] = useState<"en" | "es">("en")

    // Track whether slugs have been manually edited (irrelevant for child drafts —
    // their slug is locked to the parent's).
    // An independent draft starts with a placeholder address (`...-draft-<timestamp>`), which
    // is not a choice: it follows the name until the person edits it.
    const [slugEnTouched, setSlugEnTouched] = useState(isEditMode && !/-draft-\d+/.test(initialData?.slug ?? ""))
    const [slugEsTouched, setSlugEsTouched] = useState(!!(isEditMode && initialData?.slugEs))

    // Gallery images — initial from DB images
    const initialGallery = initialData?.images ?? []
    const [galleryImages, setGalleryImagesRaw] = useState<(string | null)[]>(initialGallery)
    const [dragIndex, setDragIndex] = useState<number | null>(null)

    // ── Dirty tracking ──
    const initialStateRef = useRef(getInitialState(formSource))
    const initialGalleryRef = useRef(initialGallery)
    const isDirty = useMemo(
        () =>
            JSON.stringify(state) !== JSON.stringify(initialStateRef.current) ||
            JSON.stringify(galleryImages) !== JSON.stringify(initialGalleryRef.current),
        [state, galleryImages]
    )

    // ── localStorage auto-save ──
    const localKey = `wg_draft_menu_${initialData?.id ?? "new"}`

    useEffect(() => {
        if (!isDirty) return
        const timeout = setTimeout(() => {
            try {
                const draft: MenuDraftContent = {
                    formState: state,
                    galleryImages,
                    savedAt: new Date().toISOString(),
                }
                localStorage.setItem(localKey, JSON.stringify(draft))
            } catch {}
        }, 600)
        return () => clearTimeout(timeout)
    }, [state, galleryImages, isDirty, localKey])

    // ── Local draft restore banner ──
    const [localDraft, setLocalDraft] = useState<MenuDraftContent | null>(null)
    const [showLocalRestore, setShowLocalRestore] = useState(false)
    const [restoringLocal, setRestoringLocal] = useState(false)
    // How many images of the restored draft no longer exist and were left out.
    const [missingDraftImages, setMissingDraftImages] = useState(0)

    useEffect(() => {
        try {
            const stored = localStorage.getItem(localKey)
            if (stored) {
                const draft = JSON.parse(stored) as MenuDraftContent
                setLocalDraft(draft)
                setShowLocalRestore(true)
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const clearLocalDraft = useCallback(() => {
        try { localStorage.removeItem(localKey) } catch {}
    }, [localKey])

    const handleRestoreLocal = useCallback(async () => {
        if (!localDraft) return
        setRestoringLocal(true)
        const { formState, galleryImages: draftGallery } = localDraft
        const urls = [formState.imageUrl, ...(draftGallery ?? [])].filter((u): u is string => !!u)
        const checked = await Promise.all(urls.map(async (url) => ((await isImageGone(url)) ? url : null)))
        const gone = new Set(checked.filter((u): u is string => !!u))

        dispatch({
            type: "RESTORE_STATE",
            state: formState.imageUrl && gone.has(formState.imageUrl) ? { ...formState, imageUrl: null } : formState,
        })
        if (draftGallery) setGalleryImagesRaw(draftGallery.filter((u) => !u || !gone.has(u)))
        setMissingDraftImages(gone.size)
        setRestoringLocal(false)
        setShowLocalRestore(false)
    }, [localDraft])

    const handleDismissLocal = useCallback(() => {
        clearLocalDraft()
        setShowLocalRestore(false)
        setLocalDraft(null)
    }, [clearLocalDraft])

    // ── Gallery setter (also marks dirty) ──
    const setGalleryImages = useCallback((images: (string | null)[]) => {
        setGalleryImagesRaw(images)
    }, [])

    // ── Draft guard hook ──
    const guard = useDraftGuard(isDirty)

    // ── Guard modal: save as draft then navigate ──
    const [guardSavingDraft, setGuardSavingDraft] = useState(false)
    const [guardSaving, setGuardSaving] = useState(false)

    // ── Discount management ──
    const [discounts, setDiscounts] = useState<LinkedDiscount[]>(linkedDiscounts)
    const [showLinkPanel, setShowLinkPanel] = useState(false)
    const [linkSearch, setLinkSearch] = useState("")
    const [availableDiscounts, setAvailableDiscounts] = useState<AvailableDiscount[]>([])
    const [loadingDiscounts, setLoadingDiscounts] = useState(false)
    const [discountOp, setDiscountOp] = useState<Record<string, boolean>>({})

    // ── Color palette (shared across tags, persisted in localStorage) ──
    const [palette, setPalette] = useState<string[]>(TAG_COLOR_PRESETS)
    const [pickerState, setPickerState] = useState<{
        tag: string
        mode: "add" | "edit"
        editingColor?: string
    } | null>(null)

    useEffect(() => {
        try {
            const stored = localStorage.getItem(PALETTE_STORAGE_KEY)
            if (stored) setPalette(JSON.parse(stored))
        } catch {}
    }, [])

    useEffect(() => {
        try { localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette)) } catch {}
    }, [palette])

    const addToPalette = useCallback((hex: string) => {
        setPalette(prev => prev.includes(hex) ? prev : [...prev, hex])
    }, [])

    const removeFromPalette = useCallback((hex: string) => {
        setPalette(prev => prev.filter(c => c !== hex))
    }, [])

    const updateInPalette = useCallback((oldHex: string, newHex: string) => {
        setPalette(prev => {
            if (prev.includes(newHex)) return prev.filter(c => c !== oldHex)
            return prev.map(c => c === oldHex ? newHex : c)
        })
    }, [])

    const handlePickerConfirm = useCallback((hex: string) => {
        if (!pickerState) return
        const { tag, mode, editingColor } = pickerState
        if (mode === "add") {
            addToPalette(hex)
            dispatch({ type: "SET_TAG_COLOR", tag, color: hex })
        } else if (mode === "edit" && editingColor) {
            updateInPalette(editingColor, hex)
            if (state.tagColors[tag] === editingColor) {
                dispatch({ type: "SET_TAG_COLOR", tag, color: hex })
            }
        }
        setPickerState(null)
    }, [pickerState, addToPalette, updateInPalette, state.tagColors])

    // Build select options with icons from DB
    const categoryOptions: SelectOption[] = categories.map((cat) => ({
        value: cat.id,
        label: cat.name,
        icon: getCategoryIconByKey(cat.icon ?? "default"),
    }))

    // Auto-generate EN slug from EN name until manually edited
    useEffect(() => {
        if (!slugEnTouched) {
            dispatch({ type: "SET_FIELD", field: "slugEn", value: slugify(state.nameEn) })
        }
    }, [state.nameEn, slugEnTouched])

    // Auto-generate ES slug from ES name until manually edited
    useEffect(() => {
        if (!slugEsTouched && state.nameEs) {
            dispatch({ type: "SET_FIELD", field: "slugEs", value: slugify(state.nameEs) })
        }
    }, [state.nameEs, slugEsTouched])

    const handleFieldChange = useCallback(
        (field: keyof FormState) =>
            (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                dispatch({ type: "SET_FIELD", field, value: e.target.value })
            },
        []
    )

    const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, currentLang: "en" | "es") => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            dispatch({ type: "ADD_TAG", tag: (e.target as HTMLInputElement).value, lang: currentLang })
        }
    }, [])

    // ── Discount management handlers ──

    const loadAvailableDiscounts = useCallback(async () => {
        setLoadingDiscounts(true)
        try {
            const res = await fetch("/api/discounts?limit=100")
            const json = await res.json()
            if (json.success) setAvailableDiscounts(json.data.items)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingDiscounts(false)
        }
    }, [])

    const handleDetach = useCallback(async (discount: LinkedDiscount) => {
        if (!initialData?.id) return
        setDiscountOp((prev) => ({ ...prev, [discount.id]: true }))

        // Smart detach logic:
        // - direct: set to None (applyToNone: true, clear menuItemId)
        // - global/category: add this item to excludedItemIds
        const payload = discount.scope === "direct"
            ? { menuItemId: null, applyToNone: true }
            : { excludedItemIds: [...discount.excludedItemIds, initialData.id] }

        try {
            const res = await fetch(`/api/discounts/${discount.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (res.ok) {
                setDiscounts((prev) => prev.filter((d) => d.id !== discount.id))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setDiscountOp((prev) => { const n = { ...prev }; delete n[discount.id]; return n })
        }
    }, [initialData?.id])

    const handleToggleActive = useCallback(async (discount: LinkedDiscount) => {
        setDiscountOp((prev) => ({ ...prev, [discount.id]: true }))
        try {
            const res = await fetch(`/api/discounts/${discount.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !discount.active }),
            })
            if (res.ok) {
                setDiscounts((prev) =>
                    prev.map((d) => (d.id === discount.id ? { ...d, active: !d.active } : d))
                )
            }
        } catch (err) {
            console.error(err)
        } finally {
            setDiscountOp((prev) => { const n = { ...prev }; delete n[discount.id]; return n })
        }
    }, [])

    const handleLink = useCallback(
        async (discountId: string) => {
            if (!initialData?.id) return
            setDiscountOp((prev) => ({ ...prev, [discountId]: true }))
            try {
                const res = await fetch(`/api/discounts/${discountId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ menuItemId: initialData.id }),
                })
                if (res.ok) {
                    const picked = availableDiscounts.find((d) => d.id === discountId)
                    if (picked) {
                        setDiscounts((prev) => [...prev, { ...picked, scope: "direct" as const, excludedItemIds: [] }])
                    }
                    setShowLinkPanel(false)
                    setLinkSearch("")
                }
            } catch (err) {
                console.error(err)
            } finally {
                setDiscountOp((prev) => { const n = { ...prev }; delete n[discountId]; return n })
            }
        },
        [initialData?.id, availableDiscounts]
    )

    const handleCloseLinkPanel = useCallback(() => {
        setShowLinkPanel(false)
        setLinkSearch("")
    }, [])

    const handleOpenLinkPanel = useCallback(() => {
        setShowLinkPanel(true)
        loadAvailableDiscounts()
    }, [loadAvailableDiscounts])

    // ── Build the full publish payload ──
    const buildPayload = useCallback(() => ({
        name:          state.nameEn,
        slug:          state.slugEn.trim() || undefined,
        description:   state.descriptionEn,
        prices:        {
            PEN: parseFloat(state.prices.PEN),
            USD: parseFloat(state.prices.USD),
        },
        tags:          state.tagsEn,
        nameEs:        state.nameEs.trim() || undefined,
        slugEs:        state.slugEs.trim() || undefined,
        descriptionEs: state.descriptionEs.trim() || undefined,
        tagsEs:        state.tagsEs,
        tagColors:     state.tagColors,
        ingredients:   state.ingredientsEn,
        ingredientsEs: state.ingredientsEs,
        categoryId:    state.categoryId,
        imageUrl:      state.imageUrl ?? "",
        images:        galleryImages.filter((u): u is string => !!u),
        available:     state.available,
        featured:      state.featured,
        featuredOrder: parseInt(state.featuredOrder, 10),
        order:         parseInt(state.order, 10),
        sku:           state.sku.trim().toUpperCase(),
    }), [state, galleryImages])

    const saveAndLeaveBlockedReason = useMemo(
        () => getMenuItemPublishBlockedReason(isEditMode, buildPayload()),
        [isEditMode, buildPayload]
    )

    // ── Save as Draft ──
    // Three modes:
    //   - Editing a draft (child or orphan) → PUT same row with isDraft:true.
    //   - Editing a published parent → POST a new draft clone, then PUT the
    //     form into it, so the draft carries what was edited.
    //   - Creating a new item → POST an orphan draft with the whole form.
    // The button and the leave-page guard both go through here. The copy kept
    // in the browser is only cleared by them after a save that worked.
    const pendingChildDraftRef = useRef<{ id: string; name: string } | null>(null)
    const saveAsDraft = useCallback(async (): Promise<{ ok: true; next: string } | { ok: false; error: string }> => {
        if (isEditMode && isDraftItem) {
            const res = await fetch(`/api/menu/${initialData!.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...buildPayload(), isDraft: true }),
            })
            const json = await res.json()
            return json.success ? { ok: true, next: "/menu" } : { ok: false, error: json.error || "Something went wrong" }
        }

        if (isEditMode && isPublishedParent) {
            // A retry after a failed save reuses the draft the first attempt created.
            let draft = pendingChildDraftRef.current
            if (!draft) {
                const label = state.nameEn && state.nameEn !== initialData?.name
                    ? state.nameEn
                    : undefined
                const res = await fetch(`/api/menu/${initialData!.id}/drafts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(label ? { label } : {}),
                })
                const json = await res.json()
                if (!json.success || !json.data) return { ok: false, error: json.error || "Failed to create draft" }
                draft = { id: json.data.id, name: json.data.name }
                pendingChildDraftRef.current = draft
            }
            // The draft keeps the name it was created with ("… (draft)" unless renamed).
            const res = await fetch(`/api/menu/${draft.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...buildPayload(), name: draft.name, isDraft: true }),
            })
            const json = await res.json()
            if (!json.success) return { ok: false, error: json.error || "Something went wrong" }
            pendingChildDraftRef.current = null
            return { ok: true, next: `/menu/${draft.id}` }
        }

        const res = await fetch("/api/menu", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...buildPayload(), isDraft: true }),
        })
        const json = await res.json()
        return json.success ? { ok: true, next: "/menu" } : { ok: false, error: json.error || "Something went wrong" }
    }, [state.nameEn, isEditMode, isDraftItem, isPublishedParent, initialData, buildPayload])

    const handleSaveDraft = useCallback(async () => {
        setIsSavingDraft(true)
        setError(null)

        try {
            const result = await saveAsDraft()
            if (!result.ok) { setError(result.error); return }
            clearLocalDraft()
            guard.disableGuard()
            router.push(result.next)
            router.refresh()
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setIsSavingDraft(false)
        }
    }, [saveAsDraft, clearLocalDraft, guard, router])

    // ── Promote (apply child draft to parent) ──
    const handlePromote = useCallback(async () => {
        if (!isChildDraft || !initialData?.id) return
        setIsPromoting(true)
        setError(null)
        try {
            // Save any pending edits first so promote sees the latest state.
            const saveRes = await fetch(`/api/menu/${initialData.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...buildPayload(), isDraft: true }),
            })
            const saveJson = await saveRes.json()
            if (!saveJson.success) {
                setError(saveJson.error || "Failed to save pending edits")
                setIsPromoting(false)
                setShowPromoteDialog(false)
                return
            }
            const promoteRes = await fetch(`/api/menu/drafts/${initialData.id}/promote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })
            const promoteJson = await promoteRes.json()
            if (!promoteJson.success) {
                setError(promoteJson.error || "Failed to promote draft")
                setIsPromoting(false)
                setShowPromoteDialog(false)
                return
            }
            clearLocalDraft()
            guard.disableGuard()
            router.push(`/menu/${promoteJson.data.id}`)
            router.refresh()
        } catch {
            setError("Network error. Please try again.")
            setIsPromoting(false)
            setShowPromoteDialog(false)
        }
    }, [isChildDraft, initialData, buildPayload, clearLocalDraft, guard, router])

    // ── Duplicate (from the "Drafts of this product" panel inside the form) ──
    const handleDuplicate = useCallback(async (mode: DuplicateMode, draftId: string) => {
        setIsDuplicating(true)
        try {
            const res = await fetch(`/api/menu/drafts/${draftId}/duplicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            })
            const json = await res.json()
            if (json.success && initialData?.id && mode === "sibling") {
                const listRes = await fetch(`/api/menu?parent=${initialData.id}&limit=100`)
                const listJson = await listRes.json()
                if (listJson.success) setDraftSiblings(listJson.data.items)
            }
        } catch {
            setError("Failed to duplicate draft")
        } finally {
            setIsDuplicating(false)
            setShowDuplicateDialog(false)
        }
    }, [initialData?.id])

    // ── Submit (publish / promote) ──
    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            setError(null)

            // Child drafts have no "publish" — the primary action becomes
            // "apply draft to parent" (promote), gated by a confirm dialog.
            if (isChildDraft) {
                setShowPromoteDialog(true)
                return
            }

            setIsSubmitting(true)
            const payload = { ...buildPayload(), isDraft: false }

            try {
                const url = isEditMode ? `/api/menu/${initialData!.id}` : "/api/menu"
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
                router.push("/menu")
                router.refresh()
            } catch {
                setError("Network error. Please try again.")
            } finally {
                setIsSubmitting(false)
            }
        },
        [isChildDraft, buildPayload, isEditMode, initialData, clearLocalDraft, guard, router]
    )

    const activeTags = lang === "en" ? state.tagsEn : state.tagsEs
    const availableTagPresets = TAG_PRESETS[lang].filter((t) => !activeTags.includes(t))

    // ── Guard modal handlers ──
    const handleGuardSaveDraft = useCallback(async () => {
        setGuardSavingDraft(true)
        try {
            const result = await saveAsDraft()
            if (!result.ok) {
                setError(result.error)
                setGuardSavingDraft(false)
                guard.closeModal()
                return
            }
            clearLocalDraft()
            guard.disableGuard()
            router.push(result.next)
            router.refresh()
        } catch {
            setGuardSavingDraft(false)
        }
    }, [saveAsDraft, clearLocalDraft, guard, router])

    const handleGuardSave = useCallback(async () => {
        // Child drafts can't "save & leave" — they go through promote instead.
        if (isChildDraft) {
            guard.closeModal()
            setShowPromoteDialog(true)
            return
        }
        setGuardSaving(true)
        const payload = { ...buildPayload(), isDraft: false }
        try {
            const url = isEditMode ? `/api/menu/${initialData!.id}` : "/api/menu"
            const res = await fetch(url, {
                method: isEditMode ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (json.success) {
                clearLocalDraft()
                guard.disableGuard()
                router.push("/menu")
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
    }, [isChildDraft, buildPayload, isEditMode, initialData, clearLocalDraft, guard, router])

    const handleGuardDiscard = useCallback(() => {
        clearLocalDraft()
        guard.discardAndNavigate()
    }, [clearLocalDraft, guard])

    const handleCancel = useCallback(() => {
        clearLocalDraft()
        guard.disableGuard()
        router.back()
    }, [clearLocalDraft, guard, router])

    // ── Format relative time for draft banner ──
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
        <form
            onSubmit={handleSubmit}
            className={`space-y-0 ${isChildDraft ? "p-4 -m-4 mb-4 rounded-card bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30" : ""}`}
        >

            {/* ── Child draft banner: editing an alternate version of a parent ── */}
            {isChildDraft && parent && (
                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-brand bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700/40">
                    <DocumentTextIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            <span className="font-semibold">Editing draft of</span>{" "}
                            <span className="font-medium">&ldquo;{parent.name}&rdquo;</span>
                        </p>
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 font-mono">
                            /menu/{parent.slug}
                        </p>
                    </div>
                    <Link
                        href={`/menu/${parent.id}`}
                        className="text-xs font-semibold px-3 py-1.5 rounded-brand bg-amber-200 hover:bg-amber-300 dark:bg-amber-800/60 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 transition-colors shrink-0"
                    >
                        Open published version
                    </Link>
                </div>
            )}

            {/* ── Orphan draft banner ── */}
            {isOrphanDraft && (
                <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-brand bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                    <DocumentTextIcon className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                        <span className="font-semibold">Draft item</span> — not visible to customers. Publish it when it&apos;s ready.
                    </p>
                </div>
            )}

            {/* ── Local draft restore banner ── */}
            {showLocalRestore && localDraft && (
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
                            disabled={restoringLocal}
                            className="text-xs font-semibold px-3 py-1.5 rounded-brand bg-wg-primary text-white hover:bg-wg-primary/90 transition-colors disabled:opacity-60"
                        >
                            {restoringLocal ? "Restoring…" : "Restore"}
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

            {/* ── Images of the restored draft that no longer exist ── */}
            {missingDraftImages > 0 && (
                <div role="status" className="mb-5 flex items-start gap-3 px-4 py-3 rounded-brand bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                        {missingDraftImages === 1
                            ? "1 image in the restored changes no longer exists and was left out. Upload it again if you need it."
                            : `${missingDraftImages} images in the restored changes no longer exist and were left out. Upload them again if you need them.`}
                    </p>
                    <button
                        type="button"
                        onClick={() => setMissingDraftImages(0)}
                        className="text-xs text-amber-700 dark:text-amber-300 hover:underline shrink-0"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Language toggle — top right, global for all sections */}
            <div className="flex justify-end mb-5">
                <div className="flex items-center gap-0.5 p-1 rounded-brand bg-wg-border/30 dark:bg-wg-dark-surface border border-wg-border/40 dark:border-wg-dark-border">
                    {(["en", "es"] as const).map((l) => (
                        <button
                            key={l}
                            type="button"
                            onClick={() => setLang(l)}
                            className={`px-5 py-2 text-sm font-bold uppercase tracking-wider rounded-[0.4rem] transition-all ${
                                lang === l
                                    ? "bg-wg-accent text-white shadow-sm"
                                    : "text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text"
                            }`}
                        >
                            {l.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300">
                    <CloseCircleSolidIcon className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Two-column grid: content (left) + sidebar (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-5">

                {/* ── LEFT: Main content ── */}
                <div className="space-y-5">

                    {/* 1. Basic Information */}
                    <SectionCard
                        title="Basic Information"
                        badge={
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent uppercase tracking-wide">
                                {lang}
                            </span>
                        }
                    >
                        <div className="space-y-4">
                            <div>
                                <FieldLabel>
                                    Name <span className="text-red-500">*</span>
                                </FieldLabel>
                                <input
                                    type="text"
                                    value={lang === "en" ? state.nameEn : state.nameEs}
                                    onChange={handleFieldChange(lang === "en" ? "nameEn" : "nameEs")}
                                    required
                                    minLength={2}
                                    maxLength={100}
                                    className={inputCls}
                                    placeholder={lang === "en" ? "e.g. Grilled Salmon Bowl" : "ej. Tazón de Salmón a la Parrilla"}
                                />
                            </div>

                            <div>
                                <FieldLabel hint={`${(lang === "en" ? state.descriptionEn : state.descriptionEs).length} / 500`}>
                                    Description <span className="text-red-500">*</span>
                                </FieldLabel>
                                <Textarea
                                    maxHeight={260}
                                    value={lang === "en" ? state.descriptionEn : state.descriptionEs}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: lang === "en" ? "descriptionEn" : "descriptionEs", value: v })}
                                    required
                                    minLength={10}
                                    maxLength={500}
                                    minRows={4}
                                    className={inputCls}
                                    placeholder={lang === "en"
                                        ? "Describe the dish — ingredients, preparation, origin…"
                                        : "Describe el plato en español…"
                                    }
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* 2. Pricing & Catalog */}
                    <SectionCard title="Pricing & Catalog">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Fixed prices by currency (independent from language) */}
                            <div className="col-span-2">
                                <FieldLabel>Prices by Currency <span className="text-red-500">*</span></FieldLabel>
                                <p className="mt-1.5 mb-3 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    Language only controls text. Prices are managed independently per currency.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(["PEN", "USD"] as SupportedCurrency[]).map((code) => (
                                        <div key={code}>
                                            <FieldLabel>{code}</FieldLabel>
                                            <AdminNumberInput
                                                value={state.prices[code]}
                                                onChange={(v) =>
                                                    dispatch({
                                                        type: "SET_FIELD",
                                                        field: "prices",
                                                        value: { ...state.prices, [code]: v },
                                                    })
                                                }
                                                min={0.01}
                                                max={9999.99}
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

                            {/* Category */}
                            <div>
                                <FieldLabel>
                                    Category <span className="text-red-500">*</span>
                                </FieldLabel>
                                <AdminSelect
                                    value={state.categoryId}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "categoryId", value: v })}
                                    options={categoryOptions}
                                    placeholder="Select category…"
                                    required
                                />
                            </div>

                            {/* Display order */}
                            <div>
                                <FieldLabel>Display Order</FieldLabel>
                                <AdminNumberInput
                                    value={state.order}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "order", value: v })}
                                    min={0}
                                    step={1}
                                    prefix="#"
                                    placeholder="0"
                                    nullable={false}
                                />
                                <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    Lower numbers appear first in the menu
                                </p>
                            </div>

                            {/* Availability */}
                            <div>
                                <FieldLabel>Availability</FieldLabel>
                                <button
                                    type="button"
                                    onClick={() =>
                                        dispatch({ type: "SET_FIELD", field: "available", value: !state.available })
                                    }
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-brand border text-sm font-medium transition-all ${
                                        state.available
                                            ? "border-wg-accent/50 dark:border-wg-dark-accent/40 bg-wg-accent/10 dark:bg-wg-dark-accent/12 text-wg-accent dark:text-wg-dark-accent"
                                            : "border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-wg-muted dark:text-wg-dark-muted"
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span
                                            className={`w-2 h-2 rounded-full transition-colors ${
                                                state.available ? "bg-wg-accent dark:bg-wg-dark-accent" : "bg-wg-muted/50 dark:bg-wg-dark-muted/50"
                                            }`}
                                        />
                                        {state.available ? "Available on menu" : "Hidden from menu"}
                                    </span>
                                    <ChevronUpDownIcon className="w-3.5 h-3.5 opacity-50" strokeWidth={2} />
                                </button>
                                <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    Click to toggle visibility
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    {/* 3. Gallery Images */}
                    <SectionCard
                        title="Gallery Images"
                        badge={
                            galleryImages.filter(Boolean).length > 0 ? (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary">
                                    {galleryImages.filter(Boolean).length}
                                </span>
                            ) : undefined
                        }
                    >
                        <div className="space-y-4">
                            {galleryImages.length === 0 && (
                                <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-center py-2">
                                    No gallery images yet. Add photos to show a slideshow on the product page.
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {galleryImages.map((img, i) => (
                                    <div
                                        key={i}
                                        className={`space-y-2 rounded-brand transition-opacity duration-150 ${dragIndex === i ? "opacity-40" : "opacity-100"}`}
                                        draggable
                                        onDragStart={() => setDragIndex(i)}
                                        onDragEnd={() => setDragIndex(null)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            if (dragIndex === null || dragIndex === i) return
                                            const updated = [...galleryImages]
                                            const tmp = updated[dragIndex]
                                            updated[dragIndex] = updated[i]
                                            updated[i] = tmp
                                            setGalleryImages(updated)
                                            setDragIndex(null)
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-xs font-medium text-wg-muted dark:text-wg-dark-muted cursor-grab active:cursor-grabbing select-none">
                                                <GripDotsIcon className="w-3 h-3 opacity-50" />
                                                Photo {i + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setGalleryImages(galleryImages.filter((_, idx) => idx !== i))}
                                                className="text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                            >
                                                Remove slot
                                            </button>
                                        </div>
                                        <ImageUploader
                                            value={img}
                                            onChange={(url) => {
                                                const updated = [...galleryImages]
                                                updated[i] = url
                                                setGalleryImages(updated)
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            {galleryImages.length < imageLimit && (
                                <button
                                    type="button"
                                    onClick={() => setGalleryImages([...galleryImages, null])}
                                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-brand border border-dashed border-wg-border/50 dark:border-wg-dark-border text-xs font-medium text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/60 hover:text-wg-primary dark:hover:border-wg-dark-primary/60 dark:hover:text-wg-dark-primary hover:bg-wg-primary/5 dark:hover:bg-wg-dark-primary/5 transition-colors"
                                >
                                    <PlusWideIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                    Add photo ({galleryImages.length}/{imageLimit})
                                </button>
                            )}
                        </div>
                    </SectionCard>

                    {/* 4. Tags */}
                    <SectionCard
                        title="Tags & Labels"
                        badge={
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent uppercase tracking-wide">
                                {lang}
                            </span>
                        }
                    >
                        <div className="space-y-4">
                            {/* Active tags with color controls */}
                            {activeTags.length > 0 && (
                                <div className="space-y-2">
                                    {activeTags.map((tag) => {
                                        const currentColor = state.tagColors[tag]
                                        return (
                                            <div key={tag} className="p-3 rounded-xl bg-wg-surface dark:bg-wg-dark-raised border border-wg-border/40 dark:border-wg-dark-border/40 space-y-2.5">
                                                {/* Tag preview + actions */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className={`flex-1 min-w-0 px-2.5 py-0.5 text-[11px] font-semibold rounded-full uppercase tracking-wide truncate${!currentColor ? " text-wg-muted dark:text-wg-dark-muted" : ""}`}
                                                        style={currentColor ? {
                                                            backgroundColor: `${currentColor}26`,
                                                            color: currentColor,
                                                            border: `1px solid ${currentColor}40`,
                                                        } : undefined}
                                                    >
                                                        {tag}
                                                    </span>
                                                    {/* Clear color */}
                                                    {currentColor && (
                                                        <button
                                                            type="button"
                                                            title="Clear color"
                                                            onClick={() => dispatch({ type: "SET_TAG_COLOR", tag, color: "" })}
                                                            className="w-6 h-6 flex items-center justify-center text-wg-muted dark:text-wg-dark-muted hover:text-amber-500 dark:hover:text-amber-400 transition-colors shrink-0"
                                                        >
                                                            <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                                        </button>
                                                    )}
                                                    {/* Remove tag */}
                                                    <button
                                                        type="button"
                                                        onClick={() => dispatch({ type: "REMOVE_TAG", tag, lang })}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-wg-muted hover:text-red-500 transition-colors shrink-0"
                                                        aria-label={`Remove ${tag}`}
                                                    >
                                                        <CloseSolidIcon className="w-3 h-3" />
                                                    </button>
                                                </div>

                                                {/* Color palette */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {palette.map((color) => {
                                                        const isSelected = currentColor === color
                                                        return (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                onClick={() => dispatch({ type: "SET_TAG_COLOR", tag, color })}
                                                                className="w-6 h-6 rounded-full transition-all active:scale-95"
                                                                style={{
                                                                    background: color,
                                                                    WebkitTouchCallout: "none",
                                                                    userSelect: "none",
                                                                    boxShadow: isSelected
                                                                        ? `0 0 0 2.5px white, 0 0 0 4px ${color}`
                                                                        : undefined,
                                                                } as React.CSSProperties}
                                                            />
                                                        )
                                                    })}
                                                    {/* Add new color to palette */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setPickerState({ tag, mode: "add" })}
                                                        className="w-6 h-6 rounded-full border-2 border-dashed border-wg-border dark:border-wg-dark-border flex items-center justify-center hover:border-wg-accent dark:hover:border-wg-dark-accent hover:bg-wg-accent/5 hover:scale-110 active:scale-95 transition-all"
                                                    >
                                                        <PlusIcon className="w-3 h-3 text-wg-muted dark:text-wg-dark-muted" strokeWidth={2.5} />
                                                    </button>
                                                    {/* Edit + Delete for selected palette color */}
                                                    {currentColor && palette.includes(currentColor) && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setPickerState({ tag, mode: "edit", editingColor: currentColor })}
                                                                className="w-6 h-6 rounded-full flex items-center justify-center bg-wg-surface dark:bg-wg-dark-raised border border-wg-border/60 dark:border-wg-dark-border hover:border-wg-accent dark:hover:border-wg-dark-accent hover:text-wg-accent dark:hover:text-wg-dark-accent text-wg-muted dark:text-wg-dark-muted transition-all active:scale-95"
                                                            >
                                                                <PencilIcon className="w-3 h-3" strokeWidth={2.5} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    removeFromPalette(currentColor)
                                                                    dispatch({ type: "SET_TAG_COLOR", tag, color: "" })
                                                                }}
                                                                className="w-6 h-6 rounded-full flex items-center justify-center bg-wg-surface dark:bg-wg-dark-raised border border-wg-border/60 dark:border-wg-dark-border hover:border-red-400 dark:hover:border-red-500 hover:text-red-500 dark:hover:text-red-400 text-wg-muted dark:text-wg-dark-muted transition-all active:scale-95"
                                                            >
                                                                <CloseIcon className="w-3 h-3" strokeWidth={2.5} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Tag input */}
                            <input
                                type="text"
                                value={state.tagInput}
                                onChange={(e) =>
                                    dispatch({ type: "SET_FIELD", field: "tagInput", value: e.target.value })
                                }
                                onKeyDown={(e) => handleTagKeyDown(e, lang)}
                                className={inputCls}
                                placeholder={lang === "en" ? "Type a tag and press Enter to add…" : "Escribe un tag y presiona Enter…"}
                            />

                            {/* Preset quick-add */}
                            {availableTagPresets.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-medium text-wg-muted dark:text-wg-dark-muted">
                                        Quick add:
                                    </span>
                                    {availableTagPresets.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => dispatch({ type: "ADD_TAG", tag, lang })}
                                            className="px-2.5 py-0.5 text-[11px] font-medium rounded-full border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/60 hover:text-wg-primary hover:bg-wg-primary/5 dark:hover:border-wg-dark-primary/60 dark:hover:text-wg-dark-primary transition-colors"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </SectionCard>
                </div>

                {/* ── RIGHT: Sidebar ── */}
                <div className="space-y-5">

                    {/* Drafts of this published product */}
                    {isPublishedParent && initialData?.id && (
                        <SectionCard
                            title="Drafts of this product"
                            badge={
                                draftSiblings.length > 0 ? (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        {draftSiblings.length}
                                    </span>
                                ) : undefined
                            }
                        >
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    disabled={isSavingDraft}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                    <PlusWideIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                    {isSavingDraft ? "Creating…" : "Save current edits as draft"}
                                </button>
                                {draftSiblings.length === 0 ? (
                                    <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted text-center py-2">
                                        No drafts yet. Drafts are alternate versions that don&apos;t affect this published product until promoted.
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {draftSiblings.map((d) => (
                                            <li
                                                key={d.id}
                                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-brand border border-wg-border/40 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg"
                                            >
                                                <Link
                                                    href={`/menu/${d.id}`}
                                                    className="flex-1 min-w-0 text-xs font-medium text-wg-text dark:text-wg-dark-text hover:text-wg-accent dark:hover:text-wg-dark-accent truncate"
                                                >
                                                    {d.name}
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPendingDuplicateDraftId(d.id)
                                                        setShowDuplicateDialog(true)
                                                    }}
                                                    className="p-1 rounded text-wg-muted hover:text-wg-primary dark:text-wg-dark-muted dark:hover:text-wg-dark-primary"
                                                    aria-label="Duplicate draft"
                                                    title="Duplicate"
                                                >
                                                    <DocumentDuplicateIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </SectionCard>
                    )}

                    {/* Image uploader */}
                    <SectionCard title="Image">
                        <ImageUploader
                            value={state.imageUrl}
                            onChange={(url) => dispatch({ type: "SET_IMAGE", url })}
                        />
                    </SectionCard>

                    {/* Homepage featured */}
                    <SectionCard title="Homepage">
                        <div className="space-y-3">
                            {/* Featured toggle */}
                            <div>
                                <FieldLabel>Featured on homepage</FieldLabel>
                                <button
                                    type="button"
                                    onClick={() =>
                                        dispatch({ type: "SET_FIELD", field: "featured", value: !state.featured })
                                    }
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-brand border text-sm font-medium transition-all ${
                                        state.featured
                                            ? "border-wg-accent/60 dark:border-wg-dark-accent/50 bg-wg-accent/8 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent"
                                            : "border-wg-border/50 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-wg-muted dark:text-wg-dark-muted"
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <StarOutlineIcon className={`w-4 h-4 transition-colors ${state.featured ? "text-wg-accent dark:text-wg-dark-accent" : "text-wg-muted dark:text-wg-dark-muted"}`} fill={state.featured ? "currentColor" : "none"} strokeWidth={1.75} />
                                        {state.featured ? "Shown on homepage" : "Not on homepage"}
                                    </span>
                                    <ChevronUpDownIcon className="w-3.5 h-3.5 opacity-50" strokeWidth={2} />
                                </button>
                            </div>

                            {/* Featured order — only shown when featured */}
                            {state.featured && (
                                <div>
                                    <FieldLabel>Homepage order</FieldLabel>
                                    <AdminNumberInput
                                        value={state.featuredOrder}
                                        onChange={(v) => dispatch({ type: "SET_FIELD", field: "featuredOrder", value: v })}
                                        min={0}
                                        step={1}
                                        prefix="#"
                                        placeholder="0"
                                        nullable={false}
                                    />
                                    <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                        Lower numbers appear first
                                    </p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Linked discounts (edit mode only) */}
                    {isEditMode && initialData?.id && (
                        <SectionCard
                            title="Linked Discounts"
                            badge={
                                discounts.length > 0 ? (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-wg-primary/10 text-wg-primary dark:bg-wg-dark-primary/15 dark:text-wg-dark-primary">
                                        {discounts.length}
                                    </span>
                                ) : undefined
                            }
                        >
                            <div className="space-y-2">

                                {/* ── All discounts (direct + category + global) in one unified list ── */}
                                {discounts.map((discount) => (
                                    <div
                                        key={discount.id}
                                        className="flex items-start gap-2 p-3 rounded-brand border border-wg-border/40 dark:border-wg-dark-border bg-wg-bg/40 dark:bg-wg-dark-bg/30"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">
                                                {discount.name}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${DISCOUNT_TYPE_COLORS[discount.type]}`}>
                                                    {DISCOUNT_TYPE_LABELS[discount.type]}
                                                </span>
                                                {/* Scope badge for non-direct discounts */}
                                                {discount.scope !== "direct" && (
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                                        discount.scope === "category"
                                                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                                            : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                                    }`}>
                                                        {discount.scope === "category" ? "Category" : "Global"}
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-wg-accent dark:text-wg-dark-accent">
                                                    {formatDiscountValue(discount)}
                                                </span>
                                                {discount.code && (
                                                    <code className="text-[10px] font-mono bg-wg-bg dark:bg-wg-dark-bg border border-wg-border/40 dark:border-wg-dark-border px-1.5 py-0.5 rounded">
                                                        {discount.code}
                                                    </code>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                            {/* Toggle active — only for direct discounts; others show static badge */}
                                            {discount.scope === "direct" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(discount)}
                                                    disabled={!!discountOp[discount.id]}
                                                    title={discount.active ? "Click to deactivate" : "Click to activate"}
                                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                                        discount.active
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                                                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                    }`}
                                                >
                                                    {discount.active ? "Active" : "Off"}
                                                </button>
                                            ) : (
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                                    discount.active
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                                }`}>
                                                    {discount.active ? "Active" : "Off"}
                                                </span>
                                            )}
                                            {/* Edit */}
                                            <Link
                                                href={`/discounts/${discount.id}`}
                                                title="Edit discount"
                                                className="p-1 rounded text-wg-muted dark:text-wg-dark-muted hover:text-wg-accent dark:hover:text-wg-dark-accent hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors"
                                            >
                                                <PencilShortSeamIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                            </Link>
                                            {/* Detach — smart behavior based on scope */}
                                            <button
                                                type="button"
                                                onClick={() => handleDetach(discount)}
                                                disabled={!!discountOp[discount.id]}
                                                title={
                                                    discount.scope === "direct"
                                                        ? "Detach from this item"
                                                        : "Exclude this item from the discount"
                                                }
                                                className="p-1 rounded text-wg-muted dark:text-wg-dark-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <ArrowsPointingOutIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* ── Empty state ── */}
                                {discounts.length === 0 && !showLinkPanel && (
                                    <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted py-2">
                                        No discounts linked to this item
                                    </p>
                                )}

                                {/* ── Link existing panel ── */}
                                {showLinkPanel && (
                                    <div className="mt-2 p-3 rounded-brand border border-wg-accent/20 dark:border-wg-dark-accent/20 bg-wg-accent/5 dark:bg-wg-dark-accent/5">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <p className="text-xs font-semibold text-wg-text dark:text-wg-dark-text">
                                                Link existing discount
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleCloseLinkPanel}
                                                className="p-0.5 rounded text-wg-muted hover:text-wg-text dark:text-wg-dark-muted dark:hover:text-wg-dark-text transition-colors"
                                            >
                                                <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search discounts…"
                                            value={linkSearch}
                                            onChange={(e) => setLinkSearch(e.target.value)}
                                            className={`${inputCls} mb-2`}
                                            autoFocus
                                        />
                                        {loadingDiscounts ? (
                                            <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted py-3">
                                                Loading…
                                            </p>
                                        ) : (() => {
                                            const alreadyLinked = new Set(discounts.map(d => d.id))
                                            const filtered = availableDiscounts.filter(
                                                (d) =>
                                                    !alreadyLinked.has(d.id) &&
                                                    d.name.toLowerCase().includes(linkSearch.toLowerCase())
                                            )
                                            return filtered.length === 0 ? (
                                                <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted py-2">
                                                    {availableDiscounts.length === 0 ? "No discounts found" : "No matches"}
                                                </p>
                                            ) : (
                                                <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                                                    {filtered.map((d) => (
                                                        <button
                                                            key={d.id}
                                                            type="button"
                                                            onClick={() => handleLink(d.id)}
                                                            disabled={!!discountOp[d.id]}
                                                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left hover:bg-wg-bg dark:hover:bg-wg-dark-bg border border-transparent hover:border-wg-border/40 dark:hover:border-wg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${DISCOUNT_TYPE_COLORS[d.type]}`}>
                                                                {DISCOUNT_TYPE_LABELS[d.type]}
                                                            </span>
                                                            <span className="flex-1 text-xs font-medium text-wg-text dark:text-wg-dark-text truncate">
                                                                {d.name}
                                                            </span>
                                                            <span className="shrink-0 text-xs font-bold text-wg-accent dark:text-wg-dark-accent">
                                                                {formatDiscountValue(d)}
                                                            </span>
                                                            <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                                                d.active
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                                            }`}>
                                                                {discountOp[d.id] ? "linking…" : (d.active ? "Active" : "Off")}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}

                                {/* ── Action buttons ── */}
                                <div className={`flex gap-2 ${(discounts.length > 0 || showLinkPanel) ? "mt-3 pt-3 border-t border-wg-border/20 dark:border-wg-dark-border/40" : "mt-1"}`}>
                                    {!showLinkPanel && (
                                        <button
                                            type="button"
                                            onClick={handleOpenLinkPanel}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-brand border border-dashed border-wg-border/50 dark:border-wg-dark-border text-xs font-medium text-wg-muted dark:text-wg-dark-muted hover:border-wg-accent/60 hover:text-wg-accent dark:hover:border-wg-dark-accent/60 dark:hover:text-wg-dark-accent hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/5 transition-colors"
                                        >
                                            <LinkIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                            Link existing
                                        </button>
                                    )}
                                    <Link
                                        href={`/discounts/new?menuItemId=${initialData.id}`}
                                        className={`${!showLinkPanel ? "flex-1" : "w-full"} flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-brand border border-dashed border-wg-border/50 dark:border-wg-dark-border text-xs font-medium text-wg-muted dark:text-wg-dark-muted hover:border-wg-primary/60 hover:text-wg-primary dark:hover:border-wg-dark-primary/60 dark:hover:text-wg-dark-primary hover:bg-wg-primary/5 dark:hover:bg-wg-dark-primary/5 transition-colors`}
                                    >
                                        <PlusWideIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                        New discount
                                    </Link>
                                </div>

                            </div>
                        </SectionCard>
                    )}

                    {/* Product ID (SKU) + URL Slug */}
                    <SectionCard title="Product Info">
                        <div className="space-y-4">
                            {/* SKU — shared, always visible */}
                            <div>
                                <FieldLabel>
                                    Product ID <span className="text-red-500">*</span>
                                </FieldLabel>
                                <input
                                    type="text"
                                    value={state.sku}
                                    onChange={(e) => dispatch({ type: "SET_FIELD", field: "sku", value: e.target.value.toUpperCase() })}
                                    required
                                    minLength={2}
                                    maxLength={30}
                                    pattern="[A-Z0-9\-]+"
                                    className={`${inputCls} font-mono uppercase tracking-wider`}
                                    placeholder="e.g. WG-001"
                                />
                                <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    Uppercase letters, numbers and hyphens · Shared across both languages
                                </p>
                            </div>
                            {/* Slug — per language. Locked for child drafts (inherits parent's slug). */}
                            <div>
                                <FieldLabel
                                    hint={
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent uppercase tracking-wide">
                                            {lang}
                                        </span>
                                    }
                                >
                                    Page URL
                                </FieldLabel>
                                {isChildDraft ? (
                                    <>
                                        <input
                                            type="text"
                                            value={lang === "en" ? parentSlug : (parentSlugEs || "")}
                                            disabled
                                            className={`${inputCls} font-mono opacity-60 cursor-not-allowed`}
                                            title="Drafts inherit their parent's URL. Edit the published product to change it."
                                        />
                                        <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                            Drafts inherit their parent&apos;s URL. Edit the published product to change it.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            value={lang === "en" ? state.slugEn : state.slugEs}
                                            onChange={(e) => {
                                                const clean = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                                                if (lang === "en") {
                                                    setSlugEnTouched(true)
                                                    dispatch({ type: "SET_FIELD", field: "slugEn", value: clean })
                                                } else {
                                                    setSlugEsTouched(true)
                                                    dispatch({ type: "SET_FIELD", field: "slugEs", value: clean })
                                                }
                                            }}
                                            minLength={2}
                                            maxLength={100}
                                            className={`${inputCls} font-mono`}
                                            placeholder={lang === "en" ? "my-dish-name" : "nombre-del-plato"}
                                        />
                                        {(lang === "en" ? state.slugEn : state.slugEs) && (
                                            <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted truncate">
                                                /menu/<span className="text-wg-accent dark:text-wg-dark-accent">{lang === "en" ? state.slugEn : state.slugEs}</span>
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    {/* ── Ingredients ── */}
                    <SectionCard
                        title="Ingredients"
                        badge={
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent uppercase tracking-wide">
                                {lang}
                            </span>
                        }
                    >
                        <div className="space-y-3">
                            <FieldLabel>
                                {lang === "en" ? "Ingredient list" : "Lista de ingredientes"}
                            </FieldLabel>

                            {(lang === "en" ? state.ingredientsEn : state.ingredientsEs).length > 0 && (
                                <ol className="space-y-1">
                                    {(lang === "en" ? state.ingredientsEn : state.ingredientsEs).map((item, i) => (
                                        <li
                                            key={i}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-brand bg-wg-bg dark:bg-wg-dark-bg border border-wg-border/40 dark:border-wg-dark-border/40 text-sm text-wg-text dark:text-wg-dark-text"
                                        >
                                            <span className="text-[11px] font-mono text-wg-muted dark:text-wg-dark-muted w-5 shrink-0">{i + 1}.</span>
                                            <span className="flex-1 truncate">{item}</span>
                                            <button
                                                type="button"
                                                onClick={() => dispatch({ type: "REMOVE_INGREDIENT", index: i, lang })}
                                                className="text-wg-muted dark:text-wg-dark-muted hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                            >
                                                <CloseIcon className="w-3.5 h-3.5" strokeWidth={2} />
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={state.ingredientInput}
                                    onChange={(e) =>
                                        dispatch({ type: "SET_FIELD", field: "ingredientInput", value: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            dispatch({ type: "ADD_INGREDIENT", ingredient: state.ingredientInput, lang })
                                        }
                                    }}
                                    maxLength={100}
                                    className={`${inputCls} flex-1`}
                                    placeholder={lang === "en" ? "e.g. Organic quinoa" : "ej. Quinua orgánica"}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        dispatch({ type: "ADD_INGREDIENT", ingredient: state.ingredientInput, lang })
                                    }
                                    className="px-3 py-2 rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:border-wg-accent/60 hover:text-wg-accent dark:hover:border-wg-dark-accent/60 dark:hover:text-wg-dark-accent hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/5 transition-colors"
                                >
                                    <PlusWideIcon className="w-4 h-4" strokeWidth={2} />
                                </button>
                            </div>
                            <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                {lang === "en"
                                    ? "Enter or click + to add · Separate list per language"
                                    : "Enter o clic en + para agregar · Lista separada por idioma"}
                            </p>
                        </div>
                    </SectionCard>

                </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-wg-border/30 dark:border-wg-dark-border">
                {/* Publish / Save / Promote */}
                <button
                    type="submit"
                    disabled={isSubmitting || isSavingDraft || isPromoting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isChildDraft && saveAndLeaveBlockedReason ? saveAndLeaveBlockedReason : undefined}
                >
                    {isSubmitting || isPromoting ? (
                        <>
                            <Spinner className="w-4 h-4 animate-spin" />
                            {isPromoting ? "Applying…" : "Saving…"}
                        </>
                    ) : (
                        <>
                            <CheckCompactIcon className="w-4 h-4" strokeWidth={2} />
                            {isChildDraft
                                ? "Apply draft to parent"
                                : isOrphanDraft
                                ? "Publish Item"
                                : isEditMode
                                ? "Save Changes"
                                : "Create Item"}
                        </>
                    )}
                </button>

                {/* Save as Draft */}
                <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || isSavingDraft || isPromoting}
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
                            {isPublishedParent ? "Save as new draft" : "Save as Draft"}
                        </>
                    )}
                </button>

                {/* Cancel */}
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting || isSavingDraft || isPromoting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors"
                >
                    <CloseIcon className="w-4 h-4" strokeWidth={2} />
                    Cancel
                </button>
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

            {/* Promote draft to parent confirmation */}
            <PromoteDraftDialog
                isOpen={showPromoteDialog}
                parentName={parent?.name ?? "the parent"}
                isLoading={isPromoting}
                onClose={() => !isPromoting && setShowPromoteDialog(false)}
                onConfirm={handlePromote}
            />

            {/* Duplicate-from-drafts-panel dialog */}
            {pendingDuplicateDraftId && (
                <DuplicateDraftDialog
                    isOpen={showDuplicateDialog}
                    hasParent={true}
                    isLoading={isDuplicating}
                    onClose={() => !isDuplicating && setShowDuplicateDialog(false)}
                    onConfirm={(mode) => handleDuplicate(mode, pendingDuplicateDraftId)}
                />
            )}

            {/* Custom color picker modal */}
            {pickerState && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setPickerState(null)}
                >
                    <div
                        className="bg-wg-card dark:bg-wg-dark-card rounded-2xl shadow-2xl border border-wg-border/60 dark:border-wg-dark-border overflow-hidden w-full max-w-xs"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ColorPicker
                            initialColor={
                                pickerState.editingColor ??
                                state.tagColors[pickerState.tag] ??
                                "#10b981"
                            }
                            onConfirm={handlePickerConfirm}
                            onCancel={() => setPickerState(null)}
                            title={pickerState.mode === "add" ? "Add color to palette" : "Edit palette color"}
                            confirmLabel={pickerState.mode === "add" ? "Add to palette" : "Update color"}
                        />
                    </div>
                </div>
            )}
        </form>
    )
}
