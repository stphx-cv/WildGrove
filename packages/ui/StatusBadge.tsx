// ══════════════════════════════════════════════════════════════════
// StatusBadge — Color-coded badge for reservation/discount statuses
// Reusable across admin views. Extensible via STATUS_CONFIG.
// ══════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
    // Reservation statuses
    PENDING: {
        label: "Pending",
        classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    },
    CONFIRMED: {
        label: "Confirmed",
        classes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
    CANCELLED: {
        label: "Cancelled",
        classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    },
    COMPLETED: {
        label: "Completed",
        classes: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    },
    // Order-specific statuses
    PREPARING: {
        label: "Preparing",
        classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    READY: {
        label: "Ready",
        classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    OUT_FOR_DELIVERY: {
        label: "Out for Delivery",
        classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    },
    REFUNDED: {
        label: "Refunded",
        classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    },
    // Discount / general statuses
    ACTIVE: {
        label: "Active",
        classes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
    INACTIVE: {
        label: "Inactive",
        classes: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
    },
    // Discount types
    COUPON: {
        label: "Coupon",
        classes: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    },
    AUTOMATIC: {
        label: "Automatic",
        classes: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    },
}

const DEFAULT_CONFIG = {
    label: "Unknown",
    classes: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
}

interface StatusBadgeProps {
    status: string
    /** Override the display label */
    label?: string
    className?: string
}

export function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] ?? DEFAULT_CONFIG

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full uppercase tracking-wide ${config.classes} ${className}`}
        >
            {label ?? config.label}
        </span>
    )
}
