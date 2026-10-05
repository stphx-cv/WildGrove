"use client"

// ══════════════════════════════════════════════════════════════════
// DraftsListPanel — Side drawer listing all drafts of a parent product.
// Actions per draft: Edit (navigate), Duplicate (sibling/orphan), Delete.
// Header CTA: "Create new draft" → clones the parent.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { DuplicateDraftDialog, type DuplicateMode } from "@/components/DuplicateDraftDialog"
import {
    CloseIcon,
    DocumentDuplicateIcon,
    PencilSquareIcon,
    PlusWideIcon,
    TrashIcon,
} from "@wildgrove/ui/icons"

interface DraftItem {
    id: string
    name: string
    updatedAt: string
    parentId: string | null
}

interface DraftsListPanelProps {
    parent: { id: string; name: string } | null
    onClose: () => void
    /** Called after a mutation (create / duplicate / delete) so the parent page can refetch counts. */
    onChanged?: () => void
}

function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString()
}

export function DraftsListPanel({ parent, onClose, onChanged }: DraftsListPanelProps) {
    const isOpen = !!parent
    const [drafts, setDrafts] = useState<DraftItem[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<DraftItem | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [duplicateTarget, setDuplicateTarget] = useState<DraftItem | null>(null)
    const [duplicating, setDuplicating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchDrafts = useCallback(async (parentId: string) => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/menu?parent=${parentId}&limit=100`)
            const json = await res.json()
            if (json.success) {
                setDrafts(json.data.items)
            } else {
                setError(json.error || "Failed to load drafts")
            }
        } catch {
            setError("Network error.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (parent) fetchDrafts(parent.id)
        else setDrafts([])
    }, [parent, fetchDrafts])

    useEffect(() => {
        if (!isOpen) return
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        document.addEventListener("keydown", handleKey)
        return () => document.removeEventListener("keydown", handleKey)
    }, [isOpen, onClose])

    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden"
        else document.body.style.overflow = ""
        return () => { document.body.style.overflow = "" }
    }, [isOpen])

    const handleCreate = useCallback(async () => {
        if (!parent) return
        setCreating(true)
        setError(null)
        try {
            const res = await fetch(`/api/menu/${parent.id}/drafts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
            const json = await res.json()
            if (json.success) {
                await fetchDrafts(parent.id)
                onChanged?.()
            } else {
                setError(json.error || "Failed to create draft")
            }
        } catch {
            setError("Network error.")
        } finally {
            setCreating(false)
        }
    }, [parent, fetchDrafts, onChanged])

    const handleDelete = useCallback(async () => {
        if (!deleteTarget || !parent) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/menu/${deleteTarget.id}`, { method: "DELETE" })
            if (res.ok) {
                setDeleteTarget(null)
                await fetchDrafts(parent.id)
                onChanged?.()
            } else {
                const json = await res.json().catch(() => null)
                setError(json?.error || "Failed to delete draft")
            }
        } catch {
            setError("Network error.")
        } finally {
            setDeleting(false)
        }
    }, [deleteTarget, parent, fetchDrafts, onChanged])

    const handleDuplicate = useCallback(async (mode: DuplicateMode) => {
        if (!duplicateTarget || !parent) return
        setDuplicating(true)
        try {
            const res = await fetch(`/api/menu/drafts/${duplicateTarget.id}/duplicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            })
            const json = await res.json()
            if (json.success) {
                setDuplicateTarget(null)
                if (mode === "sibling") {
                    await fetchDrafts(parent.id)
                }
                onChanged?.()
            } else {
                setError(json.error || "Failed to duplicate draft")
            }
        } catch {
            setError("Network error.")
        } finally {
            setDuplicating(false)
        }
    }, [duplicateTarget, parent, fetchDrafts, onChanged])

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

            {/* Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col
                    bg-wg-surface dark:bg-wg-dark-raised shadow-elevated
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? "translate-x-0" : "translate-x-full"}`}
                role="dialog"
                aria-modal="true"
                aria-label="Drafts panel"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border/30 dark:border-wg-dark-border flex-shrink-0">
                    <div className="min-w-0">
                        <h2 className="font-display font-semibold text-base text-wg-text dark:text-wg-dark-text truncate">
                            Drafts
                        </h2>
                        {parent && (
                            <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted truncate">
                                of <span className="font-medium">{parent.name}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-brand text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text hover:bg-wg-bg dark:hover:bg-wg-dark-bg transition-colors flex-shrink-0"
                        aria-label="Close"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
                    {error && (
                        <div className="px-3 py-2 rounded-brand bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-xs text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PlusWideIcon className="w-4 h-4" strokeWidth={2} />
                        {creating ? "Creating…" : "Create new draft"}
                    </button>

                    {loading ? (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-center py-6">Loading…</p>
                    ) : drafts.length === 0 ? (
                        <p className="text-xs text-wg-muted dark:text-wg-dark-muted text-center py-6">
                            No drafts yet. Click &ldquo;Create new draft&rdquo; to start an alternate version.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {drafts.map((draft) => (
                                <li
                                    key={draft.id}
                                    className="flex items-center gap-2 p-3 rounded-brand border border-wg-border/40 dark:border-wg-dark-border bg-wg-bg dark:bg-wg-dark-bg"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-wg-text dark:text-wg-dark-text truncate">
                                            {draft.name}
                                        </div>
                                        <div className="text-[11px] text-wg-muted dark:text-wg-dark-muted">
                                            Updated {formatRelative(draft.updatedAt)}
                                        </div>
                                    </div>
                                    <Link
                                        href={`/menu/${draft.id}`}
                                        onClick={onClose}
                                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
                                        aria-label="Edit draft"
                                        title="Edit"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => setDuplicateTarget(draft)}
                                        className="p-1.5 rounded-brand text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border transition-colors"
                                        aria-label="Duplicate draft"
                                        title="Duplicate"
                                    >
                                        <DocumentDuplicateIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(draft)}
                                        className="p-1.5 rounded-brand text-wg-muted hover:text-red-600 hover:bg-red-50 dark:text-wg-dark-muted dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                                        aria-label="Delete draft"
                                        title="Delete"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete draft"
                message={`Delete "${deleteTarget?.name}"? This cannot be undone. The parent product is not affected.`}
                confirmLabel="Delete"
                variant="danger"
                isLoading={deleting}
            />

            <DuplicateDraftDialog
                isOpen={!!duplicateTarget}
                hasParent={!!duplicateTarget?.parentId}
                isLoading={duplicating}
                onClose={() => setDuplicateTarget(null)}
                onConfirm={handleDuplicate}
            />
        </>
    )
}
