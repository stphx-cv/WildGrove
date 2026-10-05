"use client"

// ══════════════════════════════════════════════════════════════════
// CategoryForm — Create / Edit a menu category
// Two-column layout · bilingual toggle (EN/ES, both required)
// AdminNumberInput for order · DB-backed drafts + localStorage fallback
// ══════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useReducer, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import {
    CheckCompactIcon,
    ClockRightAngleIcon,
    CloseCircleSolidIcon,
    CloseIcon,
    DocumentTextIcon,
    Spinner,
} from "@wildgrove/ui/icons"
import { CATEGORY_ICONS, getCategoryIconByKey } from "@/lib/category-icons"
import { AdminNumberInput } from "@/components/AdminNumberInput"
import { DraftGuardModal } from "@/components/DraftGuardModal"
import { useDraftGuard } from "@/hooks/useDraftGuard"
import { getCategoryPublishBlockedReason } from "@wildgrove/core/admin-validation"
import { slugify } from "@wildgrove/core/slug"

// ── Types ──

interface CategoryDraftContent {
    formState: FormState
    savedAt: string
}

interface CategoryFormData {
    id?: string
    name: string
    nameEs?: string | null
    slug: string
    slugEs?: string | null
    icon: string
    order: number
    isDraft?: boolean
    draftData?: CategoryDraftContent | null
}

interface CategoryFormProps {
    initialData?: CategoryFormData
}

// ── Form state ──

type FormState = {
    nameEn: string
    nameEs: string
    slugEn: string
    slugEs: string
    icon: string
    order: string
}

type FormAction =
    | { type: "SET_FIELD"; field: keyof FormState; value: string }
    | { type: "RESTORE_STATE"; state: FormState }

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case "SET_FIELD":
            return { ...state, [action.field]: action.value }
        case "RESTORE_STATE":
            return action.state
        default:
            return state
    }
}

function getInitialState(data?: CategoryFormData): FormState {
    // For draft items, hydrate from draftData if available (it has the most recent edits)
    if (data?.isDraft && data?.draftData?.formState) {
        return data.draftData.formState
    }
    return {
        nameEn: data?.name    ?? "",
        nameEs: data?.nameEs  ?? "",
        slugEn: data?.slug    ?? "",
        slugEs: data?.slugEs  ?? "",
        icon:   data?.icon    ?? "default",
        order:  data?.order   !== undefined ? String(data.order) : "0",
    }
}

// ── Helpers ──

// ── Shared input style ──

const inputCls =
    "w-full px-3.5 py-2.5 text-sm rounded-brand border border-wg-border/50 dark:border-wg-dark-border " +
    "bg-wg-bg dark:bg-wg-dark-bg text-wg-text dark:text-wg-dark-text " +
    "placeholder:text-wg-muted/50 dark:placeholder:text-wg-dark-muted/50 " +
    "focus:outline-none focus:ring-2 focus:ring-wg-accent/20 focus:border-wg-accent dark:focus:border-wg-dark-accent " +
    "transition-colors"

// ── Small reusable pieces ──

function SectionCard({
    title,
    badge,
    children,
}: {
    title: string
    badge?: React.ReactNode
    children: React.ReactNode
}) {
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

function FieldLabel({
    children,
    hint,
}: {
    children: React.ReactNode
    hint?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-wg-text dark:text-wg-dark-text">{children}</label>
            {hint && <span className="text-[11px] text-wg-muted dark:text-wg-dark-muted tabular-nums">{hint}</span>}
        </div>
    )
}

function formatDraftAge(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString()
}

// ── Component ──

export function CategoryForm({ initialData }: CategoryFormProps) {
    const router = useRouter()
    const isEditMode = !!initialData?.id
    const isDraftItem = !!initialData?.isDraft

    const [state, dispatch] = useReducer(formReducer, getInitialState(initialData))
    const [lang, setLang]   = useState<"en" | "es">("en")

    const [isSubmitting,   setIsSubmitting]   = useState(false)
    const [isSavingDraft,  setIsSavingDraft]  = useState(false)
    const [guardSaving,    setGuardSaving]    = useState(false)
    const [guardSavingDraft, setGuardSavingDraft] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Track whether slugs have been manually edited
    const [slugEnTouched, setSlugEnTouched] = useState(isEditMode)
    const [slugEsTouched, setSlugEsTouched] = useState(!!(isEditMode && initialData?.slugEs))

    // ── Auto-generate EN slug from EN name ──
    useEffect(() => {
        if (!slugEnTouched && state.nameEn) {
            dispatch({ type: "SET_FIELD", field: "slugEn", value: slugify(state.nameEn) })
        }
    }, [state.nameEn, slugEnTouched])

    // ── Auto-generate ES slug from ES name ──
    useEffect(() => {
        if (!slugEsTouched && state.nameEs) {
            dispatch({ type: "SET_FIELD", field: "slugEs", value: slugify(state.nameEs) })
        }
    }, [state.nameEs, slugEsTouched])

    // ── Dirty tracking ──
    const initialStateRef = useRef(getInitialState(initialData))
    const isDirty = useMemo(
        () => JSON.stringify(state) !== JSON.stringify(initialStateRef.current),
        [state]
    )

    // ── localStorage draft ──
    const localKey = `wg_draft_category_${initialData?.id ?? "new"}`

    const clearLocalDraft = useCallback(() => {
        try { localStorage.removeItem(localKey) } catch {}
    }, [localKey])

    useEffect(() => {
        if (!isDirty) return
        const t = setTimeout(() => {
            try {
                const draft: CategoryDraftContent = {
                    formState: state,
                    savedAt: new Date().toISOString(),
                }
                localStorage.setItem(localKey, JSON.stringify(draft))
            } catch {}
        }, 600)
        return () => clearTimeout(t)
    }, [state, isDirty, localKey])

    // ── localStorage restore banner ──
    const [localDraft, setLocalDraft] = useState<CategoryDraftContent | null>(null)
    const [showLocalRestore, setShowLocalRestore] = useState(false)

    useEffect(() => {
        try {
            const stored = localStorage.getItem(localKey)
            if (stored) {
                const draft = JSON.parse(stored) as CategoryDraftContent
                setLocalDraft(draft)
                setShowLocalRestore(true)
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── DB draftData restore banner (published category with pending edits) ──
    const hasDbDraft = !isDraftItem && !!initialData?.draftData
    const [showDbRestore, setShowDbRestore] = useState(hasDbDraft)

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
        if (!initialData?.draftData?.formState) return
        dispatch({ type: "RESTORE_STATE", state: initialData.draftData.formState })
        setShowDbRestore(false)
    }, [initialData?.draftData])

    // ── Draft guard ──
    const guard = useDraftGuard(isDirty)

    // ── Build payload ──
    const buildPayload = useCallback(() => ({
        name:   state.nameEn.trim(),
        nameEs: state.nameEs.trim(),
        slug:   state.slugEn.trim() || undefined,
        slugEs: state.slugEs.trim() || undefined,
        icon:   state.icon,
        order:  parseInt(state.order, 10) || 0,
    }), [state])

    const saveAndLeaveBlockedReason = useMemo(
        () => getCategoryPublishBlockedReason(isEditMode, buildPayload()),
        [isEditMode, buildPayload]
    )

    // ── Save as Draft (DB-backed + navigate) ──
    const handleSaveDraft = useCallback(async () => {
        setIsSavingDraft(true)
        setError(null)
        const draftContent: CategoryDraftContent = { formState: state, savedAt: new Date().toISOString() }

        try {
            if (isEditMode) {
                if (isDraftItem) {
                    // Draft category → update all fields + keep isDraft: true + persist draftData
                    const res = await fetch(`/api/categories/${initialData!.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...buildPayload(), isDraft: true, draftData: draftContent }),
                    })
                    const json = await res.json()
                    if (!json.success) { setError(json.error || "Something went wrong"); return }
                } else {
                    // Published category → only save draftData
                    const res = await fetch(`/api/categories/${initialData!.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ saveDraftData: true, draftData: draftContent }),
                    })
                    const json = await res.json()
                    if (!json.success) { setError(json.error || "Something went wrong"); return }
                }
            } else {
                // New category → create draft record
                const res = await fetch("/api/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        isDraft: true,
                        name: state.nameEn.trim() || "Untitled Draft",
                        nameEs: state.nameEs.trim() || null,
                        slug: state.slugEn.trim() || undefined,
                        icon: state.icon,
                        order: parseInt(state.order, 10) || 0,
                        draftData: draftContent,
                    }),
                })
                const json = await res.json()
                if (!json.success) { setError(json.error || "Something went wrong"); return }
            }

            clearLocalDraft()
            guard.disableGuard()
            router.push("/categories")
            router.refresh()
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setIsSavingDraft(false)
        }
    }, [state, isEditMode, isDraftItem, initialData, buildPayload, clearLocalDraft, guard, router])

    // ── Submit (publish) ──
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!state.nameEn.trim() || state.nameEn.trim().length < 2) {
            setLang("en")
            setError("English name is required (min 2 characters)")
            return
        }
        if (!state.nameEs.trim() || state.nameEs.trim().length < 2) {
            setLang("es")
            setError("Spanish name is required (min 2 characters)")
            return
        }

        setIsSubmitting(true)

        try {
            const url    = isEditMode ? `/api/categories/${initialData!.id}` : "/api/categories"
            const method = isEditMode ? "PATCH" : "POST"
            const payload = { ...buildPayload(), isDraft: false, clearDraft: true }

            const res  = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await res.json()

            if (!json.success) {
                setError(json.error ?? "Something went wrong")
                return
            }

            clearLocalDraft()
            guard.disableGuard()
            router.push("/categories")
            router.refresh()
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }, [state, isEditMode, initialData, buildPayload, clearLocalDraft, guard, router])

    // ── Guard modal handlers ──
    const handleGuardSave = useCallback(async () => {
        setGuardSaving(true)
        try {
            const url    = isEditMode ? `/api/categories/${initialData!.id}` : "/api/categories"
            const method = isEditMode ? "PATCH" : "POST"
            const payload = { ...buildPayload(), isDraft: false, clearDraft: true }

            const res  = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await res.json()

            if (json.success) {
                clearLocalDraft()
                guard.disableGuard()
                router.push("/categories")
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

    const handleGuardSaveDraft = useCallback(async () => {
        setGuardSavingDraft(true)
        const draftContent: CategoryDraftContent = { formState: state, savedAt: new Date().toISOString() }
        try {
            if (isEditMode) {
                if (isDraftItem) {
                    await fetch(`/api/categories/${initialData!.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...buildPayload(), isDraft: true, draftData: draftContent }),
                    })
                } else {
                    await fetch(`/api/categories/${initialData!.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ saveDraftData: true, draftData: draftContent }),
                    })
                }
            } else {
                await fetch("/api/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        isDraft: true,
                        name: state.nameEn.trim() || "Untitled Draft",
                        nameEs: state.nameEs.trim() || null,
                        slug: state.slugEn.trim() || undefined,
                        icon: state.icon,
                        order: parseInt(state.order, 10) || 0,
                        draftData: draftContent,
                    }),
                })
            }
            clearLocalDraft()
            guard.disableGuard()
            router.push("/categories")
            router.refresh()
        } catch {
            setGuardSavingDraft(false)
        }
    }, [state, isEditMode, isDraftItem, initialData, buildPayload, clearLocalDraft, guard, router])

    const handleCancel = useCallback(() => {
        clearLocalDraft()
        guard.disableGuard()
        router.back()
    }, [clearLocalDraft, guard, router])

    return (
        <form onSubmit={handleSubmit} className="space-y-0">

            {/* ── Draft item banner ── */}
            {isDraftItem && (
                <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-brand bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                    <DocumentTextIcon className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                        <span className="font-semibold">Draft category</span> — not visible to customers. Publish it when it&apos;s ready.
                    </p>
                </div>
            )}

            {/* ── DB draft restore banner (published category with pending edits) ── */}
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

            {/* ── Error banner ── */}
            {error && (
                <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300">
                    <CloseCircleSolidIcon className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Language toggle ── */}
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

            {/* ── Two-column grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-5">

                {/* ── LEFT: Name + Icon ── */}
                <div className="space-y-5">

                    {/* Category Name */}
                    <SectionCard
                        title="Category Name"
                        badge={
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-wg-accent/10 dark:bg-wg-dark-accent/10 text-wg-accent dark:text-wg-dark-accent uppercase tracking-wide">
                                {lang}
                            </span>
                        }
                    >
                        <div>
                            <FieldLabel>
                                Name <span className="text-red-500">*</span>
                            </FieldLabel>
                            <input
                                type="text"
                                value={lang === "en" ? state.nameEn : state.nameEs}
                                onChange={(e) =>
                                    dispatch({
                                        type: "SET_FIELD",
                                        field: lang === "en" ? "nameEn" : "nameEs",
                                        value: e.target.value,
                                    })
                                }
                                minLength={2}
                                maxLength={50}
                                className={inputCls}
                                placeholder={lang === "en" ? "e.g. Starters" : "ej. Entradas"}
                            />
                            {/* Soft indicator for the other language */}
                            {lang === "en" && state.nameEs && (
                                <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    ES: <span className="text-wg-text dark:text-wg-dark-text">{state.nameEs}</span>
                                </p>
                            )}
                            {lang === "es" && state.nameEn && (
                                <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    EN: <span className="text-wg-text dark:text-wg-dark-text">{state.nameEn}</span>
                                </p>
                            )}
                        </div>
                        <p className="mt-3 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                            Both English and Spanish names are required. Switch between languages using the toggle above.
                        </p>
                    </SectionCard>

                    {/* Icon Picker */}
                    <SectionCard title="Icon">
                        <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mb-3">
                            Select an icon to represent this category
                        </p>
                        <div className="grid grid-cols-8 gap-1.5">
                            {CATEGORY_ICONS.map((def) => {
                                const isActive = state.icon === def.key
                                return (
                                    <button
                                        key={def.key}
                                        type="button"
                                        title={def.label}
                                        onClick={() => dispatch({ type: "SET_FIELD", field: "icon", value: def.key })}
                                        className={[
                                            "flex items-center justify-center w-full aspect-square rounded-brand transition-all",
                                            isActive
                                                ? "bg-wg-accent/15 dark:bg-wg-dark-accent/20 border-2 border-wg-accent dark:border-wg-dark-accent text-wg-accent dark:text-wg-dark-accent"
                                                : "border border-wg-border/40 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg text-wg-muted dark:text-wg-dark-muted hover:border-wg-accent/50 hover:text-wg-accent dark:hover:border-wg-dark-accent/50 dark:hover:text-wg-dark-accent hover:bg-wg-accent/5 dark:hover:bg-wg-dark-accent/5",
                                        ].join(" ")}
                                    >
                                        {def.render("w-4 h-4")}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-wg-muted dark:text-wg-dark-muted">
                            <span className="text-wg-text dark:text-wg-dark-text">
                                {getCategoryIconByKey(state.icon, "w-4 h-4")}
                            </span>
                            <span>{CATEGORY_ICONS.find((i) => i.key === state.icon)?.label ?? "Default"}</span>
                        </div>
                    </SectionCard>
                </div>

                {/* ── RIGHT: Catalog settings ── */}
                <div className="space-y-5">
                    <SectionCard title="Catalog">
                        <div className="space-y-5">

                            {/* Page URL — per language */}
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
                                    maxLength={50}
                                    className={`${inputCls} font-mono`}
                                    placeholder={lang === "en" ? "my-category" : "mi-categoria"}
                                />
                                {(lang === "en" ? state.slugEn : state.slugEs) && (
                                    <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted truncate">
                                        /menu/<span className="text-wg-accent dark:text-wg-dark-accent">{lang === "en" ? state.slugEn : state.slugEs}</span>
                                    </p>
                                )}
                                <p className="mt-2 text-[11px] text-wg-muted dark:text-wg-dark-muted leading-relaxed">
                                    Customers visit this URL to browse the category. Switch languages above to set each slug.
                                </p>
                            </div>

                            {/* Display Order */}
                            <div>
                                <FieldLabel hint="Lower = shown first">
                                    Display Order
                                </FieldLabel>
                                <AdminNumberInput
                                    value={state.order}
                                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "order", value: v })}
                                    min={0}
                                    nullable={false}
                                    prefix="#"
                                    placeholder="0"
                                />
                                <p className="mt-1.5 text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                    Controls the position of this category in the menu listing.
                                </p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex flex-wrap items-center gap-3 pt-5">
                {/* Publish */}
                <button
                    type="submit"
                    disabled={isSubmitting || isSavingDraft}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <><Spinner className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                        <>
                            <CheckCompactIcon className="w-4 h-4" strokeWidth={2} />
                            {isDraftItem ? "Publish Category" : isEditMode ? "Save Changes" : "Create Category"}
                        </>
                    )}
                </button>

                {/* Save as Draft */}
                <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || isSavingDraft}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSavingDraft ? (
                        <><Spinner className="w-4 h-4 animate-spin" /> Saving…</>
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors"
                >
                    <CloseIcon className="w-4 h-4" strokeWidth={2} />
                    Cancel
                </button>
            </div>

            {/* ── Draft Guard Modal ── */}
            <DraftGuardModal
                isOpen={guard.modalOpen}
                onSave={handleGuardSave}
                onSaveDraft={handleGuardSaveDraft}
                onDiscard={() => { clearLocalDraft(); guard.discardAndNavigate() }}
                onStay={guard.closeModal}
                isSaving={guardSaving}
                isSavingDraft={guardSavingDraft}
                saveAndLeaveBlockedReason={saveAndLeaveBlockedReason}
            />
        </form>
    )
}
