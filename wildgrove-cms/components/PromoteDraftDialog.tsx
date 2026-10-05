"use client"

// ══════════════════════════════════════════════════════════════════
// PromoteDraftDialog — Confirmation modal for "apply draft to parent"
// Replaces the parent's content with the draft's content, then deletes
// the draft. Other sibling drafts of the same parent are not affected.
// ══════════════════════════════════════════════════════════════════

import { ConfirmDialog } from "@/components/ConfirmDialog"

interface PromoteDraftDialogProps {
    isOpen: boolean
    parentName: string
    isLoading?: boolean
    onClose: () => void
    onConfirm: () => void
}

export function PromoteDraftDialog({
    isOpen,
    parentName,
    isLoading = false,
    onClose,
    onConfirm,
}: PromoteDraftDialogProps) {
    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Apply draft to parent"
            message={`Apply this draft to "${parentName}"? The published version's content will be replaced. Other drafts of this product are not affected.`}
            confirmLabel="Apply draft"
            cancelLabel="Cancel"
            variant="warning"
            isLoading={isLoading}
        />
    )
}
