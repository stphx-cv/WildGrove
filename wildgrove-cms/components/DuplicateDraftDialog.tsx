"use client"

// ══════════════════════════════════════════════════════════════════
// DuplicateDraftDialog — Choose whether the new copy is a sibling
// under the same parent, or an independent (orphan) draft.
// ══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"

export type DuplicateMode = "sibling" | "orphan"

interface DuplicateDraftDialogProps {
    isOpen: boolean
    hasParent: boolean
    isLoading?: boolean
    onClose: () => void
    onConfirm: (mode: DuplicateMode) => void
}

export function DuplicateDraftDialog({
    isOpen,
    hasParent,
    isLoading = false,
    onClose,
    onConfirm,
}: DuplicateDraftDialogProps) {
    const [mode, setMode] = useState<DuplicateMode>(hasParent ? "sibling" : "orphan")

    // Each opening starts from the default choice, so a mode picked and then
    // cancelled does not come back on the next open. Adjusted during render
    // rather than in an effect: an effect would paint the stale choice for one
    // frame first, and React flags setting state from an effect body.
    const [prevProps, setPrevProps] = useState({ isOpen, hasParent })
    if (prevProps.isOpen !== isOpen || prevProps.hasParent !== hasParent) {
        setPrevProps({ isOpen, hasParent })
        if (isOpen) setMode(hasParent ? "sibling" : "orphan")
    }

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isLoading) onClose()
        }
        if (isOpen) {
            document.addEventListener("keydown", handleEscape)
            document.body.style.overflow = "hidden"
        }
        return () => {
            document.removeEventListener("keydown", handleEscape)
            document.body.style.overflow = ""
        }
    }, [isOpen, onClose, isLoading])

    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isLoading) onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-draft-title"
        >
            <div className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6">
                <h3 id="duplicate-draft-title" className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-1">
                    Duplicate draft
                </h3>
                <p className="text-sm text-wg-muted dark:text-wg-dark-muted mb-5">
                    Where should the new copy live?
                </p>

                <div className="space-y-2 mb-6">
                    <label
                        className={`flex items-start gap-3 p-3 rounded-brand border cursor-pointer transition-colors ${
                            mode === "sibling"
                                ? "border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/10"
                                : "border-wg-border/50 dark:border-wg-dark-border hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                        } ${!hasParent ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <input
                            type="radio"
                            name="duplicate-mode"
                            value="sibling"
                            checked={mode === "sibling"}
                            disabled={!hasParent}
                            onChange={() => setMode("sibling")}
                            className="wg-radio wg-control-accent mt-0.5 w-4 h-4"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                Sibling under same product
                            </div>
                            <div className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                {hasParent
                                    ? "Another alternate version of the same parent product."
                                    : "Not available — source draft has no parent."}
                            </div>
                        </div>
                    </label>

                    <label
                        className={`flex items-start gap-3 p-3 rounded-brand border cursor-pointer transition-colors ${
                            mode === "orphan"
                                ? "border-wg-accent dark:border-wg-dark-accent bg-wg-accent/5 dark:bg-wg-dark-accent/10"
                                : "border-wg-border/50 dark:border-wg-dark-border hover:bg-wg-bg dark:hover:bg-wg-dark-bg"
                        }`}
                    >
                        <input
                            type="radio"
                            name="duplicate-mode"
                            value="orphan"
                            checked={mode === "orphan"}
                            onChange={() => setMode("orphan")}
                            className="wg-radio wg-control-accent mt-0.5 w-4 h-4"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-wg-text dark:text-wg-dark-text">
                                Independent (orphan) draft
                            </div>
                            <div className="text-[11px] text-wg-muted dark:text-wg-dark-muted mt-0.5">
                                Standalone draft. Publishing it creates a new product.
                            </div>
                        </div>
                    </label>
                </div>

                <div className="flex items-center gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(mode)}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium rounded-brand bg-wg-accent hover:bg-wg-accent-hover text-white disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? "Duplicating…" : "Duplicate"}
                    </button>
                </div>
            </div>
        </div>
    )
}
