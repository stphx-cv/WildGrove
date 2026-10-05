"use client"

// ══════════════════════════════════════════════════════════════════
// ConfirmDialog — Modal for destructive actions (delete, cancel)
// Closes with Escape, click outside, or Cancel button
// ══════════════════════════════════════════════════════════════════

import { useEffect, useCallback, useRef } from "react"
import { ExclamationTriangleIcon, SpinnerThinIcon } from "@wildgrove/ui/icons"

interface ConfirmDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    /** Visual variant: "danger" (red) or "warning" (amber) */
    variant?: "danger" | "warning"
    /** Show loading state on confirm button */
    isLoading?: boolean
    /** Why the last confirm failed, shown under the message */
    error?: string | null
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
    isLoading = false,
    error = null,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)

    // Close on Escape
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

    // Focus trap — focus the dialog when it opens
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            dialogRef.current.focus()
        }
    }, [isOpen])

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget && !isLoading) onClose()
        },
        [onClose, isLoading]
    )

    if (!isOpen) return null

    const confirmStyles =
        variant === "danger"
            ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white"
            : "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white"

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            <div
                ref={dialogRef}
                className="w-full max-w-md bg-wg-surface dark:bg-wg-dark-surface rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated p-6"
                tabIndex={-1}
            >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${variant === "danger"
                        ? "bg-red-100 dark:bg-red-900/30"
                        : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                    <ExclamationTriangleIcon className={`w-5 h-5 ${variant === "danger" ? "text-red-600 dark:text-red-400" : "text-amber-500 dark:text-amber-400" }`} />
                </div>

                <h3 id="confirm-dialog-title" className="font-display text-lg font-semibold text-wg-text dark:text-wg-dark-text mb-2">
                    {title}
                </h3>
                <p className={`text-sm text-wg-muted dark:text-wg-dark-muted ${error ? "mb-3" : "mb-6"}`}>
                    {message}
                </p>
                {error && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-6">
                        {error}
                    </p>
                )}

                <div className="flex items-center gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium rounded-brand border border-wg-border/50 dark:border-wg-dark-border text-wg-muted hover:text-wg-text hover:bg-wg-border/20 dark:text-wg-dark-muted dark:hover:text-wg-dark-text dark:hover:bg-wg-dark-border disabled:opacity-50 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium rounded-brand transition-colors disabled:opacity-50 ${confirmStyles}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <SpinnerThinIcon className="w-4 h-4 animate-spin" />
                                Processing...
                            </span>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
