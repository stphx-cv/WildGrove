"use client"

// ══════════════════════════════════════════════════════════════════
// DraftGuardModal — Shown when navigating away with unsaved changes
// ══════════════════════════════════════════════════════════════════

import { useEffect } from "react"
import {
    CheckCompactIcon,
    CloseIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    Spinner,
} from "@wildgrove/ui/icons"

interface DraftGuardModalProps {
    isOpen: boolean
    onSave: () => void
    onSaveDraft: () => void
    onDiscard: () => void
    onStay: () => void
    isSaving?: boolean
    isSavingDraft?: boolean
    /** When set, "Save & Leave" (publish) is disabled and this message is shown. */
    saveAndLeaveBlockedReason?: string | null
}

export function DraftGuardModal({
    isOpen,
    onSave,
    onSaveDraft,
    onDiscard,
    onStay,
    isSaving = false,
    isSavingDraft = false,
    saveAndLeaveBlockedReason = null,
}: DraftGuardModalProps) {
    // Escape key → stay on page
    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onStay()
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [isOpen, onStay])

    if (!isOpen) return null

    const busy = isSaving || isSavingDraft
    const publishBlocked = Boolean(saveAndLeaveBlockedReason?.trim())
    const saveLeaveDisabled = busy || publishBlocked
    const saveLeaveHintId = "draft-guard-save-leave-hint"

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onStay}
        >
            <div
                className="bg-wg-surface dark:bg-wg-dark-surface rounded-2xl shadow-elevated border border-wg-border/50 dark:border-wg-dark-border w-full max-w-sm overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-wg-text dark:text-wg-dark-text">
                                Unsaved changes
                            </h3>
                            <p className="text-sm text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                You have changes that haven&apos;t been saved yet. What would you like to do?
                            </p>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-wg-border/30 dark:bg-wg-dark-border" />

                {/* Action rows */}
                <div className="p-4 space-y-2">

                    {/* Save as Draft */}
                    <button
                        type="button"
                        onClick={onSaveDraft}
                        disabled={busy}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-brand border border-wg-border/50 dark:border-wg-dark-border bg-wg-surface dark:bg-wg-dark-surface hover:border-wg-primary/50 dark:hover:border-wg-dark-primary/50 hover:bg-wg-primary/5 dark:hover:bg-wg-dark-primary/5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-wg-primary/10 dark:bg-wg-dark-primary/15 flex items-center justify-center shrink-0 group-hover:bg-wg-primary/15 dark:group-hover:bg-wg-dark-primary/20 transition-colors">
                            <DocumentTextIcon className="w-4 h-4 text-wg-primary dark:text-wg-dark-primary" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                                Save as Draft
                            </p>
                            <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                Keep changes without publishing. Not visible to customers.
                            </p>
                        </div>
                        {isSavingDraft && <Spinner className="w-4 h-4 animate-spin shrink-0 text-wg-muted dark:text-wg-dark-muted" />}
                    </button>

                    {/* Save & Leave */}
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saveLeaveDisabled}
                        title={publishBlocked ? saveAndLeaveBlockedReason ?? undefined : undefined}
                        aria-describedby={publishBlocked && saveAndLeaveBlockedReason ? saveLeaveHintId : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-brand border text-left transition-all disabled:cursor-not-allowed ${
                            publishBlocked && !busy
                                ? "border-wg-border/40 dark:border-wg-dark-border opacity-60 bg-wg-bg/40 dark:bg-wg-dark-bg/30"
                                : "border-wg-accent/40 dark:border-wg-dark-accent/40 bg-wg-accent/5 dark:bg-wg-dark-accent/5 hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10 hover:border-wg-accent/60 dark:hover:border-wg-dark-accent/60"
                        } disabled:opacity-50`}
                    >
                        <div className="w-8 h-8 rounded-lg bg-wg-accent/10 dark:bg-wg-dark-accent/15 flex items-center justify-center shrink-0">
                            <CheckCompactIcon className="w-4 h-4 text-wg-accent dark:text-wg-dark-accent" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-wg-text dark:text-wg-dark-text">
                                Save &amp; Leave
                            </p>
                            <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                Publish all changes and continue navigating.
                            </p>
                            {publishBlocked && saveAndLeaveBlockedReason && !busy && (
                                <p id={saveLeaveHintId} className="text-[11px] text-amber-700 dark:text-amber-400/95 mt-1.5 leading-snug">
                                    Not available: {saveAndLeaveBlockedReason}
                                </p>
                            )}
                        </div>
                        {isSaving && <Spinner className="w-4 h-4 animate-spin shrink-0 text-wg-muted dark:text-wg-dark-muted" />}
                    </button>

                    {/* Discard */}
                    <button
                        type="button"
                        onClick={onDiscard}
                        disabled={busy}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-brand border border-red-300/55 dark:border-red-800/55 bg-wg-surface dark:bg-wg-dark-surface hover:bg-red-50 dark:hover:bg-red-900/15 hover:border-red-400/60 dark:hover:border-red-700/50 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                            <CloseIcon className="w-4 h-4 text-red-500 dark:text-red-400" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                Discard &amp; Leave
                            </p>
                            <p className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                All unsaved changes will be permanently lost.
                            </p>
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5">
                    <button
                        type="button"
                        onClick={onStay}
                        className="w-full py-2 text-sm text-wg-muted dark:text-wg-dark-muted hover:text-wg-text dark:hover:text-wg-dark-text transition-colors text-center"
                    >
                        Stay on this page
                    </button>
                </div>
            </div>
        </div>
    )
}
